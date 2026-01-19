/**
 * Express API Proxy Server
 * Supports multiple AI providers including Google Gemini
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  if (req.body && req.body.provider) {
    console.log(`Provider: ${req.body.provider}`);
  }
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ API Proxy running on port 5000',
    providers: ['gemini']
  });
});

// Main proxy endpoint
app.post('/', async (req, res) => {
  try {
    const { provider, messages, model, apiKey, accountId, token } = req.body;

    console.log(`🔄 Processing ${provider} request...`);
    
    // 1. Cerca la chiave nell'header personalizzato (Dev Mode)
    const customKey = req.headers['x-custom-api-key'];
    console.log('[Proxy] Custom key from header:', customKey ? `${customKey.substring(0, 10)}...` : 'none');
    
    // 2. Priorità: custom header > body apiKey
    const resolvedApiKey = (customKey && customKey.length > 10) ? customKey : apiKey;
    console.log('[Proxy] Resolved API key:', resolvedApiKey ? `${resolvedApiKey.substring(0, 10)}...` : 'none');

    if (!provider) {
      return res.status(400).json({ error: 'Provider è obbligatorio' });
    }

    let apiResponse;

    if (provider === 'gemini') {
      if (!resolvedApiKey) {
        return res.status(400).json({ error: 'Gemini: API key è obbligatorio' });
      }
      apiResponse = await callGemini(messages, model || 'gemini-2.5-flash', resolvedApiKey);
    } else {
      return res.status(400).json({ error: `Provider non supportato: ${provider}` });
    }

    console.log('✅ Response successful');
    res.json(apiResponse);
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    res.status(500).json({ error: { message: error.message } });
  }
});

async function callGemini(messages, model, apiKey) {
  console.log('📡 Calling Google Gemini API...');
  console.log(`   Model: ${model}`);
  
  // Combina i messaggi in un singolo prompt
  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userContent}` : userContent;
  
  try {
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
      console.error('❌ Gemini Error:', JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || `Gemini API error: ${response.statusText}`);
    }

    // Estrai il testo dalla risposta di Gemini
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('✅ Gemini response received');
    
    // Trasforma in formato compatibile (OpenAI-like)
    return {
      choices: [{
        message: {
          content: text
        }
      }]
    };
  } catch (error) {
    console.error('❌ Gemini call failed:', error.message);
    throw error;
  }
}

async function callGroq(messages, model, apiKey) {
  console.log('📡 Calling Groq API...');
  const finalModel = model || 'llama-3.1-70b-versatile';
  console.log(`   Model: ${finalModel}`);
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: messages,
        temperature: 0.1,
        max_tokens: 4096
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Groq Error:', JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || 'Groq API error');
    }

    console.log('✅ Groq response received');
    return data;
  } catch (error) {
    console.error('❌ Groq call failed:', error.message);
    throw error;
  }
}

async function callCloudflareAI(messages, model, accountId, token) {
  console.log('📡 Calling Cloudflare Workers AI...');
  
  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
  const prompt = systemPrompt ? `${systemPrompt}\n\n${userContent}` : userContent;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          max_tokens: 4096,
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Cloudflare Error:', data.errors);
      throw new Error(data.errors?.[0]?.message || 'Cloudflare AI error');
    }

    return {
      choices: [{
        message: {
          content: data.result?.response || ''
        }
      }]
    };
  } catch (error) {
    console.error('❌ Cloudflare call failed:', error.message);
    throw error;
  }
}

async function callOpenAI(messages, model, apiKey) {
  console.log('📡 Calling OpenAI API...');
  
  try {
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
      console.error('❌ OpenAI Error:', data.error?.message);
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    return data;
  } catch (error) {
    console.error('❌ OpenAI call failed:', error.message);
    throw error;
  }
}

async function callAnthropic(messages, model, apiKey) {
  console.log('📡 Calling Anthropic API...');
  
  try {
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
      console.error('❌ Anthropic Error:', data.error?.message);
      throw new Error(data.error?.message || 'Anthropic API error');
    }

    return data;
  } catch (error) {
    console.error('❌ Anthropic call failed:', error.message);
    throw error;
  }
}

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔌 API Proxy Server STARTED`);
  console.log(`📍 Listening on http://localhost:${PORT}`);
  console.log(`📨 Ready to proxy AI requests (Gemini, Groq, OpenAI, Anthropic)`);
  console.log(`${'='.repeat(60)}\n`);
});

