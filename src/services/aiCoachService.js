/**
 * AI Coach Service
 * Genera insight testuali e stime "what-if" usando il worker Gemini già in uso
 */

const MODEL = 'gemini-2.5-flash';
const DEFAULT_WORKER_URL = 'http://localhost:5000';

function getWorkerUrl() {
  if (import.meta.env.MODE === 'production') {
    return import.meta.env.VITE_WORKER_URL || 'https://training-log-ai-proxy.giovanni-jecha.workers.dev';
  }
  return DEFAULT_WORKER_URL;
}

function buildRequest(prompt, { json = true } = {}) {
  const base = {
    provider: 'gemini',
    model: MODEL,
    messages: [
      { role: 'system', content: 'Sei un coach di atletica esperto. Rispondi in italiano, tono tecnico ma conciso.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
  };

  const withFormat = json ? { ...base, responseFormat: { type: 'json_object' } } : base;
  if (import.meta.env.MODE !== 'production') {
    return { ...withFormat, apiKey: import.meta.env.VITE_GEMINI_API_KEY };
  }
  return withFormat;
}

async function callAI(prompt, { json = true } = {}) {
  const workerUrl = getWorkerUrl();
  const requestBody = buildRequest(prompt, { json });

  // Chiamata al worker

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[aiCoachService] Worker error response:', response.status, text);
      throw new Error(`Worker error: ${response.status} - ${text.slice(0, 100)}`);
    }

    const data = await response.json();
    // Response ricevuta
    
    let content = data?.choices?.[0]?.message?.content || '';
    if (!json) return content?.trim();

    try {
      // Estrai JSON da markdown code blocks se presente
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
        // JSON estratto da markdown
      }

      const parsed = JSON.parse(content);
      // JSON parsato
      return parsed;
    } catch (parseErr) {
      console.error('[aiCoachService] JSON parse error:', parseErr, 'Content:', content);
      throw new Error(`JSON parse error: ${parseErr.message}`);
    }
  } catch (fetchErr) {
    console.error('[aiCoachService] Fetch error:', fetchErr.message);
    throw fetchErr;
  }
}

function summarizeVolume(sessions = []) {
  let distance = 0;
  let tonnage = 0;

  sessions.forEach(session => {
    (session.workout_groups || []).forEach(group => {
      (group.workout_sets || []).forEach(set => {
        const setCount = set.sets || 1;
        const reps = set.reps || 1;
        if (set.distance_m) {
          distance += Number(set.distance_m || 0) * setCount;
        }
        if (set.weight_kg) {
          tonnage += Number(set.weight_kg || 0) * setCount * reps;
        }
      });
    });
  });

  return { distance_m: Math.round(distance), tonnage_kg: Math.round(tonnage) };
}

function bestTimesByDistance(raceRecords = [], limit = 5) {
  const grouped = {};
  raceRecords.forEach(r => {
    const distance = r.distance_m;
    if (!grouped[distance]) grouped[distance] = [];
    grouped[distance].push(r);
  });

  return Object.entries(grouped).map(([distance, records]) => {
    const sorted = records
      .slice()
      .sort((a, b) => (a.time_s || 0) - (b.time_s || 0))
      .slice(0, limit)
      .map(r => ({ date: r.date || r.created_at, time_s: Number(r.time_s) }));
    return { distance: Number(distance), best: sorted };
  });
}

function recentPbs(raceRecords = [], maxItems = 6) {
  return raceRecords
    .filter(r => r.is_personal_best)
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, maxItems)
    .map(r => ({ distance_m: r.distance_m, time_s: Number(r.time_s), date: r.date || r.created_at }));
}

