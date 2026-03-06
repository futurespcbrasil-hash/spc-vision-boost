const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText } = await req.json();

    if (!pdfText || pdfText.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Texto do PDF vazio ou muito curto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI Gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Analise o texto extraído de uma tabela de preços de produtos/serviços e extraia TODOS os produtos encontrados.

Para cada produto, identifique:
- "name": nome do produto/serviço
- "description": descrição completa do que inclui
- "price": preço no formato "R$ X,XX"
- "category": classifique em uma dessas categorias: cheque, cadastro, credito_pf_pj, imobiliario, positivo, agro, adicionais, insumos

Retorne APENAS um JSON array válido, sem markdown. Exemplo:
[{"name":"SPC Maxi","description":"Dados cadastrais + registros SPC...","price":"R$ 7,61","category":"credito_pf_pj"}]

IMPORTANTE: Extraia TODOS os produtos, mesmo que sejam muitos. Cada linha com preço R$ é um produto diferente.

Texto do PDF:
${pdfText.substring(0, 15000)}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um especialista em extrair dados estruturados de tabelas de preços. Retorne apenas JSON válido, sem markdown, sem explicações.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    let products = [];
    try {
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      products = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      products = [];
    }

    return new Response(
      JSON.stringify({ success: true, products }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
