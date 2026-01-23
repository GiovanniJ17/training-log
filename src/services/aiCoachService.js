/**
 * AI Coach Service
 * Genera insight testuali e stime "what-if" usando il worker Gemini già in uso
 */

const MODEL = 'gemini-2.5-flash'
const DEFAULT_WORKER_URL =
  'https://us-central1-tracker-velocista.cloudfunctions.net/aiProxy'

// Schemi di output attesi per forzare JSON valido dal worker
const WEEKLY_INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    positive: { type: 'string' },
    warning: { type: 'string' },
    advice: { type: 'string' }
  },
  required: ['positive', 'warning', 'advice']
}

const ADAPTIVE_SCHEMA = {
  type: 'object',
  properties: {
    signal: { type: 'string' },
    suggestion: { type: 'string' },
    recovery: { type: 'string' }
  },
  required: ['signal', 'suggestion', 'recovery']
}

function getWorkerUrl() {
  return import.meta.env.VITE_WORKER_URL || DEFAULT_WORKER_URL
}

function buildRequest(prompt, { schema } = {}) {
  const base = {
    provider: 'gemini',
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Sei un coach di atletica esperto. Rispondi in italiano, tono tecnico ma conciso.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4
  }

  const withSchema = schema ? { ...base, responseSchema: schema } : base

  if (import.meta.env.MODE !== 'production') {
    return { ...withSchema, apiKey: import.meta.env.VITE_GEMINI_API_KEY }
  }

  return withSchema
}

async function callAI(prompt, { schema } = {}) {
  const workerUrl = getWorkerUrl()
  const requestBody = buildRequest(prompt, { schema })
  console.log('[aiCoachService] Env mode:', import.meta.env.MODE)
  console.log('[aiCoachService] Worker URL:', getWorkerUrl())

  // Implementa timeout di sicurezza (15 secondi max)
  const controller = new AbortController()
  let timeoutId // Dichiara prima del try per accesso nel catch

  timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[aiCoachService] Worker error response:', response.status, text)
      throw new Error(`Worker error: ${response.status} - ${text.slice(0, 100)}`)
    }

    const data = await response.json()
    clearTimeout(timeoutId) // Cancella il timeout se completato con successo
    // Response ricevuta

    const content = (data?.choices?.[0]?.message?.content || '').trim()

    // Prova a parsare JSON diretto o dentro code fence
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const payload = jsonMatch ? jsonMatch[1].trim() : content

    if (!schema) return payload

    try {
      return JSON.parse(payload)
    } catch (parseErr) {
      console.error('[aiCoachService] JSON parse error:', parseErr, 'Content:', payload)
      throw new Error(`JSON parse error: ${parseErr.message}`)
    }
  } catch (fetchErr) {
    clearTimeout(timeoutId) // Cancella il timeout in caso di errore

    // Gestisci errore di timeout specificamente
    if (fetchErr.name === 'AbortError') {
      console.error('[aiCoachService] Timeout error - request took too long (>15s)')
      throw new Error(
        'La richiesta ha impiegato troppo tempo. Controlla la tua connessione e riprova.'
      )
    }

    console.error('[aiCoachService] Fetch error:', fetchErr.message)
    throw fetchErr
  }
}

function summarizeVolume(sessions = []) {
  let distance = 0
  let tonnage = 0

  sessions.forEach((session) => {
    ;(session.workout_groups || []).forEach((group) => {
      ;(group.workout_sets || []).forEach((set) => {
        const setCount = set.sets || 1
        const reps = set.reps || 1
        if (set.distance_m) {
          distance += Number(set.distance_m || 0) * setCount
        }
        if (set.weight_kg) {
          tonnage += Number(set.weight_kg || 0) * setCount * reps
        }
      })
    })
  })

  return { distance_m: Math.round(distance), tonnage_kg: Math.round(tonnage) }
}

function bestTimesByDistance(raceRecords = [], limit = 5) {
  const grouped = {}
  raceRecords.forEach((r) => {
    const distance = r.distance_m
    if (!grouped[distance]) grouped[distance] = []
    grouped[distance].push(r)
  })

  return Object.entries(grouped).map(([distance, records]) => {
    const sorted = records
      .slice()
      .sort((a, b) => (a.time_s || 0) - (b.time_s || 0))
      .slice(0, limit)
      .map((r) => ({ date: r.date || r.created_at, time_s: Number(r.time_s) }))
    return { distance: Number(distance), best: sorted }
  })
}

function recentPbs(raceRecords = [], maxItems = 6) {
  return raceRecords
    .filter((r) => r.is_personal_best)
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, maxItems)
    .map((r) => ({
      distance_m: r.distance_m,
      time_s: Number(r.time_s),
      date: r.date || r.created_at
    }))
}

