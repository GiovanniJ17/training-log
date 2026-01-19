/**
 * AI Training Parser Service
 * Converte descrizioni di allenamento in linguaggio naturale in dati strutturati
 * Supporta input con più giorni nello stesso testo e data automatica per ogni giorno
 */

const AI_SYSTEM_PROMPT = `You are an expert Italian training data parser. Extract training data with EXTREME PRECISION.

CRITICAL RULES:
1. MULTIPLE TIMES: If user lists times like "42-43-44-44-45", create SEPARATE sets for EACH time
2. TIME CONVERSION: 1'12" = 72s EXACTLY (1*60+12), NOT 73.7 or approximations
3. DISTANCES: Always meters. "12km" = 12000m, "1.5km" = 1500m
4. PACING: "4:30/km" over 12km = distance_m: 12000, time_s: null (or 12 * 270 = 3240s if you want total time)
5. MULTIPLE EXERCISES: "5 esercizi 4x10" = create 5 SEPARATE exercise entries

NUMERIC CONVERSIONS - EXACT ONLY:
- Times (time_s): Decimal seconds with max 1 decimal
  * "6"70" or "6,70" → 6.7 (not 6.70)
  * "1:30" → 90 (1*60+30 = 90 EXACTLY)
  * "1'12"" → 72 (1*60+12 = 72 EXACTLY, NOT 73.7)
  * "7'" or "7min" → 420 (7*60)
  * "25,6" → 25.6 (comma to dot)
  * "42-43-44" → CREATE 3 SETS with time_s: 42, 43, 44 individually
  
- Recovery (recovery_s): Integer seconds or null
  * "3min" or "3'" → 180 (3*60)
  * "rec 2'30"" → 150 (2*60+30)
  * "completo" → null
  
- Distances (distance_m): ALWAYS in meters (integer)
  * "200m" → 200
  * "12km" → 12000 (12*1000)
  * "1.5km" → 1500
  * "500" (assume meters) → 500

- Pacing conversions:
  * "12km a 4:30/km" → distance_m: 12000, time_s: null (or 12*270 if calculating)
  * "5km easy 5:00/km" → distance_m: 5000, time_s: null (or 5*300)

- Multiple exercises:
  * "palestra 5 esercizi 4x10 60-80kg" → Create 5 separate sets/exercises (Esercizio 1, Esercizio 2...)

SESSION TYPE: ONE of [pista, palestra, strada, gara, test, scarico, recupero, altro]

EXAMPLES:
1. "5x200m tempi 25.6-26.1-26.4-26.8-27.0" → 5 SEPARATE sets:
   [
     {exercise_name: "Sprint 200m", sets:1, distance_m:200, time_s:25.6, recovery_s:null},
     {exercise_name: "Sprint 200m", sets:1, distance_m:200, time_s:26.1, recovery_s:null},
     {exercise_name: "Sprint 200m", sets:1, distance_m:200, time_s:26.4, recovery_s:null},
     {exercise_name: "Sprint 200m", sets:1, distance_m:200, time_s:26.8, recovery_s:null},
     {exercise_name: "Sprint 200m", sets:1, distance_m:200, time_s:27, recovery_s:null}
   ]

2. "3x500m rec 6' tempi 1'12" - 1'14" - 1'15"" → 3 SEPARATE sets:
   [
     {exercise_name: "Corsa 500m", sets:1, distance_m:500, time_s:72, recovery_s:360},
     {exercise_name: "Corsa 500m", sets:1, distance_m:500, time_s:74, recovery_s:360},
     {exercise_name: "Corsa 500m", sets:1, distance_m:500, time_s:75, recovery_s:360}
   ]

3. "Lungo 12km easy 4:30/km" → 1 set:
   {exercise_name: "Corsa Lunga", sets:1, distance_m:12000, time_s:null, category:"endurance", notes:"pacing 4:30/km"}

4. "Palestra full body 5 esercizi 4x10 60-80kg" → 5 SEPARATE exercises:
   [
     {exercise_name: "Esercizio 1", category:"lift", sets:4, reps:10, weight_kg:60},
     {exercise_name: "Esercizio 2", category:"lift", sets:4, reps:10, weight_kg:65},
     {exercise_name: "Esercizio 3", category:"lift", sets:4, reps:10, weight_kg:70},
     {exercise_name: "Esercizio 4", category:"lift", sets:4, reps:10, weight_kg:75},
     {exercise_name: "Esercizio 5", category:"lift", sets:4, reps:10, weight_kg:80}
   ]

OUTPUT: Valid JSON ONLY. NO markdown, NO code blocks, NO explanations.`;

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
  domenica: 7, // Domenica = 7 per restare nella stessa settimana
};

function startOfWeek(date = new Date()) {
  // Usa il timezone locale per evitare shift di un giorno in ISO
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateForWeekday(weekday, reference = new Date()) {
  const weekStart = startOfWeek(reference);
  const targetIndex = WEEKDAY_INDEX[weekday.toLowerCase()] ?? 1;
  const result = new Date(weekStart);
  result.setDate(weekStart.getDate() + targetIndex - 1);
  return formatLocalDate(result);
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
    provider: 'gemini',
    messages: [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  };

  const isProd = import.meta.env.MODE === 'production';
  return {
    ...baseRequest,
    model: 'gemini-2.5-flash',
    ...(isProd ? {} : { apiKey: import.meta.env.VITE_GEMINI_API_KEY })
  };
}

async function parseSingleDay({ text, date, titleHint, devApiKey = null }) {
  const provider = 'gemini'; // Solo Gemini

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
  
  // TEMPORANEO: Chiamata diretta a Gemini dal browser (solo per testing)
  // In produzione dovresti usare un proxy per nascondere la chiave API
  const apiKey = devApiKey && devApiKey.trim().length > 10 
    ? devApiKey.trim() 
    : import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('API key Gemini non configurata. Inseriscila in Modalità Sviluppo.');
  }

  console.log('[AI Parser] Calling Gemini directly from browser');
  
  const systemPrompt = AI_SYSTEM_PROMPT;
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  let rawContent = '';

  // Gemini direct API response format
  if (data.candidates && data.candidates[0]?.content?.parts) {
    rawContent = data.candidates[0].content.parts[0].text;
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
 * @param {string|null} devApiKey - Optional dev API key to override env key
 */
export async function parseTrainingWithAI(trainingText, referenceDate = new Date(), devApiKey = null) {
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
        titleHint: chunk.heading,
        devApiKey
      });
      sessions.push(parsed);
    }
    return { sessions };
  }

  // Caso singolo giorno → data = oggi/reference
  const singleDate = formatLocalDate(new Date(referenceDate));
  const parsed = await parseSingleDay({ text: trimmed, date: singleDate, titleHint: null, devApiKey });
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
