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

    if (!state) {
      return new Response(
        JSON.stringify({ success: false, error: 'Estado é obrigatório' }),
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

    const segmentText = segment ? ` que atuam no segmento de ${segment}` : '';
    const locationText = city 
      ? `na cidade de ${city}, no estado ${state}` 
      : `no estado ${state} (em diversas cidades)`;
    const locationWarning = city
      ? `ATENÇÃO: As empresas DEVEM ser da cidade de ${city} - ${state}. NÃO liste empresas de outras cidades ou estados.`
      : `ATENÇÃO: As empresas DEVEM ser do estado ${state}. Liste empresas de diferentes cidades do estado.`;
    const addressNote = city ? `${city} - ${state}` : `cidade - ${state}`;

    const prompt = `Liste 10 empresas reais que existem e estão localizadas ESPECIFICAMENTE ${locationText}, Brasil${segmentText}.

${locationWarning}

Para cada empresa retorne um objeto JSON com:
- "name": nome do responsável ou proprietário
- "company": nome fantasia ou razão social da empresa
- "phone": telefone fixo com DDD da cidade (formato: (XX) XXXX-XXXX)
- "whatsapp": celular com DDD (formato: 55XXXXXXXXXXX, apenas números, com DDD correto da região)
- "email": email comercial da empresa
- "segment": segmento de atuação da empresa
- "address": endereço completo incluindo rua, número, bairro, ${addressNote}

Retorne APENAS o JSON array, sem markdown, sem explicações.`;

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
