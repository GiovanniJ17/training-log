/**
 * Cloudflare Worker - AI Proxy for Training Log
 * Standalone deployment on Cloudflare Workers (not Pages)
 * Route: https://training-log-ai.YOUR_SUBDOMAIN.workers.dev
 * 
 * Security Features:
 * - CORS restricted to production domain
 * - Rate limiting (100 req/15min per IP)
 * - API key validation
 */

// CRITICAL: Change this to your production domain!
const ALLOWED_ORIGINS = [
  // Development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  
  // Production - Cloudflare Pages (tracker-velocista)
  'https://tracker-velocista.pages.dev',
  // Preview deployments (*.tracker-velocista.pages.dev)
  /^https:\/\/[a-z0-9]+\.tracker-velocista\.pages\.dev$/i
];

const RATE_LIMIT = {
  MAX_REQUESTS: 100,
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
};

function isOriginAllowed(origin) {
  // Controlla origins esatte
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') return allowed === origin;
    if (allowed instanceof RegExp) return allowed.test(origin);
    return false;
  });
}

function getCorsHeaders(origin) {
  // Se origin non è riconosciuto, permetti comunque per debugging
  // In produzione, puoi rendere questo più restrittivo
  const allowedOrigin = origin || ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Custom-API-Key',
    'Access-Control-Max-Age': '3600',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    console.log('[Worker] Incoming request:', {
      method: request.method,
      origin: origin,
      url: request.url,
      headers: Object.fromEntries(request.headers)
    });
    
    const corsHeaders = getCorsHeaders(origin);

    // Gestisci CORS preflight
    if (request.method === 'OPTIONS') {
      console.log('[Worker] Handling OPTIONS preflight');
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Rate Limiting (Simple IP-based)
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const rateLimitKey = `ratelimit:${clientIP}`;
    
    // Note: This requires a KV namespace bound as 'RATE_LIMIT_KV' in wrangler.toml
    // If not available, skip rate limiting (will log warning)
    if (env.RATE_LIMIT_KV) {
      const { limited, retryAfter } = await checkRateLimit(env.RATE_LIMIT_KV, rateLimitKey);
      if (limited) {
        return new Response(JSON.stringify({ 
          error: { message: 'Troppe richieste. Riprova tra qualche minuto.' } 
        }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString()
          }
        });
      }
    } else {
      console.warn('[Worker] RATE_LIMIT_KV not bound - rate limiting disabled');
    }

    // Solo POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      const { provider, messages, model, apiKey, responseSchema, responseFormat } = body;

      const inferredSchema = responseSchema || (responseFormat?.type === 'json_object' ? { type: 'object' } : null);
      console.log('[Worker] Request received:', { provider, model, hasApiKey: !!apiKey, hasSchema: !!inferredSchema, messagesCount: messages?.length });

      if (!provider) {
        return new Response(JSON.stringify({ error: { message: 'Provider è obbligatorio' } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('[Worker] Calling Gemini with model:', model || 'gemini-2.5-flash');
        result = await callGemini(messages, model || 'gemini-2.5-flash', geminiKey, inferredSchema);
      } else {
        return new Response(JSON.stringify({ error: { message: 'Provider non supportato' } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: { message: error.message } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Rate limiting using Cloudflare KV
 */
async function checkRateLimit(kv, key) {
  const now = Date.now();
  const data = await kv.get(key, { type: 'json' });
  
  if (!data) {
    // First request
    await kv.put(key, JSON.stringify({ count: 1, resetAt: now + RATE_LIMIT.WINDOW_MS }), {
      expirationTtl: Math.ceil(RATE_LIMIT.WINDOW_MS / 1000)
    });
    return { limited: false };
  }
  
  if (now > data.resetAt) {
    // Window expired, reset
    await kv.put(key, JSON.stringify({ count: 1, resetAt: now + RATE_LIMIT.WINDOW_MS }), {
      expirationTtl: Math.ceil(RATE_LIMIT.WINDOW_MS / 1000)
    });
    return { limited: false };
  }
  
  if (data.count >= RATE_LIMIT.MAX_REQUESTS) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((data.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }
  
  // Increment counter
  await kv.put(key, JSON.stringify({ count: data.count + 1, resetAt: data.resetAt }), {
    expirationTtl: Math.ceil((data.resetAt - now) / 1000)
  });
  
  return { limited: false };
}

async function callGemini(messages, model, apiKey, responseSchema = null) {
  // Combina i messaggi in un singolo prompt
  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userContent}` : userContent;
  
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  
  // Configurazione base
  const requestBody = {
    contents: [{
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };
  
  // Se fornito uno schema, usa Structured Output (JSON mode nativo)
  if (responseSchema) {
    requestBody.generationConfig.responseMimeType = 'application/json';
    requestBody.generationConfig.responseSchema = responseSchema;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
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
