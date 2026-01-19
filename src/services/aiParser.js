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

TITLE & NOTES:
- session.title must be a concise 4-8 word summary of the main work (e.g. "Pista 4x50m + Palestra forza")
- session.notes must be a short 1-2 sentence narrative of the session from the user text (e.g. "Sessione in pista con 4x50m, intensità 7, poi palestra con squat e power clean.")

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

function buildTextSummary(rawText) {
  if (!rawText) return '';
  const firstSentence = rawText
    .split(/(?<=[\.\!\?])\s+|\n+/)
    .map(s => s.trim())
    .find(s => s.length > 0);
  if (!firstSentence) return rawText.trim().slice(0, 120);
  return firstSentence.length > 160 ? firstSentence.slice(0, 160) : firstSentence;
}

function parseExplicitDate(str, reference = new Date()) {
  // Supporta formati tipo 15/01/2026 o 15-01-26
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // JS months 0-based
  const yearRaw = m[3];
  let year = yearRaw ? parseInt(yearRaw, 10) : reference.getFullYear();
  if (year < 100) year += 2000; // normalizza anni a due cifre

  const d = new Date(year, month, day);
  if (Number.isNaN(d.getTime())) return null;
  return formatLocalDate(d);
}

function findDayChunks(text, reference = new Date()) {
  // Match giorni senza richiedere : o parentesi (più tollerante)
  const dayNames = ['lunedì', 'lunedi', 'martedì', 'martedi', 'mercoledì', 'mercoledi', 'giovedì', 'giovedi', 'venerdì', 'venerdi', 'sabato', 'domenica'];
  const pattern = new RegExp(`(${dayNames.join('|')})`, 'gi');
  
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
    
    // Trova l'inizio del testo dopo il giorno (spazi, : , - , parentesi)
    let textStart = current.index + current.keyword.length;
    while (textStart < text.length && /[\s:()\-]/.test(text[textStart])) {
      textStart++;
    }
    
    const start = textStart;
    const end = next ? next.index : text.length;
    const raw = text.slice(start, end).trim();
    const cleaned = raw.replace(/^[:\-\s]+/, '').trim();

    // Se il testo dopo il giorno inizia con una data esplicita, estraila
    const dateMatch = cleaned.match(/^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/);
    const explicitDate = dateMatch ? parseExplicitDate(dateMatch[1], reference) : null;
    const textWithoutDate = dateMatch ? cleaned.slice(dateMatch[1].length).trim() : cleaned;
    
    chunks.push({
      weekday: current.keyword.toLowerCase(),
      heading: current.keyword.trim(),
      text: textWithoutDate || cleaned || raw,
      explicitDate
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
  const textSummary = buildTextSummary(text);

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
7. Set session.title as concise summary (4-8 words) of main work
8. Set session.notes as a short 1-2 sentence summary of the session using user text

Example structure:
${jsonTemplate}

Return ONLY valid JSON. Do not include markdown or explanations.`;
  
  // Usa il worker proxy per nascondere la chiave API (SICURO)
  let workerUrl = 'http://localhost:5000'; // Local dev
  
  if (import.meta.env.MODE === 'production') {
    // Production: usa il worker Cloudflare
    workerUrl = import.meta.env.VITE_WORKER_URL || 'https://training-log-ai-proxy.giovanni-jecha.workers.dev';
  }
  
  const headers = { 'Content-Type': 'application/json' };
  const requestBody = buildProxyRequest('gemini', userPrompt);
  console.log('[AI Parser] Calling worker at:', workerUrl);
  
  const response = await fetch(workerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Worker error: ${response.status}`);
  }

  const data = await response.json();
  let rawContent = '';

  // Worker ritorna il formato OpenAI-compatible
  if (data.choices && data.choices[0]?.message?.content) {
    rawContent = data.choices[0].message.content;
  } else if (data.error) {
    throw new Error(data.error.message || 'Worker error');
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
    if (!parsed.session.title || !parsed.session.title.trim()) {
      parsed.session.title = textSummary || titleHint || 'Sessione';
    }
    if (!parsed.session.notes || !parsed.session.notes.trim()) {
      parsed.session.notes = textSummary || parsed.session.notes || null;
    }

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
 * - Se non trova giorni, cerca una data esplicita nel testo.
 * - Se non trova neanche una data, usa la data di riferimento (oggi).
 */
function inferRpeFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  const numeric = lower.match(/(\d{1,2})\s*(?:\/10|su\s*10)/);
  if (numeric) {
    const val = parseInt(numeric[1], 10);
    if (val >= 1 && val <= 10) return val;
  }

  if (lower.includes('massimo')) return 9;
  if (lower.includes('alta') || lower.includes('intenso')) return 8;
  if (lower.includes('media')) return 6;
  if (lower.includes('bassa') || lower.includes('easy')) return 4;
  if (lower.includes('scarico') || lower.includes('recupero')) return 3;

  return null;
}

export async function parseTrainingWithAI(trainingText, referenceDate = new Date()) {
  let trimmed = trainingText?.trim();
  if (!trimmed) throw new Error('Testo allenamento vuoto');
  
  // Cerca pattern "inizio settimana DD/MM/YYYY" o "settimana del DD/MM/YYYY"
  let weekReference = referenceDate;
  const weekPatterns = [
    /(?:inizio\s+settimana|settimana\s+del|settimana)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i,
    /^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s*[-:]\s*settimana/i
  ];
  
  for (const pattern of weekPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const parsed = parseExplicitDate(match[1], referenceDate);
      if (parsed) {
        weekReference = new Date(parsed);
        // Rimuovi questa frase introduttiva dal testo
        trimmed = trimmed.replace(match[0], '').trim();
        break;
      }
    }
  }
  
  const chunks = findDayChunks(trimmed, weekReference);

  // Caso multi-giorno
  if (chunks.length > 0) {
    const sessions = [];
    for (const chunk of chunks) {
      const targetDate = chunk.explicitDate || dateForWeekday(chunk.weekday, weekReference);
      const parsed = await parseSingleDay({
        text: chunk.text,
        date: targetDate,
        titleHint: chunk.heading
      });
      // Se manca rpe, prova a inferirlo dal testo del chunk
      if (!parsed.session.rpe) {
        const inferred = inferRpeFromText(chunk.text);
        if (inferred) parsed.session.rpe = inferred;
      }
      sessions.push(parsed);
    }

    const personalBests = extractPersonalBests(trimmed);
    const injuries = extractInjuries(trimmed);
    return { sessions, personalBests, injuries };
  }

  // Caso singolo giorno: cerca data esplicita nel testo
  let singleDate = formatLocalDate(new Date(weekReference));
  let singleText = trimmed;
  
  // Estrai data esplicita se presente
  const dateMatch = trimmed.match(/^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/);
  if (dateMatch) {
    const extracted = parseExplicitDate(dateMatch[1], weekReference);
    if (extracted) {
      singleDate = extracted;
      singleText = trimmed.slice(dateMatch[1].length).trim();
    }
  }
  
  const parsed = await parseSingleDay({ text: singleText, date: singleDate, titleHint: null });
  if (!parsed.session.rpe) {
    const inferred = inferRpeFromText(singleText);
    if (inferred) parsed.session.rpe = inferred;
  }

  const personalBests = extractPersonalBests(trimmed);
  const injuries = extractInjuries(trimmed);
  return { sessions: [parsed], personalBests, injuries };
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

// =====================
// Estrazione PB e infortuni dal testo grezzo
// =====================

export function extractPersonalBests(text) {
  const pbs = [];

  // PB gara esplicito: "100m 10.5sec PB"
  const racePattern = /(\d+)\s*m(?:etri?)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?\s+(?:PB|personal\s+best|nuovo\s+record|miglior\s+tempo)/gi;
  let match;
  while ((match = racePattern.exec(text)) !== null) {
    pbs.push({ type: 'race', distance_m: parseInt(match[1]), time_s: parseFloat(match[2].replace(',', '.')), is_personal_best: true });
  }

  // PB gara implicito in contesto gara/pista: "gara 60m 7.18" oppure "gara 100 10.40"
  if (text.match(/\bgara\b|\bpista\b|\bcompetizione\b|\bgare\b/i)) {
    const implicitRacePattern = /(?:gara|pista|competizione)\s*:?\s*(\d+)\s*m?(?:etri)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?(?!\s+(?:x|serie|set|\d+x))/gi;
    while ((match = implicitRacePattern.exec(text)) !== null) {
      const distance = parseInt(match[1]);
      const time = parseFloat(match[2].replace(',', '.'));
      const isDuplicate = pbs.some(pb => pb.type === 'race' && pb.distance_m === distance && Math.abs(pb.time_s - time) < 0.1);
      if (!isDuplicate) {
        pbs.push({ type: 'race', distance_m: distance, time_s: time, is_personal_best: true, implicit: true });
      }
    }
  }

  // PB gara implicito GENERICO (es. "test 150m 19.8" o "60m 7.20" anche senza parola gara)
  if (text.match(/\btest\b|\bsforzo\b|\bmassimo\b|\btempo\b|\bcronometro\b/i)) {
    // Consente poche parole tra distanza e tempo (es. "300m ripetuta singola in 36.5") ma blocca pattern di ripetizioni (x, serie, volte)
    // Richiede o "in <tempo>" oppure un'unità (sec/s/"), per non scambiare RPE o conteggi per tempi
    const genericRacePattern = /(?:^|\b)(?!\d+\s*x)(\d+)\s*m(?:etri)?\b(?:\s+(?!\d+\s*(?:x|volte|rip|rep|serie|set))(?!per\s+\d)(?!x\s+\d)(?:[a-zà-ù']+)){0,4}\s*(?:in\s+(\d+[.,]\d+|\d+)|(\d+[.,]\d+|\d+)(?:['"”″]|\s*(?:sec|s)\b))(?!\s+(?:x|serie|set|\d+x|volte|volta|ripetute|rip|rep))/gi;
    while ((match = genericRacePattern.exec(text)) !== null) {
      const rawSegment = match[0];
      if (/rec(?:upero)?/i.test(rawSegment)) continue; // evita di leggere i recuperi come tempi PB

      const distance = parseInt(match[1]);
      const timeStr = match[2] || match[3];
      const time = parseFloat(timeStr.replace(',', '.'));
      // Evita duplicati e tempi irreali
      if (time <= 0 || time > 600) continue; // taglia tempi fuori scala
      const minPlausible = distance / 12; // es: 100m -> ~8.3s minimo plausibile
      if (time < minPlausible) continue; // scarta conteggi o RPE (es. "60m ... intensità 8")
      const isDuplicate = pbs.some(pb => pb.type === 'race' && pb.distance_m === distance && Math.abs(pb.time_s - time) < 0.1);
      if (!isDuplicate) {
        pbs.push({ type: 'race', distance_m: distance, time_s: time, is_personal_best: true, implicit: true, generic: true });
      }
    }
  }

  // PB forza esplicito: "Squat 100kg PB"
  const strengthPattern = /(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?)\s+(\d+[.,]\d+|\d+)\s*kg\s+(?:PB|personal\s+best|massimale|nuovo\s+massimale)/gi;
  while ((match = strengthPattern.exec(text)) !== null) {
    const exerciseName = match[1];
    const categoryMap = {
      'squat': 'squat', 'bench': 'bench', 'panca': 'bench', 'deadlift': 'deadlift', 'stacco': 'deadlift',
      'clean': 'clean', 'jerk': 'jerk', 'press': 'press', 'military press': 'press', 'military': 'press',
      'trazioni': 'pull', 'trazione': 'pull'
    };
    const category = categoryMap[exerciseName.toLowerCase()] || 'other';
    pbs.push({ type: 'strength', exercise_name: exerciseName, category, weight_kg: parseFloat(match[2].replace(',', '.')), reps: 1, is_personal_best: true });
  }

  // PB forza implicito: "palestra squat 150kg" (senza PB)
  if (text.match(/\bpalestra\b|\bforza\b|\bmassimali\b/i)) {
    const implicitStrengthPattern = /(?:palestra|forza)\s*:?\s*(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?)\s+(\d+[.,]\d+|\d+)\s*kg(?!\s+(?:x|reps|set))/gi;
    while ((match = implicitStrengthPattern.exec(text)) !== null) {
      const exerciseName = match[1];
      const weight = parseFloat(match[2].replace(',', '.'));
      const categoryMap = {
        'squat': 'squat', 'bench': 'bench', 'panca': 'bench', 'deadlift': 'deadlift', 'stacco': 'deadlift',
        'clean': 'clean', 'jerk': 'jerk', 'press': 'press', 'military press': 'press', 'military': 'press',
        'trazioni': 'pull', 'trazione': 'pull'
      };
      const category = categoryMap[exerciseName.toLowerCase()] || 'other';
      const isDuplicate = pbs.some(pb => pb.type === 'strength' && pb.category === category && Math.abs(pb.weight_kg - weight) < 0.5);
      if (!isDuplicate) {
        pbs.push({ type: 'strength', exercise_name: exerciseName, category, weight_kg: weight, reps: 1, is_personal_best: true, implicit: true });
      }
    }
  }

  return pbs;
}

export function extractInjuries(text) {
  const injuries = [];
  const pattern = /(infortunio|lesione|strappo|contrattura|dolore|fastidio)\s+(?:al|alla|allo|ai|alle|dietro\s+al)?\s*([a-zàèéìòù\s]+)/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const type = match[1];
    const bodyPart = match[2].trim();
    injuries.push({
      injury_type: type,
      body_part: bodyPart,
      start_date: formatLocalDate(new Date()),
      severity: 'moderate'
    });
  }
  return injuries;
}
