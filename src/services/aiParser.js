/**
 * AI Training Parser Service
 * Converte descrizioni di allenamento in linguaggio naturale in dati strutturati
 * Supporta input con più giorni nello stesso testo e data automatica per ogni giorno
 * 
 * Features:
 * - Context-aware: conosce PB attuali, infortuni, pattern ricorrenti
 * - Anomaly detection: rileva dati sospetti (tempi impossibili, pesi anomali)
 * - Structured output: usa JSON schema nativo di Gemini
 */

import { getAthleteContext, detectAnomalies } from './contextService.js';
import { TRAINING_SESSION_SCHEMA, buildSchemaRequest } from './aiSchema.js';

const AI_SYSTEM_PROMPT = `You are an expert Italian training data parser. Extract training data with EXTREME PRECISION.

EXERCISE NORMALIZATION (AI-based mapping):
- Normalize exercise names to STANDARD forms (prefer English names for consistency)
- Examples:
  * "Squat", "Back Squat", "Squat completo" → "Squat"
  * "Panca piana", "Bench press", "Distensioni" → "Bench Press"
  * "Stacco", "Deadlift", "Stacco da terra" → "Deadlift"
  * "Girata", "Power Clean", "Clean" → "Power Clean"
  * "Slancio", "Jerk", "Push Jerk" → "Jerk"
  * "Sprint 100m", "100 metri", "Cento" → "Sprint 100m"
  * "Squat bulgaro", "Bulgarian Split Squat" → "Bulgarian Split Squat"
- Map variations to the closest standard exercise
- If exercise is unique/specific, keep descriptive name but standardize format

CRITICAL RULES:
1. MULTIPLE TIMES: If user lists times like "42-43-44-44-45", create SEPARATE sets for EACH time
2. TIME CONVERSION: 1'12" = 72s EXACTLY (1*60+12), NOT 73.7 or approximations
3. DISTANCES: Always meters. "12km" = 12000m, "1.5km" = 1500m
4. PACING: "4:30/km" over 12km = distance_m: 12000, time_s: null (or 12 * 270 = 3240s if you want total time)
5. MULTIPLE EXERCISES: "5 esercizi 4x10" = create 5 SEPARATE exercise entries

6. ⚠️ AMBIGUITY HANDLING - NEVER GUESS, ALWAYS ASK:
   * If recovery time is ambiguous (e.g., "rec 3" without min/sec), MUST populate questions_for_user array
   * Example: User says "rec 3" → Ask: "Il recupero di 3 è in secondi o minuti?"
   * If distance unit is missing and not obvious from context → Ask
   * If weight unit is missing and not obvious → Ask
   * If exercise name is vague ("leg press" could be multiple variations) → Ask or use best judgment
   * CRITICAL: Do NOT default to minutes or seconds. If you cannot be 100% certain from context (e.g., previous sets in the same group with explicit units), you MUST ask.
   * Format questions_for_user as: [{"field": "recovery_s", "question": "Il recupero di 3 è in secondi o minuti?", "options": ["3 secondi", "3 minuti"]}]

7. INTENT vs REALITY: When user mentions both goal and actual result, ALWAYS extract ACTUAL RESULT (reality), not goal.
   * Example: "Volevo fare 35s ma ho fatto 36.2" → Extract time_s: 36.2 (actual), NOT 35 (goal)
   * Example: "Obiettivo 10.5 ma fermato a 10.8" → Extract time_s: 10.8 (actual), NOT 10.5 (goal)
   * Keywords: "volevo", "mirava", "dovrebbe", "ma ho fatto", "ma sono arrivato", "invece ho", "però", "purtroppo"

8. STRENGTH MAXES: Recognize various ways of expressing personal bests for strength exercises:
   * "provato il massimale, salito a 160kg" → Extract 160kg as 1RM
   * "Squat massimale 160kg" → Extract 160kg
   * "ho fatto 90kg PB" → Extract 90kg
   * "salito facile a 160kg (PB assoluto)" → Extract 160kg
   * Exercises: Squat, Bench/Panca, Deadlift/Stacco, Clean/Girata, Press, Jerk
   * When "provato massimale" or "tentato massimale" appears, extract the ACTUAL weight achieved, not attempts

NOISE FILTERING:
- Ignore names of people ("Ho incontrato Marco...")
- Ignore durations describing interruptions ("Marco mi ha fermato 20 minuti" is not training time)
- Ignore emotional context ("allenamento strano", "finalmente ho iniziato")
- Extract only measurable training data (times, distances, weights, reps)

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

5. "Volevo fare 35 secondi ma ho fatto 36.2 sui 300m" → Extract ACTUAL result:
   {exercise_name: "Sprint 300m", sets:1, distance_m:300, time_s:36.2, recovery_s:null}
   NOT 35 seconds - that's the goal.

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

function parseRelativeDate(text, reference = new Date()) {
  // Supporta: "ieri", "oggi", "domani", "3 giorni fa", "2 giorni fa", etc.
  const lower = text.trim().toLowerCase();
  
  // Exact matches
  if (lower === 'ieri' || lower === 'yesterday') {
    const d = new Date(reference);
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }
  if (lower === 'oggi' || lower === 'today') {
    return formatLocalDate(reference);
  }
  if (lower === 'domani' || lower === 'tomorrow') {
    const d = new Date(reference);
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  }
  
  // Pattern: "N giorni fa"
  const daysAgoMatch = text.match(/^(\d+)\s*(?:giorno|giorni|day|days)\s+fa\s*$/i);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const d = new Date(reference);
    d.setDate(d.getDate() - days);
    return formatLocalDate(d);
  }
  
  // Pattern: "fra N giorni" / "in N giorni"
  const daysFromNowMatch = text.match(/^(?:fra|in)\s+(\d+)\s*(?:giorno|giorni|day|days)\s*$/i);
  if (daysFromNowMatch) {
    const days = parseInt(daysFromNowMatch[1], 10);
    const d = new Date(reference);
    d.setDate(d.getDate() + days);
    return formatLocalDate(d);
  }
  
  return null;
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
    
    // FILTER: Salta sessioni vuote (solo spazi, "niente", "riposo", punteggiatura)
    const isEmpty = !textWithoutDate || 
                    /^[\s.,!?-]*$/.test(textWithoutDate) || 
                    /^\s*(niente|riposo|nulla|off|rest|completo|scarico)\s*[.,!?-]*$/i.test(textWithoutDate);
    
    if (isEmpty) {
      // Skipping empty session
      continue;
    }
    
    chunks.push({
      weekday: current.keyword.toLowerCase(),
      heading: current.keyword.trim(),
      text: textWithoutDate || cleaned || raw,
      explicitDate
    });
  }
  
  return chunks;
}

/**
 * Sanitizza la risposta JSON rimuovendo testo extra prima/dopo
 */
function sanitizeJsonResponse(jsonStr) {
  if (!jsonStr) return '{}';
  
  // Rimuovi caratteri di controllo invisibili
  jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Trova il primo { e l'ultimo } bilanciato
  const firstBrace = jsonStr.indexOf('{');
  if (firstBrace === -1) return '{}';
  
  let braceCount = 0;
  let lastBrace = -1;
  
  for (let i = firstBrace; i < jsonStr.length; i++) {
    if (jsonStr[i] === '{') braceCount++;
    if (jsonStr[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        lastBrace = i;
        break;
      }
    }
  }
  
  if (lastBrace === -1) return '{}';
  
  return jsonStr.slice(firstBrace, lastBrace + 1);
}

/**
 * Parse sicuro per interi - gestisce range e valori non validi
 */
function safeParseInt(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  
  // Converti a stringa per gestire vari tipi di input
  const str = String(value).trim();
  
  // Gestisci range (es. "20-25") - prendi il primo valore
  if (str.includes('-')) {
    const parts = str.split('-');
    const firstNum = parseInt(parts[0], 10);
    if (!isNaN(firstNum) && firstNum > 0) {
      console.warn(`[safeParseInt] Range detected "${str}", using first value: ${firstNum}`);
      return firstNum;
    }
  }
  
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse sicuro per float - gestisce range e valori non validi
 */
function safeParseFloat(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  
  // Converti a stringa per gestire vari tipi di input
  const str = String(value).trim().replace(',', '.');
  
  // Gestisci range (es. "60-80") - prendi il primo valore
  if (str.includes('-')) {
    const parts = str.split('-');
    const firstNum = parseFloat(parts[0]);
    if (!isNaN(firstNum) && firstNum > 0) {
      console.warn(`[safeParseFloat] Range detected "${str}", using first value: ${firstNum}`);
      return firstNum;
    }
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultValue : parsed;
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
    // Usa JSON Mode nativo di Gemini per risposta strutturata
    responseFormat: { type: 'json_object' },
    ...(isProd ? {} : { apiKey: import.meta.env.VITE_GEMINI_API_KEY })
  };
}

async function parseSingleDay({ text, date, titleHint, devApiKey = null, athleteContext = null }) {
  try {
    const provider = 'gemini'; // Solo Gemini
    const textSummary = buildTextSummary(text);
    
    // Ottieni contesto atleta se non fornito (RAG pattern)
    const context = athleteContext || await getAthleteContext();

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
  ],
  "questions_for_user": [],
  "warnings": []
}`;

  const userPrompt = `${context}

Extract training data and return ONLY valid JSON.

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
8. STRENGTH MAXES: When user says "provato il massimale" or "salito a XXkg", extract as single 1RM set with weight_kg: XX, sets:1, reps:1
8. Set session.notes as a short 1-2 sentence summary of the session using user text

REQUIRED OUTPUT FIELDS (ALWAYS PRESENT):
- questions_for_user: array (can be empty). If any ambiguity exists (units missing, recovery unclear, distance unclear, vague exercise), ADD a question here. NEVER guess.
- warnings: array (can be empty). Add anomalies or impossible values here.

Example structure:
${jsonTemplate}

Return ONLY valid JSON. Do not include markdown or explanations.

AMBIGUITIES: If you are uncertain about a value (e.g., "rec 3" could be 3 seconds or 3 minutes), add a question to the "questions_for_user" array.
ANOMALIES: If a value seems impossible or unusual (e.g., 100m in 9s), add a warning to the "warnings" array.`;
  
  // Usa il worker proxy con schema strutturato (eliminaREGEX parsing!)
  const requestBody = buildSchemaRequest('gemini', [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ], TRAINING_SESSION_SCHEMA);
  
  // Dev mode: aggiungi API key custom se fornita
  if (devApiKey && import.meta.env.MODE !== 'production') {
    requestBody.apiKey = devApiKey;
  }
  
  // Worker URL
  let workerUrl = 'http://localhost:5000'; // Local dev
  if (import.meta.env.MODE === 'production') {
    workerUrl = import.meta.env.VITE_WORKER_URL || 'https://training-log-ai-proxy.giovanni-jecha.workers.dev';
  }
  
  const headers = { 'Content-Type': 'application/json' };
  
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
  
  // Con JSON Mode di Gemini, dovrebbe essere già JSON puro
  // Ma manteniamo fallback per markdown code blocks (compatibilità)
  if (jsonStr.startsWith('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1];
  }

  // Sanitizza il JSON prima del parsing (rimuove testo extra prima/dopo)
  jsonStr = sanitizeJsonResponse(jsonStr);

  // JSON Mode di Gemini ritorna JSON direttamente, parsing diretto
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
    // JSON Mode parsing successful
  } catch (e) {
    console.warn(`[parseSingleDay] Direct JSON parsing failed, trying to extract JSON object...`);
    
    // Fallback: estrai oggetto JSON se c'è testo extra
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[parseSingleDay] No JSON object found');
      throw new Error('Risposta AI non contiene JSON');
    }

    jsonStr = jsonMatch[0];
    
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e2) {
      console.warn(`[parseSingleDay] Second parse attempt failed, using minimal structure...`);
      // Fallback: struttura minima
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
  if (!parsed.questions_for_user) parsed.questions_for_user = [];
  if (!parsed.warnings) parsed.warnings = [];

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
        sets: safeParseInt(set.sets, 1),
        reps: safeParseInt(set.reps, 1),
        weight_kg: safeParseFloat(set.weight_kg),
        distance_m: safeParseFloat(set.distance_m),
        time_s: safeParseFloat(set.time_s),
        recovery_s: safeParseInt(set.recovery_s),
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
  
  // PREPROCESSING: Controlla relative dates nel testo
  // Pattern: "Ieri ho fatto..." oppure "Oggi..." oppure "Domani..."
  const relativeDateMatch = trimmed.match(/^(ieri|oggi|domani|[\d]+\s+(?:giorno|giorni|day|days)\s+fa|fra\s+[\d]+\s+(?:giorno|giorni|day|days)|in\s+[\d]+\s+(?:giorno|giorni|day|days))\b/i);
  if (relativeDateMatch) {
    const relativeDate = parseRelativeDate(relativeDateMatch[1], referenceDate);
    if (relativeDate) {
      // Sostituisci "Ieri ho fatto..." con il testo senza il prefisso relativo
      trimmed = trimmed.slice(relativeDateMatch[0].length).trim();
      // Usa la data relativa calcolata come data di riferimento
      const parsedSingle = await parseSingleDay({
        text: trimmed,
        date: relativeDate,
        titleHint: null
      });
      if (!parsedSingle.session.rpe) {
        const inferred = inferRpeFromText(trimmed);
        if (inferred) parsedSingle.session.rpe = inferred;
      }
      const personalBests = mergePersonalBests(
        extractPersonalBests(trainingText),
        derivePBsFromSessions([parsedSingle])
      );
      const injuries = extractInjuries(trainingText);
      return { sessions: [parsedSingle], personalBests, injuries };
    }
  }
  
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

    const personalBests = mergePersonalBests(
      extractPersonalBests(trimmed),
      derivePBsFromSessions(sessions)
    );
    const injuries = extractInjuries(trimmed);
    const questions = sessions.flatMap(s => s.questions_for_user || []);
    const warnings = sessions.flatMap(s => s.warnings || []);
    return { sessions, personalBests, injuries, questions_for_user: questions, warnings };
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

  const personalBests = mergePersonalBests(
    extractPersonalBests(trimmed),
    derivePBsFromSessions([parsed])
  );
  const injuries = extractInjuries(trimmed);
  const questions = parsed.questions_for_user || [];
  const warnings = parsed.warnings || [];
  return { sessions: [parsed], personalBests, injuries, questions_for_user: questions, warnings };
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

  // PB esplicito: "100m 10.5sec PB" (classifica come gara solo se il contesto contiene gara/competizione)
  const racePattern = /(\d+)\s*m(?:etri?)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?\s+(?:PB|personal\s+best|nuovo\s+record|miglior\s+tempo)/gi;
  let match;
  while ((match = racePattern.exec(text)) !== null) {
    const distance = parseInt(match[1]);
    const time = parseFloat(match[2].replace(',', '.'));
    const isCompetition = /\bgara\b|\bcompetizione\b/i.test(text);
    if (isCompetition) {
      pbs.push({ type: 'race', distance_m: distance, time_s: time, is_personal_best: true });
    } else {
      pbs.push({ type: 'training', exercise_name: `Sprint ${distance}m`, exercise_type: 'sprint', performance_value: time, performance_unit: 'seconds', is_personal_best: true });
    }
  }

  // PB implicito in contesto gara: "gara 60m 7.18" oppure "competizione 100 10.40"
  if (text.match(/\bgara\b|\bcompetizione\b|\bgare\b/i)) {
    const implicitRacePattern = /(?:gara|competizione)\s*:?\s*(\d+)\s*m?(?:etri)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?(?!\s+(?:x|serie|set|\d+x))/gi;
    while ((match = implicitRacePattern.exec(text)) !== null) {
      const distance = parseInt(match[1]);
      const time = parseFloat(match[2].replace(',', '.'));
      const isDuplicate = pbs.some(pb => pb.type === 'race' && pb.distance_m === distance && Math.abs(pb.time_s - time) < 0.1);
      if (!isDuplicate) {
        pbs.push({ type: 'race', distance_m: distance, time_s: time, is_personal_best: true, implicit: true });
      }
    }
  }

  // PB implicito in contesto pista (allenamento): "pista 150m 19.8"
  if (text.match(/\bpista\b/i)) {
    const implicitTrainingPattern = /pista\s*:?\s*(\d+)\s*m?(?:etri)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?(?!\s+(?:x|serie|set|\d+x))/gi;
    while ((match = implicitTrainingPattern.exec(text)) !== null) {
      const distance = parseInt(match[1]);
      const time = parseFloat(match[2].replace(',', '.'));
      const isDuplicate = pbs.some(pb => pb.type === 'training' && pb.exercise_type === 'sprint' && pb.performance_unit === 'seconds' && pb.exercise_name === `Sprint ${distance}m` && Math.abs(pb.performance_value - time) < 0.1);
      if (!isDuplicate) {
        pbs.push({ type: 'training', exercise_name: `Sprint ${distance}m`, exercise_type: 'sprint', performance_value: time, performance_unit: 'seconds', is_personal_best: true, implicit: true });
      }
    }
  }

  // PB implicito GENERICO di allenamento/test (es. "test 150m 19.8" o "60m 7.20")
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
      const isDuplicate = pbs.some(pb => pb.type === 'training' && pb.exercise_name === `Sprint ${distance}m` && Math.abs(pb.performance_value - time) < 0.1);
      if (!isDuplicate) {
        pbs.push({ type: 'training', exercise_name: `Sprint ${distance}m`, exercise_type: 'sprint', performance_value: time, performance_unit: 'seconds', is_personal_best: true, implicit: true, generic: true });
      }
    }
  }

  // PB forza esplicito: "Squat 100kg PB" o "provato il massimale, salito a 160kg (PB assoluto)"
  // Pattern 1: Peso seguito da indicatore PB
  const strengthPattern = /(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?|girata)\s+(?:al\s+petto\s+)?(\d+[.,]\d+|\d+)\s*kg\s*(?:\()?(?:PB|personal\s+best|massimale|nuovo\s+massimale|PB\s+assoluto|record)/gi;
  while ((match = strengthPattern.exec(text)) !== null) {
    const exerciseName = match[1];
    const categoryMap = {
      'squat': 'squat', 'bench': 'bench', 'panca': 'bench', 'deadlift': 'deadlift', 'stacco': 'deadlift',
      'clean': 'clean', 'jerk': 'jerk', 'press': 'press', 'military press': 'press', 'military': 'press',
      'trazioni': 'pull', 'trazione': 'pull', 'girata': 'clean'
    };
    const category = categoryMap[exerciseName.toLowerCase()] || 'other';
    pbs.push({ type: 'strength', exercise_name: exerciseName, category, weight_kg: parseFloat(match[2].replace(',', '.')), reps: 1, is_personal_best: true });
  }

  // Pattern 2: "provato/testato il massimale ... a XXkg" o "salito a XXkg"
  const maxAttemptPattern = /(?:provato|testato|fatto|tentato)\s+(?:il\s+)?massimale[^\.!?]{0,40}?\b(squat|bench|deadlift|stacco|clean|jerk|press|panca|girata)\s*[^\.!?]{0,30}?(?:a|facile\s+a|salito\s+a|arrivato\s+a)\s+(\d+[.,]\d+|\d+)\s*kg/gi;
  while ((match = maxAttemptPattern.exec(text)) !== null) {
    const exerciseName = match[1];
    const weight = parseFloat(match[2].replace(',', '.'));
    const categoryMap = {
      'squat': 'squat', 'bench': 'bench', 'panca': 'bench', 'deadlift': 'deadlift', 'stacco': 'deadlift',
      'clean': 'clean', 'jerk': 'jerk', 'press': 'press', 'girata': 'clean'
    };
    const category = categoryMap[exerciseName.toLowerCase()] || 'other';
    const isDuplicate = pbs.some(pb => pb.type === 'strength' && pb.category === category && Math.abs(pb.weight_kg - weight) < 0.5);
    if (!isDuplicate) {
      pbs.push({ type: 'strength', exercise_name: exerciseName, category, weight_kg: weight, reps: 1, is_personal_best: true });
    }
  }

  // PB forza implicito: "palestra squat 150kg" (senza PB esplicito)
  if (text.match(/\bpalestra\b|\bforza\b|\bmassimali\b/i)) {
    const implicitStrengthPattern = /(?:palestra|forza)\s*:?\s*(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?|girata)\s+(?:al\s+petto\s+)?(\d+[.,]\d+|\d+)\s*kg(?!\s+(?:x|reps|set))/gi;
    while ((match = implicitStrengthPattern.exec(text)) !== null) {
      const exerciseName = match[1];
      const weight = parseFloat(match[2].replace(',', '.'));
      const categoryMap = {
        'squat': 'squat', 'bench': 'bench', 'panca': 'bench', 'deadlift': 'deadlift', 'stacco': 'deadlift',
        'clean': 'clean', 'jerk': 'jerk', 'press': 'press', 'military press': 'press', 'military': 'press',
        'trazioni': 'pull', 'trazione': 'pull', 'girata': 'clean'
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

// =====================
// PB derivati dai dati parsati (senza affidarsi al testo grezzo)
// =====================

function isPlausibleSprint(distance, time) {
  if (!distance || !time) return false;
  if (time <= 0 || time > 600) return false;
  const minPlausible = distance / 12; // es: 100m -> ~8.3s minimo plausibile
  return time >= minPlausible;
}

function mapStrengthCategory(exerciseName = '') {
  const n = (exerciseName || '').toLowerCase();
  if (n.includes('squat')) return 'squat';
  if (n.includes('panca') || n.includes('bench')) return 'bench';
  if (n.includes('stacco') || n.includes('deadlift')) return 'deadlift';
  if (n.includes('clean') || n.includes('girata')) return 'clean';
  if (n.includes('jerk')) return 'jerk';
  if (n.includes('press')) return 'press';
  if (n.includes('traz') || n.includes('pull')) return 'pull';
  return 'lift';
}

export function derivePBsFromSessions(sessions) {
  const pbs = [];
  if (!sessions || sessions.length === 0) return pbs;

  const bestStrength = {};

  sessions.forEach(session => {
    const sessionType = (session.session?.type || '').toLowerCase();
    const isCompetition = sessionType === 'gara';

    (session.groups || []).forEach(group => {
      (group.sets || []).forEach(set => {
        const distance = set.distance_m || null;
        const time = set.time_s || null;
        if (distance && time && isPlausibleSprint(distance, time)) {
          if (isCompetition) {
            const duplicate = pbs.some(pb => pb.type === 'race' && pb.distance_m === distance && Math.abs(pb.time_s - time) < 0.05);
            if (!duplicate) {
              pbs.push({ type: 'race', distance_m: distance, time_s: time, is_personal_best: true, derived: true });
            }
          } else {
            const exerciseName = `Sprint ${distance}m`;
            const duplicate = pbs.some(pb => pb.type === 'training' && pb.exercise_name === exerciseName && Math.abs(pb.performance_value - time) < 0.05);
            if (!duplicate) {
              pbs.push({ type: 'training', exercise_name: exerciseName, exercise_type: 'sprint', performance_value: time, performance_unit: 'seconds', is_personal_best: true, derived: true });
            }
          }
        }

        if (set.weight_kg) {
          const exerciseName = set.exercise_name || 'Forza';
          const key = exerciseName.toLowerCase();
          const category = mapStrengthCategory(exerciseName);
          const current = bestStrength[key];
          if (!current || set.weight_kg > current.weight_kg) {
            bestStrength[key] = {
              type: 'strength',
              exercise_name: exerciseName,
              category,
              weight_kg: set.weight_kg,
              reps: set.reps || 1,
              is_personal_best: true,
              derived: true
            };
          }
        }
      });
    });
  });

  // Aggiungi i migliori massimali per esercizio
  Object.values(bestStrength).forEach(pb => pbs.push(pb));

  return pbs;
}

export function mergePersonalBests(textPBs, derivedPBs) {
  const merged = [...(textPBs || [])];
  (derivedPBs || []).forEach(pb => {
    let duplicate = false;
    
    if (pb.type === 'race') {
      // Race PB: confronta distance_m e time_s
      duplicate = merged.some(m => 
        m.type === 'race' && 
        m.distance_m === pb.distance_m && 
        Math.abs(m.time_s - pb.time_s) < 0.05
      );
    } else if (pb.type === 'training') {
      // Training PB: confronta exercise_name e performance_value
      duplicate = merged.some(m => 
        m.type === 'training' && 
        m.exercise_name === pb.exercise_name && 
        m.performance_unit === pb.performance_unit &&
        Math.abs(m.performance_value - pb.performance_value) < 0.05
      );
    } else if (pb.type === 'strength') {
      // Strength PB: confronta exercise_name + category + weight_kg
      duplicate = merged.some(m => 
        m.type === 'strength' && 
        m.category === pb.category &&
        m.exercise_name === pb.exercise_name && 
        Math.abs(m.weight_kg - pb.weight_kg) < 0.5
      );
    }
    
    if (!duplicate) merged.push(pb);
  });
  return merged;
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
