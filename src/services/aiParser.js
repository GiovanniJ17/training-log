/**
 * AI Training Parser Service
 * Converte descrizioni di allenamento in linguaggio naturale 
 * in dati strutturati per il database
 */

const AI_SYSTEM_PROMPT = `Extract training data from Italian workout descriptions. Parse EVERY exercise mentioned.

CRITICAL: Session type MUST be a SINGLE value from this list ONLY:
pista, palestra, strada, gara, test, scarico, recupero, altro

For MIXED sessions (pista AND palestra mentioned):
- Count: pista exercises = "4x50m" (1 group)
- Count: palestra exercises = "squat 100kg", "trazioni zavorrate", "power clean", "squat veloci", "pancia manubri" (5 groups)
- CHOOSE MAJORITY: palestra has more exercises → type="palestra"

PARSING RULES:
1. RPE: Extract "intensità X" as rpe (0-10 number)
2. Feeling: Extract sensations into feeling field
3. EXERCISES - Parse ALL of them:
   - Track: "4x50m" → sets=4, distance_m=50, category="sprint"
   - Strength: "100kg 2x3" → weight_kg=100, sets=2, reps=3, category="lift"
   - Plyometric: "squat jumps 3 serie" → category="jump", sets=3
4. WEIGHTS: Extract ALL kg values. "80% massimale(70kg)" → weight_kg=56 (70*0.8)
5. Recovery: Convert to seconds (2min=120s, 30"=30s)

EXAMPLE FOR YOUR CONTEXT:
Input: "prima pista (4x50m) poi palestra (squat 100kg, trazioni 20kg, power clean, squat veloci, petto 16kg)"
Decision: Palestra has 5 exercises, Pista has 1 → type MUST be "palestra" (not "pista" or "pista, palestra" or "palestrapista")

OUTPUT: Valid JSON only. type field MUST be single word from valid list.`;




const RESPONSE_FORMAT = {
  session: {
    date: "YYYY-MM-DD",
    title: "Titolo della sessione",
    type: "pista|palestra|strada|gara|test|scarico|recupero|altro",
    location: "Location (opzionale)",
    rpe: "0-10 (opzionale)",
    feeling: "Come ti sei sentito (opzionale)",
    notes: "Note generali (opzionale)"
  },
  groups: [
    {
      name: "Nome gruppo (es: Riscaldamento, Lavoro principale, Palestra)",
      order_index: 0,
      notes: "Note gruppo (opzionale)",
      sets: [
        {
          exercise_name: "Nome esercizio standardizzato",
          category: "sprint|jump|lift|endurance|mobility|drill|other",
          sets: 1,
          reps: 1,
          weight_kg: null,
          distance_m: null,
          time_s: null,
          recovery_s: null,
          notes: "Note specifiche (opzionale)",
          details: {} // JSONB per dati extra
        }
      ]
    }
  ]
};

/**
 * Parses natural language training descriptions using AI
 * @param {string} trainingText - Raw Italian workout description
 * @param {Date} date - Session date (defaults to today)
 * @returns {Promise<Object>} Parsed training data with session, groups, and sets
 * @throws {Error} If AI parsing or validation fails
 */
export async function parseTrainingWithAI(trainingText, date = new Date()) {
  const provider = import.meta.env.VITE_AI_PROVIDER || 'cloudflare';

  const userPrompt = `Data allenamento: ${date.toISOString().split('T')[0]}

Descrizione allenamento:
${trainingText}

Converti in JSON seguendo questo formato:
${JSON.stringify(RESPONSE_FORMAT, null, 2)}`;

  try {
    // Usa il proxy server sulla porta 5000
    const response = await fetch('http://localhost:5000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildProxyRequest(provider, userPrompt))
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Errore API AI');
    }

    const data = await response.json();
    
    // Gestisci diverse strutture di risposta
    if (data.choices) {
      // Risposta OpenAI format
      const content = data.choices[0].message.content;
      return JSON.parse(content);
    } else if (data.content) {
      // Risposta Anthropic
      const content = data.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Risposta AI non contiene JSON valido');
      }
      return JSON.parse(jsonMatch[0]);
    }
    
    return data;
  } catch (error) {
    console.error('Errore nel parsing AI:', error);
    throw new Error(`Errore nell'interpretazione AI: ${error.message}`);
  }
}