export async function getWeeklyInsight({
  sessions = [],
  raceRecords = [],
  strengthRecords = [],
  kpis = {}
}) {
  if (!sessions.length && !raceRecords.length) {
    return { success: false, error: 'Non ci sono dati sufficienti per generare un insight.' }
  }

  const sortedSessions = sessions
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-12)
    .map((s) => ({ date: s.date, type: s.type, rpe: s.rpe, title: s.title }))

  const volume = kpis?.volume || summarizeVolume(sessions)
  const pbs = recentPbs(raceRecords)
  const bestTimes = bestTimesByDistance(raceRecords, 4)
  const strengthPeaks = strengthRecords
    .filter((s) => s.exercise_name)
    .reduce((acc, set) => {
      const key = (set.exercise_name || '').trim().toLowerCase()
      const maxWeight = Math.max(acc[key]?.maxWeight || 0, Number(set.weight_kg || 0))
      acc[key] = { exercise: key, maxWeight, lastDate: set.date || set.created_at }
      return acc
    }, {})

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
Tono: tecnico, sintetico, italiano.`

  try {
    const data = await callAI(prompt, { schema: WEEKLY_INSIGHT_SCHEMA })
    return { success: true, data }
  } catch (error) {
    console.error('[AI Coach] insight error', error)
    return { success: false, error: error.message }
  }
}

function estimateExponent(baseDistance, targetDistance) {
  const max = Math.max(baseDistance, targetDistance)
  if (max <= 200) return 1.03
  if (max <= 400) return 1.05
  return 1.06
}

function chooseBasePB(recentPbs = [], targetDistance) {
  if (!recentPbs.length) return null
  const scored = recentPbs
    .filter((r) => r.distance_m && r.time_s)
    .map((r) => ({
      ...r,
      score: Math.abs(Number(r.distance_m) - Number(targetDistance))
    }))
    .sort((a, b) => a.score - b.score)
  return scored[0] || null
}

export async function getWhatIfPrediction({
  target_distance_m,
  base_distance_m,
  base_time_s,
  recent_pbs = []
}) {
  const targetDistance = Number(target_distance_m)
  if (!targetDistance) {
    return { success: false, error: 'Seleziona la distanza target.' }
  }

  let baseDistance = Number(base_distance_m)
  let baseTime = Number(base_time_s)

  if (!baseDistance || !baseTime) {
    const fallback = chooseBasePB(recent_pbs, targetDistance)
    if (!fallback) {
      return { success: false, error: 'Serve un PB recente per calcolare la stima.' }
    }
    baseDistance = Number(fallback.distance_m)
    baseTime = Number(fallback.time_s)
  }

  if (!baseDistance || !baseTime) {
    return { success: false, error: 'Inserisci distanza e tempo di riferimento.' }
  }

  const exponent = estimateExponent(baseDistance, targetDistance)
  const ratio = targetDistance / baseDistance
  const estimate = baseTime * Math.pow(ratio, exponent)
  let rangePct = 0.03
  if (ratio >= 1.5 || ratio <= 0.7) rangePct = 0.06
  if (ratio >= 2) rangePct = 0.08

  const low = estimate * (1 - rangePct)
  const high = estimate * (1 + rangePct)

  const explanation = `Stima basata sul PB ${baseDistance}m in ${baseTime.toFixed(2)}s e una curva di potenza (esponente ${exponent}). Range ±${Math.round(rangePct * 100)}% per variazioni di forma, condizioni e distanza.`

  return {
    success: true,
    data: {
      estimate_s: Number(estimate.toFixed(2)),
      low_s: Number(low.toFixed(2)),
      high_s: Number(high.toFixed(2)),
      explanation,
      base_distance_m: baseDistance,
      base_time_s: Number(baseTime.toFixed(2))
    }
  }
}

export async function getAdaptiveWorkoutSuggestion({
  recentSessions = [],
  upcomingFocus = '',
  raceRecords = []
}) {
  if (!recentSessions.length) {
    return { success: false, error: 'Servono almeno alcune sessioni recenti.' }
  }

  const sorted = recentSessions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)
    .map((s) => ({ date: s.date, type: s.type, rpe: s.rpe, title: s.title, notes: s.notes }))

  const recentTimes = raceRecords
    .slice()
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, 10)
    .map((r) => ({
      distance_m: r.distance_m,
      time_s: Number(r.time_s),
      date: r.date || r.created_at,
      rpe: null
    }))

  const prompt = `Suggerisci modifica allenamento se l'atleta sembra affaticato.
Sessioni recenti: ${JSON.stringify(sorted)}
Tempi recenti: ${JSON.stringify(recentTimes)}
Focus richiesto: ${upcomingFocus || 'non specificato'}
Rispondi in JSON: {
  "signal": "cosa hai notato (stanchezza, trend)",
  "suggestion": "come adattare la prossima sessione (breve schema)",
  "recovery": "un consiglio di recupero"
}
Tono tecnico, sintetico, italiano.`

  try {
    const data = await callAI(prompt, { schema: ADAPTIVE_SCHEMA })
    return { success: true, data }
  } catch (error) {
    console.error('[AI Coach] adaptive error', error)
    return { success: false, error: error.message }
  }
}
