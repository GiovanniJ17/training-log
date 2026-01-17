/**
 * AI Training Parser Service
 * Converte descrizioni di allenamento in linguaggio naturale in dati strutturati
 * Supporta input con più giorni nello stesso testo e data automatica per ogni giorno
 */

const AI_SYSTEM_PROMPT = `You are an expert Italian training data parser. Extract training data with EXTREME PRECISION.

CRITICAL FOR NUMBERS - FOLLOW EXACTLY:
- Times (time_s field): Convert ALL times to decimal seconds EXACTLY.
  * "6"70" or "6,70" or "6.70" → 6.7 seconds (NOT 6.70, use ONE decimal)
  * "1:30" → 90 seconds (1*60+30)
  * "7 minuti" or "7'" or "7min" → 420 seconds (7*60 = 420, NOT 7)
  * "30 secondi" or "30s" or "30"" → 30 seconds
  * "2 min 30s" or "2'30"" → 150 seconds (2*60+30 = 150)
  * "15.50" → 15.5 seconds (normalize decimals)
  
- Recovery (recovery_s field): Convert to integer seconds
  * "2'" or "2min" or "2 minuti" → 120 seconds (2*60 = 120)
  * "3'" → 180 seconds (3*60 = 180)
  * "45"" or "45s" → 45 seconds
  * "1'30"" → 90 seconds (1*60+30 = 90)
  * "completo" → null (no numeric value)
  
- Distances (distance_m field): Extract as integer meters
  * "50m" → 50
  * "100m" → 100
  * "1km" → 1000
  
- Sets/Reps: Extract as integers
  * "3x10" → sets: 3, reps: 10
  * "4 serie da 8" → sets: 4, reps: 8
  
- Weights (weight_kg field): Extract as decimal kilograms
  * "100kg" → 100
  * "85kg" → 85
  * "70%" → null (percentages need context)

- RPE: Extract as integer 0-10 only if explicitly mentioned
  * "intensità 8/10" → 8
  * "RPE 7" → 7
  * Otherwise → null

SESSION TYPE: Exactly ONE of [pista, palestra, strada, gara, test, scarico, recupero, altro]

OUTPUT: Valid JSON only. No markdown, no code blocks, no explanations.

EXAMPLE parsing "3x100m con recupero di 2 minuti":
{
  "exercise_name": "Sprint 100m",
  "sets": 3,
  "reps": 1,
  "distance_m": 100,
  "recovery_s": 120
}

CRITICAL: Be extremely accurate with numeric values. Round time_s to ONE decimal place max. This is critical data for performance tracking.`;

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
          details: {}
        }
      ]
    }
  ]
};

const WEEKDAY_INDEX = {
  lunedi: 1,
  'lunedì': 1,
  martedi: 2,
  'martedì': 2,
  mercoledi: 3,
  'mercoledì': 3,
  giovedi: 4,
  'giovedì': 4,
  venerdi: 5,
  'venerdì': 5,
  sabato: 6,
  domenica: 0,
};

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateForWeekday(weekday, reference = new Date()) {
  const weekStart = startOfWeek(reference);
  const targetIndex = WEEKDAY_INDEX[weekday.toLowerCase()] ?? 1;
  const result = new Date(weekStart);
  result.setDate(weekStart.getDate() + targetIndex - 1);
  return result.toISOString().split('T')[0];
}

function findDayChunks(text) {
  // Match giorni senza richiedere ^ o \n (più flessibile)
  const dayNames = ['lunedì', 'lunedi', 'martedì', 'martedi', 'mercoledì', 'mercoledi', 'giovedì', 'giovedi', 'venerdì', 'venerdi', 'sabato', 'domenica'];
  const pattern = new RegExp(`(${dayNames.join('|')})\\s*[:(]`, 'gi');
  
  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      keyword: match[1],
      charAfter: text[match.index + match[1].length]
    });
  }

  if (matches.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    
    // Trova l'inizio del testo dopo il giorno (dopo la parentesi/punteggiatura)
    let textStart = current.index + current.keyword.length;
    while (textStart < text.length && /[\s:(\-]/.test(text[textStart])) {
      textStart++;
    }
    
    const start = textStart;
    const end = next ? next.index : text.length;
    const raw = text.slice(start, end).trim();
    const cleaned = raw.replace(/^[:\-\s]+/, '').trim();
    
    chunks.push({
      weekday: current.keyword.toLowerCase(),
      heading: current.keyword.trim(),
      text: cleaned || raw
    });
  }
  
  return chunks;
}