/**
 * Crea il corpo della richiesta per il proxy basato sul provider
 */
function buildProxyRequest(provider, userPrompt) {
  const baseRequest = {
    provider: provider,
    messages: [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  };

  if (provider === 'cloudflare') {
    return {
      ...baseRequest,
      model: '@hf/mistral/mistral-7b-instruct-v0.2',
      accountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID,
      token: import.meta.env.VITE_CLOUDFLARE_API_TOKEN
    };
  } else if (provider === 'huggingface') {
    return {
      ...baseRequest,
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      apiKey: import.meta.env.VITE_AI_API_KEY
    };
  } else if (provider === 'openai') {
    return {
      ...baseRequest,
      model: 'gpt-4o',
      apiKey: import.meta.env.VITE_AI_API_KEY
    };
  } else if (provider === 'anthropic') {
    return {
      ...baseRequest,
      model: 'claude-3-sonnet-20240229',
      apiKey: import.meta.env.VITE_AI_API_KEY
    };
  }

  throw new Error(`Provider non supportato: ${provider}`);
}

/**
 * Valida i dati parsati dall'AI
 */
export function validateParsedData(data) {
  const errors = [];

  // Valida sessione
  if (!data.session) {
    errors.push('Mancano i dati della sessione');
  } else {
    if (!data.session.date) errors.push('Data sessione mancante');
    if (!data.session.type) errors.push('Tipo sessione mancante');
    
    const validTypes = ['pista', 'palestra', 'strada', 'gara', 'test', 'scarico', 'recupero', 'altro'];
    
    // Normalizza il tipo sessione: gestisci parole fuse o separate
    let sessionType = data.session.type;
    if (sessionType && typeof sessionType === 'string') {
      sessionType = sessionType.toLowerCase().trim();
      
      // Se contiene virgola, prendi il primo (sessione mista dichiarata)
      if (sessionType.includes(',')) {
        sessionType = sessionType.split(',')[0].trim();
      }
      
      // Se contiene spazi/connettori, prova a separare e validare
      if (sessionType.includes(' ') || sessionType.includes('-') || sessionType.includes('_')) {
        const parts = sessionType.split(/[\s\-_,]+/).filter(p => p.length > 0);
        // Prendi il primo parte valida
        sessionType = parts.find(p => validTypes.includes(p)) || parts[0];
      }
      
      // Se contiene parole fuse (es: "palestrapista"), prova a estrarre valide
      if (!validTypes.includes(sessionType)) {
        for (const type of validTypes) {
          if (sessionType.includes(type)) {
            sessionType = type;
            break;
          }
        }
      }
      
      data.session.type = sessionType; // Normalizza
    }
    
    if (sessionType && !validTypes.includes(sessionType)) {
      errors.push(`Tipo sessione non valido: ${sessionType}`);
    }

    if (data.session.rpe !== null && data.session.rpe !== undefined) {
      const rpe = parseInt(data.session.rpe);
      if (isNaN(rpe) || rpe < 0 || rpe > 10) {
        errors.push('RPE deve essere tra 0 e 10');
      }
    }
  }

  // Valida gruppi ed esercizi
  if (!data.groups || !Array.isArray(data.groups)) {
    errors.push('Mancano i gruppi di esercizi');
  } else {
    data.groups.forEach((group, idx) => {
      if (!group.sets || !Array.isArray(group.sets) || group.sets.length === 0) {
        errors.push(`Gruppo ${idx + 1} non contiene esercizi`);
      }
      
      const validCategories = ['sprint', 'jump', 'lift', 'endurance', 'mobility', 'drill', 'other'];
      group.sets?.forEach((set, setIdx) => {
        if (!set.exercise_name) {
          errors.push(`Esercizio ${setIdx + 1} nel gruppo ${idx + 1} senza nome`);
        }
        if (set.category && !validCategories.includes(set.category)) {
          errors.push(`Categoria non valida per esercizio "${set.exercise_name}"`);
        }
      });
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
