import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://crm.futuresolucoes.com.br",
  "https://spc-vision-crm.vercel.app",
]);

const json = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      ...(origin && allowedOrigins.has(origin) ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      } : {}),
    },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Vary": "Origin",
      },
    });
  }
  if (req.method !== "POST") return json(405, { error: "Método não permitido." }, origin);
  if (!origin || !allowedOrigins.has(origin)) return json(403, { error: "Origem não autorizada." }, origin);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Dados inválidos." }, origin);
  }

  // Honeypot: bots commonly fill hidden fields. Return success without storing anything.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return json(200, { ok: true }, origin);
  }

  const nome = typeof payload.nome === "string" ? payload.nome.trim() : "";
  const telefone = typeof payload.telefone === "string" ? payload.telefone.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const interesse = typeof payload.interesse === "string" ? payload.interesse : "";
  const consentimento = payload.consentimento === true;
  const allowedInterests = new Set(["certificado-digital", "emissor-fiscal", "spc-brasil", "assinatura-pdf", "outro"]);

  if (nome.length < 2 || nome.length > 120 ||
      telefone.replace(/\D/g, "").length < 10 || telefone.length > 30 ||
      email.length < 5 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !allowedInterests.has(interesse) || !consentimento) {
    return json(400, { error: "Confira os campos e autorize o contato para continuar." }, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Configuração do serviço de captação incompleta.");
    return json(503, { error: "Captação temporariamente indisponível. Tente novamente mais tarde." }, origin);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Basic per-email cooldown to reduce duplicate submissions. No IP or document data is stored.
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recent, error: lookupError } = await db
    .from("future_assinador_leads")
    .select("id")
    .ilike("email", email)
    .gte("created_at", since)
    .limit(1);

  if (lookupError) {
    console.error("Falha ao verificar duplicidade de lead.", lookupError.message);
    return json(503, { error: "Não foi possível registrar agora. Tente novamente." }, origin);
  }
  if (recent && recent.length > 0) {
    return json(200, { ok: true, message: "Recebemos seus dados recentemente." }, origin);
  }

  const { error: insertError } = await db.from("future_assinador_leads").insert({
    nome, telefone, email, interesse, consentimento,
    origem: "future-assinador",
  });
  if (insertError) {
    console.error("Falha ao salvar lead do Future Assinador.", insertError.message);
    return json(503, { error: "Não foi possível registrar agora. Tente novamente." }, origin);
  }

  return json(200, { ok: true }, origin);
});