function buildProxyRequest(provider, userPrompt) {
  const baseRequest = {
    provider,
    messages: [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  };

  if (provider === 'gemini') {
    return {
      ...baseRequest,
      model: 'gemini-2.5-flash',
      apiKey: import.meta.env.VITE_GEMINI_API_KEY
    };
  }
  if (provider === 'groq') {
    return {
      ...baseRequest,
      model: 'llama-3.1-70b-versatile',
      apiKey: import.meta.env.VITE_GROQ_API_KEY
    };
  }
  if (provider === 'cloudflare') {
    return {
      ...baseRequest,
      model: '@hf/mistral/mistral-7b-instruct-v0.2',
      accountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID,
      token: import.meta.env.VITE_CLOUDFLARE_API_TOKEN
    };
  }
  if (provider === 'huggingface') {
    return {
      ...baseRequest,
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      apiKey: import.meta.env.VITE_AI_API_KEY
    };
  }
  if (provider === 'openai') {
    return {
      ...baseRequest,
      model: 'gpt-4o',
      apiKey: import.meta.env.VITE_AI_API_KEY
    };
  }
  if (provider === 'anthropic') {
    return {
      ...baseRequest,
      model: 'claude-3-sonnet-20240229',
      apiKey: import.meta.env.VITE_AI_API_KEY
    };
  }

  throw new Error(`Provider non supportato: ${provider}`);
}

async function parseSingleDay({ text, date, titleHint }) {
  const provider = import.meta.env.VITE_AI_PROVIDER || 'gemini';

  // Template con esempi concreti di esercizi
  const jsonTemplate = `{
  "session": {"date":"${date}","title":"${titleHint || 'Session'}","type":"pista","rpe":null,"feeling":null,"notes":null},
  "groups": [
    {"name":"Riscaldamento","order_index":0,"notes":null,"sets":[
      {"exercise_name":"Corsa 2km","category":"endurance","sets":1,"reps":1,"weight_kg":null,"distance_m":2000,"time_s":null,"recovery_s":null,"notes":null,"details":{}}
    ]},
    {"name":"Lavoro Principale","order_index":1,"notes":null,"sets":[
      {"exercise_name":"Sprint 100m","category":"sprint","sets":4,"reps":1,"weight_kg":null,"distance_m":100,"time_s":null,"recovery_s":180,"notes":null,"details":{}}
    ]}
  ]
}`;

  const userPrompt = `Extract training data and return ONLY valid JSON.

Date: ${date}
Title: ${titleHint}

Text:
${text}

INSTRUCTIONS:
1. Every exercise MUST have exercise_name (e.g. "Sprint 100m", "Squat", "Corsa")
2. Every exercise MUST have category: one of [sprint, jump, lift, endurance, mobility, drill, other]
3. Extract: sets, reps, weight_kg, distance_m, time_s, recovery_s (as numbers or null)
4. Convert times: 6"70 → 6.7, 1:30 → 90, 2' → 120s
5. Group logically: Warmup, Main, Strength, Cooldown, etc
6. Session type: ONE of [pista, palestra, strada, gara, test, scarico, recupero, altro]

Example structure:
${jsonTemplate}

Return ONLY valid JSON. Do not include markdown or explanations.`;
  
  // Usa il proxy appropriato in base all'ambiente
  let proxyUrl = 'http://localhost:5000'; // Default: local dev
  
  if (import.meta.env.MODE === 'production') {
    // In production su Cloudflare Pages, usa il worker standalone
    proxyUrl = import.meta.env.VITE_WORKER_URL || 'https://training-log-ai-proxy.giovanni-jecha.workers.dev';
  }
  
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildProxyRequest(provider, userPrompt))
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Errore API AI');
  }

  const data = await response.json();
  let rawContent = '';

  if (data.choices) {
    rawContent = data.choices[0].message.content;
  } else if (data.content) {
    rawContent = data.content[0].text;
  } else {
    rawContent = JSON.stringify(data);
  }

  // Estratto JSON dal response
  let jsonStr = rawContent.trim();
  
  // Se avvolto in markdown, estrai
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1];
  }

  // Prova a trovare oggetto JSON
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[parseSingleDay] No JSON object found');
    throw new Error('Risposta AI non contiene JSON');
  }

  jsonStr = jsonMatch[0];

  try {
    // Normalizza le stringhe multilinea
    jsonStr = jsonStr.replace(/: "([^"]*)"\s*,/g, (match, value) => {
      const sanitized = value.replace(/\n/g, ' ').replace(/"/g, '\\"');
      return `: "${sanitized}",`;
    });

    // Fix: aggiungi { mancanti dopo array opening
    jsonStr = jsonStr.replace(/\[\s*"(name|order_index)/g, '[{"$1');
    jsonStr = jsonStr.replace(/\[\s*"name":/g, '[{"name":');

    // Fix: chiudi oggetti in array se necessario
    jsonStr = jsonStr.replace(/}(\s*),(\s*)\]/g, '}$1]');

    // Rimuovi trailing comma
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    // Fix: aggiungi virgola mancante tra proprietà se "name" viene direttamente dopo [
    jsonStr = jsonStr.replace(/\[\s*"name"/g, '[{"name"');

    // Prova il parsing
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.warn(`[parseSingleDay] First parse attempt failed, trying cleanup...`);
      
      // Fallback: rimuovi le parti malformate e mantieni quello che c'è
      // Estrai session
      const sessionMatch = jsonStr.match(/"session"\s*:\s*\{[^{}]*\}/);
      const sessionStr = sessionMatch ? sessionMatch[0] : '{"date":"' + date + '","title":"Session","type":"altro","rpe":null,"feeling":null,"notes":null}';
      
      // Estrai groups più semplicemente
      const groupsMatch = jsonStr.match(/"groups"\s*:\s*\[([\s\S]*)\]\s*\}/);
      let groupsStr = '[]';
      if (groupsMatch) {
        try {
          // Prova a parsare i groups come array
          groupsStr = '[' + groupsMatch[1] + ']';
          // Valida che sia almeno parsabile
          JSON.parse(groupsStr);
        } catch {
          // Se fallisce, crea un placeholder
          groupsStr = '[{"name":"Sessione","order_index":0,"notes":null,"sets":[{"exercise_name":"Sessione registrata","category":"other","sets":1,"reps":1,"weight_kg":null,"distance_m":null,"time_s":null,"recovery_s":null,"notes":null,"details":{}}]}]';
        }
      }

      // Ricostruisci il JSON
      try {
        parsed = {
          session: JSON.parse(sessionStr),
          groups: JSON.parse(groupsStr)
        };
      } catch (e2) {
        console.error(`[parseSingleDay] Fallback also failed, using minimal structure`);
        parsed = {
          session: { date, title: 'Session', type: 'altro', rpe: null, feeling: null, notes: null },
          groups: [{
            name: 'Sessione',
            order_index: 0,
            notes: null,
            sets: [{
              exercise_name: 'Sessione registrata',
              category: 'other',
              sets: 1,
              reps: 1,
              weight_kg: null,
              distance_m: null,
              time_s: null,
              recovery_s: null,
              notes: 'Contenuto estratto',
              details: {}
            }]
          }]
        };
      }
    }

    // Garantisci struttura
    if (!parsed.session) parsed.session = {};
    if (!parsed.groups) parsed.groups = [];

    parsed.session.date = date;
    if (titleHint && !parsed.session.title) parsed.session.title = titleHint;

    // Valida e ripulisci groups
    parsed.groups = parsed.groups.map(group => ({
      ...group,
      sets: (group.sets || [])
        .filter(set => set && set.exercise_name && set.exercise_name.trim())
        .map(set => ({
          exercise_name: (set.exercise_name || 'Unknown').trim(),
          category: set.category || 'other',
          sets: parseInt(set.sets) || 1,
          reps: parseInt(set.reps) || 1,
          weight_kg: set.weight_kg ? parseFloat(set.weight_kg) : null,
          distance_m: set.distance_m ? parseFloat(set.distance_m) : null,
          time_s: set.time_s ? parseFloat(set.time_s) : null,
          recovery_s: set.recovery_s ? parseFloat(set.recovery_s) : null,
          notes: set.notes || null,
          details: set.details || {}
        }))
    }))
    .filter(group => group.sets && group.sets.length > 0);

    // Valida type
    const validTypes = ['pista', 'palestra', 'strada', 'gara', 'test', 'scarico', 'recupero', 'altro'];
    if (parsed.session.type && !validTypes.includes(parsed.session.type.toLowerCase())) {
      parsed.session.type = 'altro';
    }

    return parsed;
  } catch (e) {
    console.error(`[parseSingleDay] Final error: ${e.message}`);
    throw new Error(`Parsing ${date}: ${e.message}`);
  }
}

