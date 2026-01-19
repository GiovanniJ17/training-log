/**
 * Cloudflare Worker - AI Proxy for Training Log
 * Standalone deployment on Cloudflare Workers (not Pages)
 * Route: https://training-log-ai.YOUR_SUBDOMAIN.workers.dev
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Custom-API-Key',
  'Access-Control-Max-Age': '3600'
};

export default {
  async fetch(request, env) {
    // Gestisci CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // Solo POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: CORS_HEADERS
      });
    }

    try {
      const body = await request.json();
      const { provider, messages, model, apiKey } = body;

      console.log('[Worker] Request received:', { provider, model, hasApiKey: !!apiKey, messagesCount: messages?.length });

      if (!provider) {
        return new Response(JSON.stringify({ error: { message: 'Provider è obbligatorio' } }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // 1. Cerca la chiave nell'header personalizzato (Dev Mode)
      const customKey = request.headers.get('X-Custom-API-Key');
      console.log('[Worker] Custom key from header:', customKey ? `${customKey.substring(0, 10)}...` : 'none');
      
      // 2. Priorità: custom header > body apiKey > env variable
      const resolvedApiKey = (customKey && customKey.length > 10) ? customKey : apiKey;
      console.log('[Worker] Resolved API key:', resolvedApiKey ? `${resolvedApiKey.substring(0, 10)}...` : 'none');

      let result;

      if (provider === 'gemini') {
        const geminiKey = resolvedApiKey || env.GEMINI_API_KEY;
        if (!geminiKey) {
          return new Response(JSON.stringify({ error: { message: 'Gemini API key non configurata' } }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }
        console.log('[Worker] Calling Gemini with model:', model || 'gemini-2.5-flash');
        result = await callGemini(messages, model || 'gemini-2.5-flash', geminiKey);
      } else {
        return new Response(JSON.stringify({ error: { message: 'Provider non supportato' } }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: { message: error.message } }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function callGemini(messages, model, apiKey) {
  // Combina i messaggi in un singolo prompt
  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userContent}` : userContent;
  
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini API error: ${response.statusText}`);
  }

  // Estrai il testo dalla risposta di Gemini
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Trasforma in formato compatibile (OpenAI-like)
  return {
    choices: [{
      message: {
        content: text
      }
    }]
  };
}

async function callOpenAI(messages, model, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.1
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenAI API error');
  }

  return data;
}

async function callAnthropic(messages, model, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: messages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Anthropic API error');
  }

  return data;
}
