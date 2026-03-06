const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF data is required' }),
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

    console.log(`Processing PDF: ${fileName}, base64 length: ${pdfBase64.length}`);

    const prompt = `Analise este documento PDF que contém uma tabela de preços de produtos/serviços.

Extraia TODOS os produtos/serviços encontrados no documento. Para cada produto identifique:
- "name": nome do produto/serviço (ex: "SPC Maxi", "Confirme PF", "+ Pefin Serasa")
- "description": descrição completa do que o produto inclui
- "price": preço no formato "R$ X,XX" 
- "category": classifique em: cheque, cadastro, credito_pf_pj, imobiliario, positivo, agro, adicionais, insumos

IMPORTANTE: 
- Extraia TODOS os produtos, mesmo que sejam 30+
- Cada item com preço R$ é um produto diferente
- Mantenha os nomes originais dos produtos
- Retorne APENAS um JSON array válido, sem markdown, sem explicações

Exemplo de formato:
[{"name":"SPC Maxi","description":"Dados cadastrais + registros SPC...","price":"R$ 7,61","category":"credito_pf_pj"}]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'user', 
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:application/pdf;base64,${pdfBase64}` 
                } 
              }
            ]
          }
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
      console.error('Failed to parse AI response:', content.substring(0, 500));
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
