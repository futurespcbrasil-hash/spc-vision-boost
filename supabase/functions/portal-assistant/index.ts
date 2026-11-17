// Public visitor endpoint. Gemini credentials stay in Supabase Function secrets.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Type",
};
const windows = new Map<string, { count: number; resetAt: number }>();
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json(405, { error: "Método não permitido." });

  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const current = windows.get(ip);
  if (current && current.resetAt > now && current.count >= 12) {
    return json(429, { error: "Muitas perguntas em pouco tempo. Aguarde alguns minutos." });
  }
  if (!current || current.resetAt <= now) windows.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
  else current.count += 1;

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(503, { error: "Assistente ainda não configurado pelo administrador." });

  let body: { question?: unknown; lessonId?: unknown; course?: unknown; image?: unknown };
  try { body = await request.json(); } catch { return json(400, { error: "Requisição inválida." }); }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, 4000) : "";
  const image = body.image && typeof body.image === "object" ? body.image as Record<string, unknown> : null;
  if (!question && !image) return json(400, { error: "Digite sua dúvida ou envie uma imagem." });

  const course = Array.isArray(body.course) ? body.course.slice(0, 30) : [];
  const knowledge = course.map((item: any) => {
    const title = typeof item?.title === "string" ? item.title.slice(0, 180) : "";
    const content = typeof item?.content === "string" ? item.content.slice(0, 5000) : "";
    return title ? "AULA: " + title + "\n" + content : "";
  }).filter(Boolean).join("\n\n").slice(0, 30000);
  const lessonId = typeof body.lessonId === "string" ? body.lessonId.slice(0, 80) : "";

  const parts: Record<string, unknown>[] = [{
    text: [
      "Você é o Assistente Future, suporte do Emissor Future da Future Soluções.",
      "Responda em português do Brasil, de forma simples, direta e prática.",
      "Para instruções, indique o caminho no sistema e passos numerados.",
      "Use o manual abaixo; não invente menus ou funcionalidades. Se faltar informação, deixe isso claro.",
      "Questões de NCM, CFOP, CST, CSOSN, alíquotas e retenções devem ser confirmadas com a contabilidade.",
      "Nunca solicite senha, arquivo de certificado ou dados sigilosos.",
      lessonId ? "A aula atual tem o identificador: " + lessonId : "",
      "MANUAL DO CURSO:\n" + (knowledge || "Manual não enviado."),
      "DÚVIDA DO VISITANTE:\n" + (question || "Analise a imagem enviada e explique o que aparece e como resolver, se for um erro do Emissor Future."),
    ].filter(Boolean).join("\n\n"),
  }];

  if (image) {
    const mimeType = typeof image.mimeType === "string" ? image.mimeType : "";
    const data = typeof image.data === "string" ? image.data : "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType) || !/^[A-Za-z0-9+/]+=*$/.test(data) || data.length > 8_000_000) {
      return json(400, { error: "Imagem inválida. Envie PNG, JPG ou WEBP de até 6 MB." });
    }
    parts.push({ inline_data: { mime_type: mimeType, data } });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.25, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) {
      const status = response.status;
      if (status === 429) return json(429, { error: "O assistente está ocupado. Aguarde um pouco e tente novamente." });
      console.error("Gemini stream failed with status", status);
      return json(502, { error: "Não foi possível consultar o assistente agora." });
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Portal assistant stream failed", error instanceof Error ? error.name : "unknown");
    return json(502, { error: "Falha temporária ao consultar o assistente." });
  }
});
