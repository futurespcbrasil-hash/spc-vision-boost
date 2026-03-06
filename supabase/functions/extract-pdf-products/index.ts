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
      console.error('PDF text too short:', pdfText?.length);
      return new Response(
        JSON.stringify({ success: false, error: 'Texto do PDF vazio ou muito curto' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not found');
      return new Response(
        JSON.stringify({ success: false, error: 'AI Gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing PDF text, length:', pdfText.length);

    const prompt = `Analise o texto abaixo extraído de uma tabela de preços de produtos/serviços e extraia TODOS os produtos.

Para cada produto identifique:
- "name": nome do produto/serviço (ex: "SóCheque", "SPC Maxi", "+ Pefin Serasa")
- "description": descrição do que inclui
- "price": preço no formato "R$ X,XX"
- "category": classifique em: cheque, cadastro, credito_pf_pj, imobiliario, positivo, agro, adicionais, insumos

IMPORTANTE: Extraia TODOS os itens com preço. Retorne APENAS um JSON array válido, sem markdown.

Texto:
${pdfText.substring(0, 12000)}`;

    console.log('Calling AI Gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você extrai dados de tabelas de preços. Retorne apenas JSON array válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `AI error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    console.log('AI response length:', content.length);
    
    let products = [];
    try {
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      products = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI response:', content.substring(0, 300));
      products = [];
    }

    console.log(`Extracted ${products.length} products`);

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