export async function getWeeklyInsight({ sessions = [], raceRecords = [], strengthRecords = [], kpis = {}, progressionData = [] }) {
  if (!sessions.length && !raceRecords.length) {
    return { success: false, error: 'Non ci sono dati sufficienti per generare un insight.' };
  }

  const sortedSessions = sessions
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-12)
    .map(s => ({ date: s.date, type: s.type, rpe: s.rpe, title: s.title }));

  const volume = kpis?.volume || summarizeVolume(sessions);
  const pbs = recentPbs(raceRecords);
  const bestTimes = bestTimesByDistance(raceRecords, 4);
  const strengthPeaks = strengthRecords
    .filter(s => s.exercise_name)
    .reduce((acc, set) => {
      const key = (set.exercise_name || '').trim().toLowerCase();
      const maxWeight = Math.max(acc[key]?.maxWeight || 0, Number(set.weight_kg || 0));
      acc[key] = { exercise: key, maxWeight, lastDate: set.date || set.created_at };
      return acc;
    }, {});

  const prompt = `Riassumi la settimana di un velocista.
Dati:
- Sessioni recenti: ${JSON.stringify(sortedSessions)}
- KPI: ${JSON.stringify(kpis)}
- Volume: ${JSON.stringify(volume)}
- Personal best recenti: ${JSON.stringify(pbs)}
- Migliori tempi per distanza: ${JSON.stringify(bestTimes)}
- Picchi forza: ${JSON.stringify(Object.values(strengthPeaks))}
Regole risposta JSON con chiavi: {
  "positive": "1 frase su cosa va bene",
  "warning": "1 frase su rischio/fatica/infortunio",
  "advice": "1 frase di focus per la prossima settimana"
}
Tono: tecnico, sintetico, italiano.`;

  try {
    const data = await callAI(prompt, { json: true });
    return { success: true, data };
  } catch (error) {
    console.error('[AI Coach] insight error', error);
    return { success: false, error: error.message };
  }
}

export async function getWhatIfPrediction({ distance_m, target_weight, exercise_name, raceRecords = [], strengthRecords = [] }) {
  if (!distance_m || !target_weight || !exercise_name) {
    return { success: false, error: 'Compila distanza, esercizio e peso target.' };
  }

  const target = (exercise_name || '').toLowerCase();

  const races = raceRecords
    .filter(r => r.distance_m === Number(distance_m))
    .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at))
    .slice(-20)
    .map(r => ({ date: r.date || r.created_at, time_s: Number(r.time_s), pb: !!r.is_personal_best }));

  const lifts = strengthRecords
    .filter(s => {
      const norm = (s.normalized_exercise_name || '').toLowerCase();
      const raw = (s.exercise_name || '').toLowerCase();
      return norm.includes(target) || raw.includes(target);
    })
    .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at))
    .slice(-30)
    .map(s => ({ date: s.date || s.created_at, weight_kg: Number(s.weight_kg), reps: s.reps, sets: s.sets }));

  const prompt = `Stima what-if per velocista.
Distanza bersaglio: ${distance_m}m
Esercizio forza: ${exercise_name}
Peso target: ${target_weight} kg
Storico tempi distanza: ${JSON.stringify(races)}
Storico forza esercizio: ${JSON.stringify(lifts)}
Rispondi in JSON: {
  "projection": "stima tempo atteso se raggiunge il peso target",
  "rationale": "breve spiegazione delle correlazioni osservate",
  "caution": "avvertimento su rischi o limiti della stima"
}
Tono tecnico, italiano, sintetico (max 2 frasi per campo).`;

  try {
    const data = await callAI(prompt, { json: true });
    return { success: true, data };
  } catch (error) {
    console.error('[AI Coach] what-if error', error);
    return { success: false, error: error.message };
  }
}

export async function getAdaptiveWorkoutSuggestion({ recentSessions = [], upcomingFocus = '', raceRecords = [] }) {
  if (!recentSessions.length) {
    return { success: false, error: 'Servono almeno alcune sessioni recenti.' };
  }

  const sorted = recentSessions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)
    .map(s => ({ date: s.date, type: s.type, rpe: s.rpe, title: s.title, notes: s.notes }));

  const recentTimes = raceRecords
    .slice()
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, 10)
    .map(r => ({ distance_m: r.distance_m, time_s: Number(r.time_s), date: r.date || r.created_at, rpe: null }));

  const prompt = `Suggerisci modifica allenamento se l'atleta sembra affaticato.
Sessioni recenti: ${JSON.stringify(sorted)}
Tempi recenti: ${JSON.stringify(recentTimes)}
Focus richiesto: ${upcomingFocus || 'non specificato'}
Rispondi in JSON: {
  "signal": "cosa hai notato (stanchezza, trend)",
  "suggestion": "come adattare la prossima sessione (breve schema)",
  "recovery": "un consiglio di recupero"
}
Tono tecnico, sintetico, italiano.`;

  try {
    const data = await callAI(prompt, { json: true });
    return { success: true, data };
  } catch (error) {
    console.error('[AI Coach] adaptive error', error);
    return { success: false, error: error.message };
  }
}
