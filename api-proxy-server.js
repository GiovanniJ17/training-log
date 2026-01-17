/**
 * Express API Proxy Server
 * Supports multiple AI providers:
 * - Cloudflare Workers AI (FREE - recommended for Cloudflare Pages)
 * - Hugging Face Inference API (FREE)
 * - OpenAI (paid)
 * - Anthropic (paid)
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
    providers: ['cloudflare', 'huggingface', 'openai', 'anthropic']
  });
});

// Main proxy endpoint
app.post('/', async (req, res) => {
  try {
    const { provider, messages, model, apiKey, accountId, token } = req.body;

    console.log(`🔄 Processing ${provider} request...`);

    if (!provider) {
      return res.status(400).json({ error: 'Provider è obbligatorio' });
    }

    let apiResponse;

    if (provider === 'cloudflare') {
      if (!accountId || !token) {
        return res.status(400).json({ error: 'Cloudflare: accountId e token sono obbligatori' });
      }
      apiResponse = await callCloudflareAI(messages, model || '@hf/mistral/mistral-7b-instruct-v0.2', accountId, token);
    } else if (provider === 'huggingface') {
      if (!apiKey) {
        return res.status(400).json({ error: 'Hugging Face: API key è obbligatorio' });
      }
      apiResponse = await callHuggingFace(messages, model || 'mistralai/Mistral-7B-Instruct-v0.2', apiKey);
    } else if (provider === 'openai') {
      if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI: API key è obbligatorio' });
      }
      apiResponse = await callOpenAI(messages, model || 'gpt-4o', apiKey);
    } else if (provider === 'anthropic') {
      if (!apiKey) {
        return res.status(400).json({ error: 'Anthropic: API key è obbligatorio' });
      }
      apiResponse = await callAnthropic(messages, model || 'claude-3-sonnet-20240229', apiKey);
    } else {
      return res.status(400).json({ error: `Provider non supportato: ${provider}` });
    }

    console.log('✅ Response successful');
    res.json(apiResponse);
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

async function callCloudflareAI(messages, model, accountId, token) {
  console.log('📡 Calling Cloudflare Workers AI...');
  
  // Estrai il sistema prompt e il contenuto dall'ultima domanda
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

    // Trasforma la risposta in formato simile a OpenAI per compatibilità
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

async function callHuggingFace(messages, model, apiKey) {
  console.log('📡 Calling Hugging Face Inference API...');
  
  const userContent = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        method: 'POST',
        body: JSON.stringify({
          inputs: userContent,
          parameters: {
            max_length: 4096,
            temperature: 0.1
          }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Hugging Face Error:', data.error);
      throw new Error(data.error || 'Hugging Face API error');
    }

    // Trasforma la risposta
    return {
      choices: [{
        message: {
          content: Array.isArray(data) ? data[0].generated_text : data.generated_text
        }
      }]
    };
  } catch (error) {
    console.error('❌ Hugging Face call failed:', error.message);
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
        response_format: { type: 'json_object' },
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
  console.log(`📨 Ready to proxy AI requests`);
  console.log(`${'='.repeat(60)}\n`);
});