/**
 * Interpreta testo di allenamento. Supporta più giorni nello stesso input.
 * - Se trova intestazioni con giorni (lunedì/martedì...), crea una sessione per ciascuna.
 * - Se non trova giorni, considera una sola sessione datata oggi.
 */
export async function parseTrainingWithAI(trainingText, referenceDate = new Date()) {
  const trimmed = trainingText?.trim();
  if (!trimmed) throw new Error('Testo allenamento vuoto');
  
  const chunks = findDayChunks(trimmed);

  // Caso multi-giorno
  if (chunks.length > 0) {
    const sessions = [];
    for (const chunk of chunks) {
      const targetDate = dateForWeekday(chunk.weekday, referenceDate);
      const parsed = await parseSingleDay({
        text: chunk.text,
        date: targetDate,
        titleHint: chunk.heading
      });
      sessions.push(parsed);
    }
    return { sessions };
  }

  // Caso singolo giorno → data = oggi/reference
  const singleDate = new Date(referenceDate).toISOString().split('T')[0];
  const parsed = await parseSingleDay({ text: trimmed, date: singleDate, titleHint: null });
  return { sessions: [parsed] };
}

function validateSingleSession(data) {
  const errors = [];

  if (!data.session) {
    errors.push('Mancano i dati della sessione');
  } else {
    if (!data.session.date) errors.push('Data sessione mancante');
    if (!data.session.type) errors.push('Tipo sessione mancante');

    const validTypes = ['pista', 'palestra', 'strada', 'gara', 'test', 'scarico', 'recupero', 'altro'];
    let sessionType = data.session.type;
    if (sessionType && typeof sessionType === 'string') {
      sessionType = sessionType.toLowerCase().trim();

      if (sessionType.includes(',')) {
        sessionType = sessionType.split(',')[0].trim();
      }

      if (sessionType.match(/[\s\-_,]+/)) {
        const parts = sessionType.split(/[\s\-_,]+/).filter(Boolean);
        sessionType = parts.find(p => validTypes.includes(p)) || parts[0];
      }

      if (!validTypes.includes(sessionType)) {
        for (const type of validTypes) {
          if (sessionType.includes(type)) {
            sessionType = type;
            break;
          }
        }
      }

      data.session.type = sessionType;
    }

    if (sessionType && !validTypes.includes(sessionType)) {
      errors.push(`Tipo sessione non valido: ${sessionType}`);
    }

    if (data.session.rpe !== null && data.session.rpe !== undefined) {
      const rpe = parseInt(data.session.rpe, 10);
      if (Number.isNaN(rpe) || rpe < 0 || rpe > 10) {
        errors.push('RPE deve essere tra 0 e 10');
      }
    }
  }

  if (!data.groups || !Array.isArray(data.groups)) {
    console.warn('[validateSingleSession] No groups found, creating placeholder');
    data.groups = [];
  }

  if (data.groups.length === 0) {
    // Crea un gruppo placeholder se non ci sono gruppi
    console.warn('[validateSingleSession] Adding placeholder group for session');
    data.groups = [{
      name: 'Sessione',
      order_index: 0,
      notes: 'Sessione auto-creata',
      sets: [{
        exercise_name: 'Sessione registrata',
        category: 'other',
        sets: 1,
        reps: 1,
        weight_kg: null,
        distance_m: null,
        time_s: null,
        recovery_s: null,
        notes: 'Contenuto estratto dal testo',
        details: {}
      }]
    }];
  } else {
    const validCategories = ['sprint', 'jump', 'lift', 'endurance', 'mobility', 'drill', 'other'];
    data.groups.forEach((group, idx) => {
      if (!group.sets || !Array.isArray(group.sets) || group.sets.length === 0) {
        console.warn(`[validateSingleSession] Group ${idx + 1} is empty, adding placeholder`);
        group.sets = [{
          exercise_name: group.name || 'Esercizio',
          category: 'other',
          sets: 1,
          reps: 1,
          weight_kg: null,
          distance_m: null,
          time_s: null,
          recovery_s: null,
          notes: null,
          details: {}
        }];
      }

      group.sets?.forEach((set, setIdx) => {
        if (!set.exercise_name) {
          console.warn(`[validateSingleSession] Set ${setIdx + 1} in group ${idx + 1} has no name, using group name`);
          set.exercise_name = group.name || 'Esercizio senza nome';
        }
        if (set.category && !validCategories.includes(set.category)) {
          console.warn(`[validateSingleSession] Invalid category "${set.category}", using "other"`);
          set.category = 'other';
        }
      });
    });
  }

  return errors;
}

/**
 * Valida dati parsati. Supporta sia {session,...} (legacy) sia {sessions:[...]} (multi).
 */
export function validateParsedData(data) {
  if (!data) return { valid: false, errors: ['Nessun dato parsato'] };

  const sessions = Array.isArray(data.sessions) && data.sessions.length > 0
    ? data.sessions
    : data.session
      ? [data]
      : [];

  if (sessions.length === 0) {
    return { valid: false, errors: ['Nessuna sessione trovata'] };
  }

  const errors = sessions.flatMap((s, idx) => {
    const errs = validateSingleSession(s);
    return errs.map(e => `Sessione ${idx + 1}: ${e}`);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}
