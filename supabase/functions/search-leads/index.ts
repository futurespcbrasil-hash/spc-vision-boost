const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, state, segment } = await req.json();

    if (!city || !state) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cidade e estado são obrigatórios' }),
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

    const segmentText = segment ? ` no segmento de ${segment}` : '';
    const prompt = `Busque empresas reais em ${city}, ${state}${segmentText}. 
Retorne EXATAMENTE um JSON array com 10 empresas. Cada objeto deve ter:
- "name": nome da empresa
- "company": razão social ou nome fantasia
- "phone": telefone fixo com DDD (formato: (XX) XXXX-XXXX)
- "whatsapp": celular com DDD (formato: 55XXXXXXXXXXX, apenas números)
- "email": email comercial da empresa
- "segment": segmento de atuação
- "address": endereço completo

Retorne APENAS o JSON array, sem markdown, sem explicações. Exemplo:
[{"name":"João Silva","company":"Silva Comércio LTDA","phone":"(11) 3456-7890","whatsapp":"5511987654321","email":"contato@silva.com.br","segment":"Comércio","address":"Rua das Flores, 123 - Centro, São Paulo - SP"}]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um assistente que busca informações de empresas brasileiras. Retorne apenas JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar leads' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse the JSON from the response
    let leads = [];
    try {
      // Remove potential markdown code blocks
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      leads = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      leads = [];
    }

    return new Response(
      JSON.stringify({ success: true, leads }),
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
