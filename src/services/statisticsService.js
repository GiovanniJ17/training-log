/**
 * Statistics Service
 * Calcola metriche complesse per dashboard statistiche
 */

import { getWeek, getYear, format } from 'date-fns'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '../lib/firebase'

/**
 * Recupera tutte le sessioni e i record (estratti dai workout_sets) per il periodo indicato
 */
export async function getStatsData(startDate = null, endDate = null) {
  try {
    const rawEnd = endDate || new Date()
    const end = new Date(rawEnd)
    const start = startDate || new Date(rawEnd.getTime() - 90 * 24 * 60 * 60 * 1000)

    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(end, 'yyyy-MM-dd')

    const sessionsQuery = query(
      collection(firestore, 'training_sessions'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    )
    const [sessionsSnap, injuriesSnap, raceRecordsSnap, trainingRecordsSnap, strengthRecordsSnap] =
      await Promise.all([
        getDocs(sessionsQuery),
        getDocs(collection(firestore, 'injury_history')),
        getDocs(collection(firestore, 'race_records')),
        getDocs(collection(firestore, 'training_records')),
        getDocs(collection(firestore, 'strength_records'))
      ])

    const sessions = await Promise.all(
      sessionsSnap.docs.map(async (sessionDoc) => {
        const sessionData = { id: sessionDoc.id, ...sessionDoc.data(), workout_groups: [] }
        const groupsSnap = await getDocs(collection(sessionDoc.ref, 'workout_groups'))
        const groups = await Promise.all(
          groupsSnap.docs.map(async (groupDoc) => {
            const groupData = { id: groupDoc.id, ...groupDoc.data(), workout_sets: [] }
            const setsSnap = await getDocs(collection(groupDoc.ref, 'workout_sets'))
            groupData.workout_sets = setsSnap.docs.map((setDoc) => ({
              id: setDoc.id,
              ...setDoc.data()
            }))
            return groupData
          })
        )
        sessionData.workout_groups = groups
        return sessionData
      })
    )

    const injuriesData = injuriesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    const raceRecords = raceRecordsSnap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((record) => record.date >= startStr && record.date <= endStr)
    const trainingRecords = trainingRecordsSnap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((record) => record.date >= startStr && record.date <= endStr)
    const strengthRecords = strengthRecordsSnap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((record) => record.date >= startStr && record.date <= endStr)

    const isWarmup = (name) => {
      if (!name || typeof name !== 'string') return false
      return /riscald|warm\s?-?up|attivazione|drills/i.test(name)
    }

    const toDateKey = (value) => {
      if (!value) return ''
      const dateObj = new Date(value)
      if (Number.isNaN(dateObj.getTime())) return ''
      return format(dateObj, 'yyyy-MM-dd')
    }

    const buildRecordKey = (record) =>
      [
        record.session_id || '',
        record.date || record.created_at || '',
        record.distance_m || '',
        record.time_s || '',
        record.exercise_name || '',
        record.weight_kg || ''
      ].join('|')

    sessions.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

    const raceRecordKeys = new Set(raceRecords.map(buildRecordKey))
    const strengthRecordKeys = new Set(strengthRecords.map(buildRecordKey))

    sessions.forEach((session) => {
      const groups = session.workout_groups || []

      groups.forEach((group) => {
        const sets = group.workout_sets || []

        sets.forEach((set) => {
          const warmup = isWarmup(group?.name) || isWarmup(set?.exercise_name)
          const isTestFlag = Boolean(
            set?.details?.is_test ||
            set?.details?.is_pb_candidate ||
            session.type === 'gara' ||
            session.type === 'test'
          )
          const highIntensity =
            typeof set?.details?.intensity === 'number' ? set.details.intensity >= 7 : false
          const normalizedExercise =
            typeof set.exercise_name === 'string' ? set.exercise_name.trim().toLowerCase() : ''

          // Record corsa: includi solo set cronometrati non marcati come riscaldamento
          if (set.distance_m > 0 && set.time_s > 0 && !warmup) {
            if (isTestFlag || highIntensity || set.category === 'sprint') {
              // Keep session-linked race data for charts even if not PB
              const raceCandidate = {
                  id: set.id,
                  session_id: session.id,
                  date: toDateKey(session.date),
                  created_at: session.date,
                  distance_m: set.distance_m,
                  time_s: set.time_s,
                  is_personal_best: set.is_personal_best || false,
                  is_test: isTestFlag,
                  type: 'race'
              }
              const key = buildRecordKey(raceCandidate)
              if (!raceRecordKeys.has(key)) {
                raceRecords.push(raceCandidate)
                raceRecordKeys.add(key)
              }
            }
          }

          if (set.weight_kg > 0 && !warmup) {
            const strengthCandidate = {
                id: set.id,
                session_id: session.id,
                date: toDateKey(session.date),
                created_at: session.date,
                exercise_name: set.exercise_name,
                normalized_exercise_name: normalizedExercise || null,
                weight_kg: set.weight_kg,
                reps: set.reps,
                sets: set.sets,
                is_personal_best: set.is_personal_best || false,
                is_test: isTestFlag
            }
            const key = buildRecordKey(strengthCandidate)
            if (!strengthRecordKeys.has(key)) {
              strengthRecords.push(strengthCandidate)
              strengthRecordKeys.add(key)
            }
          }
        })
      })
    })

    return {
      success: true,
      data: {
        sessions,
        raceRecords,
        trainingRecords,
        strengthRecords,
        injuries: injuriesData || []
      }
    }
  } catch (error) {
    console.error('Errore nel recupero dati statistiche:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Calcola KPIs principali con separazione volume pista/sala
 */
export function calculateKPIs(sessions, raceRecords, strengthRecords, trainingRecords = []) {
  const stats = {
    totalSessions: sessions.length,
    totalVolume: 0,
    totalDistanceM: 0, // Volume pista (metri)
    totalTonnageKg: 0, // Volume sala (kg)
    avgRPE: 0,
    sessionsByType: {},
    pbCount:
      raceRecords.filter((r) => r.is_personal_best).length +
      trainingRecords.filter((t) => t.is_personal_best).length +
      strengthRecords.filter((s) => s.is_personal_best).length,
    streak: calculateStreak(sessions),
    // Nuovi campi separati
    volumeByCategory: {
      track: { distance_m: 0, sessions: 0 }, // Pista: solo distanza
      gym: { tonnage_kg: 0, sessions: 0 }, // Sala: solo tonnellaggio
      endurance: { distance_m: 0, sessions: 0 } // Strada: lunghi
    }
  }

  // Calcola volume totale (sessioni con distanza/durata)
  let totalRPE = 0
  let rpeCount = 0

  sessions.forEach((session) => {
    const type = session.type || 'altro'
    stats.sessionsByType[type] = (stats.sessionsByType[type] || 0) + 1

    if (session.rpe) {
      totalRPE += session.rpe
      rpeCount++
    }

    // Categorizza sessione per volume
    let sessionCategory = null
    if (type === 'pista' || type === 'gara' || type === 'test') {
      sessionCategory = 'track'
    } else if (type === 'palestra') {
      sessionCategory = 'gym'
    } else if (type === 'strada') {
      sessionCategory = 'endurance'
    }

    // Volume: somma distanza e tonnellaggio dai set annidati (SEPARATI)
    ;(session.workout_groups || []).forEach((group) => {
      ;(group.workout_sets || []).forEach((set) => {
        const setCount = set.sets || 1
        const reps = set.reps || 1

        // PISTA: solo sprint/jump (non riscaldamento lungo)
        if (set.category === 'sprint' || set.category === 'jump') {
          if (set.distance_m) {
            const volume = Number(set.distance_m || 0) * setCount
            stats.totalDistanceM += volume
            if (sessionCategory === 'track') {
              stats.volumeByCategory.track.distance_m += volume
            }
          }
        }

        // SALA: solo lift
        if (set.category === 'lift' && set.weight_kg) {
          const tonnage = Number(set.weight_kg || 0) * setCount * reps
          stats.totalTonnageKg += tonnage
          if (sessionCategory === 'gym') {
            stats.volumeByCategory.gym.tonnage_kg += tonnage
          }
        }

        // ENDURANCE: solo corsa lunga
        if (set.category === 'endurance' && set.distance_m) {
          const volume = Number(set.distance_m || 0) * setCount
          stats.totalDistanceM += volume // Aggiungi al totale generale
          if (sessionCategory === 'endurance') {
            stats.volumeByCategory.endurance.distance_m += volume
          }
        }
      })
    })

    // Conta sessioni per categoria
    if (sessionCategory) {
      stats.volumeByCategory[sessionCategory].sessions++
    }
  })

  stats.avgRPE = rpeCount > 0 ? (totalRPE / rpeCount).toFixed(1) : 0

  // Mantieni retrocompatibilità
  stats.volume = {
    distance_m: Math.round(stats.totalDistanceM),
    tonnage_kg: Math.round(stats.totalTonnageKg)
  }

  // Nuova struttura dettagliata
  stats.volumeDetailed = {
    track: {
      distance_m: Math.round(stats.volumeByCategory.track.distance_m),
      sessions: stats.volumeByCategory.track.sessions
    },
    gym: {
      tonnage_kg: Math.round(stats.volumeByCategory.gym.tonnage_kg),
      sessions: stats.volumeByCategory.gym.sessions
    },
    endurance: {
      distance_m: Math.round(stats.volumeByCategory.endurance.distance_m),
      sessions: stats.volumeByCategory.endurance.sessions
    }
  }

  return stats
}

/**
 * Calcola streak (giorni consecutivi di allenamento)
 */
function calculateStreak(sessions) {
  if (sessions.length === 0) return 0

  // Considera solo sessioni fino a oggi per la streak
  const today = new Date()
  const sortedDates = sessions
    .map((s) => new Date(s.date))
    .filter((d) => d <= today)
    .map((d) => d.getTime())
    .sort((a, b) => b - a)

  let streak = 1
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const diff = (sortedDates[i] - sortedDates[i + 1]) / (1000 * 60 * 60 * 24)
    if (Math.abs(diff - 1) < 0.1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/**
 * Prepara dati per grafico progressione tempi
 */
/**
 * Prepara dati per grafico progressione tempi (safe date handling)
 */
export function getProgressionChartData(raceRecords) {
  const recordsByDistance = {}

  raceRecords.forEach((record) => {
    const distance = record.distance_m
    if (!recordsByDistance[distance]) {
      recordsByDistance[distance] = []
    }
    recordsByDistance[distance].push(record)
  })

  const chartData = []

  Object.entries(recordsByDistance).forEach(([distance, records]) => {
    const sortedRecords = records.sort((a, b) => {
      const dateA = new Date(a.date || a.created_at).getTime() || 0
      const dateB = new Date(b.date || b.created_at).getTime() || 0
      return dateA - dateB
    })

    sortedRecords.forEach((record) => {
      const dateVal = record.date || record.created_at
      if (!dateVal) return // skip if missing date

      const key = `${distance}m`
      let item = chartData.find((d) => d.date === dateVal)
      if (!item) {
        item = { date: dateVal }
        chartData.push(item)
      }

      item[key] = parseFloat(record.time_s.toFixed(2))
    })
  })

  return chartData.sort((a, b) => {
    const da = new Date(a.date).getTime() || 0
    const db = new Date(b.date).getTime() || 0
    return da - db
  })
}

/**
 * Prepara dati per heatmap settimanale
 */
export function getWeeklyHeatmapData(sessions) {
  const weeklyData = {}

  sessions.forEach((session) => {
    const date = new Date(session.date)
    const year = getYear(date)
    const week = getWeek(date)
    const key = `${year}-W${week}`

    if (!weeklyData[key]) {
      weeklyData[key] = {
        week: key,
        sessionCount: 0,
        totalRPE: 0,
        rpeCount: 0,
        sessions: []
      }
    }

    weeklyData[key].sessionCount++
    weeklyData[key].sessions.push(session)
    if (session.rpe) {
      weeklyData[key].totalRPE += session.rpe
      weeklyData[key].rpeCount++
    }
  })

  // Calcola average RPE per settimana
  const heatmapData = Object.values(weeklyData).map((w) => ({
    week: w.week,
    sessionCount: w.sessionCount,
    avgRPE: w.rpeCount > 0 ? (w.totalRPE / w.rpeCount).toFixed(1) : 0,
    intensity: w.rpeCount > 0 ? Math.round((w.totalRPE / w.rpeCount / 10) * 100) : 0 // 0-100
  }))

  return heatmapData
}

/**
 * Calcola distribuzione tipi di allenamento
 */
export function getSessionTypeDistribution(sessions) {
  const distribution = {}

  sessions.forEach((session) => {
    const type = session.type || 'altro'
    distribution[type] = (distribution[type] || 0) + 1
  })

  return Object.entries(distribution).map(([type, count]) => ({
    name: type,
    value: count,
    percentage: ((count / sessions.length) * 100).toFixed(1)
  }))
}

/**
 * Calcola statistiche box plot per distanza
 */
export function getTimeSeriesStats(raceRecords, distance) {
  const recordsForDistance = raceRecords.filter((r) => r.distance_m === distance)

  if (recordsForDistance.length === 0) {
    return null
  }

  const times = recordsForDistance.map((r) => parseFloat(r.time_s)).sort((a, b) => a - b)
  const min = times[0]
  const max = times[times.length - 1]
  const q1 = times[Math.floor(times.length * 0.25)]
  const median = times[Math.floor(times.length * 0.5)]
  const q3 = times[Math.floor(times.length * 0.75)]

  return {
    distance,
    min: parseFloat(min.toFixed(2)),
    q1: parseFloat(q1.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    q3: parseFloat(q3.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    count: times.length
  }
}

/**
 * Prepara dati scatter plot RPE vs Performance
 */
export function getRPEPerformanceCorrelation(sessions, raceRecords) {
  const sessionMap = {}
  sessions.forEach((s) => {
    sessionMap[s.id] = s
  })

  const scatterData = raceRecords
    .filter((r) => {
      const session = sessionMap[r.session_id]
      return session && session.rpe
    })
    .map((r) => ({
      rpe: sessionMap[r.session_id].rpe,
      time: parseFloat(r.time_s.toFixed(2)),
      distance: r.distance_m,
      date: sessionMap[r.session_id].date
    }))

  return scatterData
}

/**
 * Calcola timeline infortuni con impatto su performance
 */
export function getInjuryTimeline(injuries, raceRecords) {
  return injuries
    .filter((inj) => inj.start_date)
    .map((inj) => {
      // Conta record durante l'infortunio
      const affectedRecords = raceRecords.filter((r) => {
        const rDate = new Date(r.date || r.created_at)
        const injStart = new Date(inj.start_date)
        const injEnd = inj.end_date ? new Date(inj.end_date) : new Date()
        return rDate >= injStart && rDate <= injEnd
      })

      return {
        injury_type: inj.injury_type,
        body_part: inj.body_part,
        start_date: inj.start_date,
        end_date: inj.end_date,
        severity: inj.severity,
        duration: inj.end_date
          ? Math.floor((new Date(inj.end_date) - new Date(inj.start_date)) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date() - new Date(inj.start_date)) / (1000 * 60 * 60 * 24)),
        affectedRecords: affectedRecords.length
      }
    })
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
}

/**
 * Calcola metriche mensili
 */
/**
 * Calcola metriche mensili (safe date handling)
 */
export function getMonthlyMetrics(sessions, raceRecords) {
  const monthlyData = {}

  raceRecords.forEach((record) => {
    const rawDate = record.date || record.created_at
    const dateObj = new Date(rawDate)

    if (!rawDate || Number.isNaN(dateObj.getTime())) {
      console.warn('Data non valida trovata in record:', record)
      return
    }

    const monthKey = format(dateObj, 'yyyy-MM')

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        times: [],
        count: 0
      }
    }

    monthlyData[monthKey].times.push(parseFloat(record.time_s))
    monthlyData[monthKey].count++
  })

  return Object.values(monthlyData)
    .map((m) => ({
      month: m.month,
      count: m.count,
      avg: (m.times.reduce((a, b) => a + b, 0) / m.times.length).toFixed(2),
      min: Math.min(...m.times).toFixed(2),
      max: Math.max(...m.times).toFixed(2)
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

const sprintDistances = [60, 100, 200]
const sprintTargetDistances = [60, 100, 200]

const sprintSessionTypes = new Set(['pista', 'gara', 'test'])

const getRecordTimestamp = (record) => {
  const rawDate = record.date || record.created_at
  if (!rawDate) return null
  const dateObj = new Date(rawDate)
  if (Number.isNaN(dateObj.getTime())) return null
  return dateObj
}

const getRecordDateKey = (record) => {
  const dateObj = getRecordTimestamp(record)
  if (!dateObj) return null
  return format(dateObj, 'yyyy-MM-dd')
}

const average = (values) => {
  if (!values.length) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

const standardDeviation = (values) => {
  if (!values.length) return null
  const avg = average(values)
  if (avg === null) return null
  const variance = average(values.map((value) => (value - avg) ** 2))
  return variance === null ? null : Math.sqrt(variance)
}

const getRecordKey = (record) => {
  const dateKey = getRecordDateKey(record) || ''
  return record.id || `${dateKey}|${record.distance_m || ''}|${record.time_s || ''}|${record.session_id || ''}`
}

const isSprintSession = (session) => {
  if (sprintSessionTypes.has(session.type)) return true
  return (session.workout_groups || []).some((group) =>
    (group.workout_sets || []).some((set) => set.category === 'sprint' || set.category === 'jump')
  )
}

const getSprintDistanceForSession = (session) => {
  let distance = 0
  ;(session.workout_groups || []).forEach((group) => {
    ;(group.workout_sets || []).forEach((set) => {
      if (set.category === 'sprint' || set.category === 'jump') {
        const setCount = set.sets || 1
        distance += Number(set.distance_m || 0) * setCount
      }
    })
  })
  return distance
}

const getDefaultSprintIntensity = (sessionType) => {
  if (sessionType === 'gara') return 8.5
  if (sessionType === 'test') return 8
  if (sessionType === 'pista') return 6.5
  return 5
}

const getSessionIntensityFallback = (session) => {
  const intensities = []
  ;(session.workout_groups || []).forEach((group) => {
    ;(group.workout_sets || []).forEach((set) => {
      if (typeof set?.details?.intensity === 'number') {
        intensities.push(set.details.intensity)
      }
    })
  })
  if (intensities.length) return average(intensities)
  return getDefaultSprintIntensity(session.type)
}

const buildDailySeries = (dailyMap, startDate, endDate) => {
  const series = []
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  while (cursor <= end) {
    const dateKey = format(cursor, 'yyyy-MM-dd')
    series.push({
      date: dateKey,
      ...dailyMap[dateKey],
      load: dailyMap[dateKey]?.load || 0,
      distance_m: dailyMap[dateKey]?.distance_m || 0,
      sessions: dailyMap[dateKey]?.sessions || 0
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return series
}

const computeEwma = (values, window) => {
  if (!values.length) return []
  const alpha = 1 / window
  const result = []
  let prev = values[0]
  values.forEach((value, index) => {
    if (index === 0) {
      prev = value
    } else {
      prev = prev + (value - prev) * alpha
    }
    result.push(prev)
  })
  return result
}

const normalizeSprintRecords = (raceRecords) => {
  const recordsByDate = new Map()
  raceRecords.forEach((record) => {
    const dateKey = getRecordDateKey(record)
    const distance = Number(record.distance_m)
    const time = Number(record.time_s)
    if (!dateKey || !distance || !time || time <= 0) return
    if (!recordsByDate.has(dateKey)) {
      recordsByDate.set(dateKey, new Map())
    }
    const distanceMap = recordsByDate.get(dateKey)
    const existing = distanceMap.get(distance)
    if (!existing || time < Number(existing.time_s)) {
      distanceMap.set(distance, record)
    }
  })

  const suspiciousKeys = new Set()
  const pairs = [
    [60, 100],
    [100, 200]
  ]

  recordsByDate.forEach((distanceMap) => {
    pairs.forEach(([shortDist, longDist]) => {
      const shortRecord = distanceMap.get(shortDist)
      const longRecord = distanceMap.get(longDist)
      if (!shortRecord || !longRecord) return
      const shortTime = Number(shortRecord.time_s)
      const longTime = Number(longRecord.time_s)
      if (shortTime >= longTime) {
        suspiciousKeys.add(getRecordKey(longRecord))
      }
    })
  })

  const normalizedRecords = raceRecords.filter((record) => !suspiciousKeys.has(getRecordKey(record)))
  return {
    normalizedRecords,
    removedCount: suspiciousKeys.size
  }
}

export function getSprintLoadModel(sessions) {
  if (!sessions.length) {
    return { series: [], current: null }
  }

  const sprintSessions = sessions.filter((session) => isSprintSession(session))
  if (!sprintSessions.length) {
    return { series: [], current: null }
  }

  const sorted = sprintSessions
    .map((session) => ({
      ...session,
      __date: getRecordTimestamp({ date: session.date })
    }))
    .filter((session) => session.__date)
    .sort((a, b) => a.__date - b.__date)

  if (!sorted.length) {
    return { series: [], current: null }
  }

  const dailyMap = {}
  sorted.forEach((session) => {
    const dateKey = format(session.__date, 'yyyy-MM-dd')
    const distance = getSprintDistanceForSession(session)
    const intensity =
      typeof session.rpe === 'number' ? session.rpe : getSessionIntensityFallback(session)
    const load = intensity * Math.max(1, distance / 100)

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { distance_m: 0, sessions: 0, load: 0, rpe_sum: 0, rpe_count: 0 }
    }
    dailyMap[dateKey].distance_m += distance
    dailyMap[dateKey].sessions += 1
    dailyMap[dateKey].load += load
    if (intensity) {
      dailyMap[dateKey].rpe_sum += intensity
      dailyMap[dateKey].rpe_count += 1
    }
  })

  const series = buildDailySeries(
    dailyMap,
    sorted[0].__date,
    sorted[sorted.length - 1].__date
  )
  const loads = series.map((day) => day.load || 0)
  const atl = computeEwma(loads, 7)
  const ctl = computeEwma(loads, 28)

  const merged = series.map((day, index) => ({
    ...day,
    atl: Number(atl[index].toFixed(2)),
    ctl: Number(ctl[index].toFixed(2)),
    tsb: Number((ctl[index] - atl[index]).toFixed(2))
  }))

  const current = merged.length ? merged[merged.length - 1] : null
  return { series: merged, current }
}

export function getSprintPeriodComparison(sessions, raceRecords) {
  const now = new Date()
  const lastStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const prevStart = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)

  const sprintSessions = sessions
    .map((session) => ({ ...session, __date: getRecordTimestamp({ date: session.date }) }))
    .filter((session) => session.__date && isSprintSession(session))

  const { normalizedRecords } = normalizeSprintRecords(raceRecords)
  const periodStats = (start, end) => {
    const periodSessions = sprintSessions.filter(
      (session) => session.__date >= start && session.__date < end
    )
    const distance = periodSessions.reduce(
      (sum, session) => sum + getSprintDistanceForSession(session),
      0
    )
    const rpeValues = periodSessions
      .map((session) =>
        typeof session.rpe === 'number' ? session.rpe : getSessionIntensityFallback(session)
      )
      .filter((value) => typeof value === 'number')
    const load = periodSessions.reduce((sum, session) => {
      const intensity =
        typeof session.rpe === 'number' ? session.rpe : getSessionIntensityFallback(session)
      const sessionDistance = getSprintDistanceForSession(session)
      return sum + intensity * Math.max(1, sessionDistance / 100)
    }, 0)

    const recordWindow = normalizedRecords
      .map((record) => ({ ...record, __date: getRecordTimestamp(record) }))
      .filter((record) => record.__date && record.__date >= start && record.__date < end)

    const bestByDistance = sprintTargetDistances.reduce((acc, distance) => {
      const times = recordWindow
        .filter((record) => Number(record.distance_m) === distance)
        .map((record) => Number(record.time_s))
        .filter((time) => time > 0)
      acc[distance] = times.length ? Math.min(...times) : null
      return acc
    }, {})

    return {
      sessions: periodSessions.length,
      distance_m: Math.round(distance),
      avg_rpe: rpeValues.length ? Number(average(rpeValues).toFixed(1)) : null,
      load: Number(load.toFixed(1)),
      pb_count: recordWindow.filter((record) => record.is_personal_best).length,
      bestByDistance
    }
  }

  const current = periodStats(lastStart, now)
  const previous = periodStats(prevStart, lastStart)

  const delta = (currentValue, previousValue) => {
    if (currentValue === null || previousValue === null) return null
    if (previousValue === 0) return null
    return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1))
  }

  return {
    current,
    previous,
    delta: {
      sessions: delta(current.sessions, previous.sessions),
      distance_m: delta(current.distance_m, previous.distance_m),
      avg_rpe: delta(current.avg_rpe, previous.avg_rpe),
      load: delta(current.load, previous.load),
      pb_count: delta(current.pb_count, previous.pb_count)
    }
  }
}

export function getTargetTimeBands(raceRecords) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const { normalizedRecords } = normalizeSprintRecords(raceRecords)

  return sprintTargetDistances.map((distance) => {
    const records = normalizedRecords
      .map((record) => ({ ...record, __date: getRecordTimestamp(record) }))
      .filter(
        (record) =>
          record.__date &&
          record.__date >= windowStart &&
          Number(record.distance_m) === distance &&
          Number(record.time_s) > 0
      )
      .sort((a, b) => a.__date - b.__date)

    const recent = records.slice(-8)
    const times = recent.map((record) => Number(record.time_s))
    if (times.length < 3) {
      return {
        distance_m: distance,
        target_s: null,
        low_s: null,
        high_s: null,
        samples: times.length
      }
    }

    const avg = average(times)
    const std = standardDeviation(times) || 0
    const best = Math.min(...times)
    const band = Math.max(0.02, std * 0.6)
    const low = Math.max(best * 0.98, avg - band)
    const high = avg + band

    return {
      distance_m: distance,
      target_s: Number(avg.toFixed(2)),
      low_s: Number(low.toFixed(2)),
      high_s: Number(high.toFixed(2)),
      samples: times.length
    }
  })
}

export function getSprinterSummary(sessions, raceRecords) {
  const now = new Date()
  const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const last28Start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const prev28Start = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000)

  const { normalizedRecords, removedCount } = normalizeSprintRecords(raceRecords)
  const recordsWithDates = normalizedRecords
    .map((record) => ({
      ...record,
      __date: getRecordTimestamp(record)
    }))
    .filter((record) => record.__date)

  const recentBestByDistance = sprintTargetDistances.reduce((acc, distance) => {
    const recentRecords = recordsWithDates.filter(
      (record) => Number(record.distance_m) === distance && record.__date >= last30Start
    )
    if (!recentRecords.length) {
      acc[distance] = null
      return acc
    }
    const best = recentRecords.reduce(
      (bestRecord, current) =>
        Number(current.time_s) < Number(bestRecord.time_s) ? current : bestRecord,
      recentRecords[0]
    )
    acc[distance] = Number(best.time_s)
    return acc
  }, {})

  const distanceRows = sprintDistances
    .map((distance) => {
      const recordsForDistance = recordsWithDates
        .filter((r) => Number(r.distance_m) === distance && Number(r.time_s) > 0)
        .sort((a, b) => a.__date - b.__date)

      if (!recordsForDistance.length) return null

      const bestRecord = recordsForDistance.reduce(
        (best, current) => (current.time_s < best.time_s ? current : best),
        recordsForDistance[0]
      )
      const recentRecord = recordsForDistance[recordsForDistance.length - 1]

      const last28 = recordsForDistance.filter((r) => r.__date >= last28Start)
      const prev28 = recordsForDistance.filter(
        (r) => r.__date >= prev28Start && r.__date < last28Start
      )
      const last28Avg = average(last28.map((r) => Number(r.time_s)))
      const prev28Avg = average(prev28.map((r) => Number(r.time_s)))
      const trend =
        last28Avg && prev28Avg
          ? ((last28Avg - prev28Avg) / prev28Avg) * 100
          : null

      return {
        distance_m: distance,
        best_time_s: Number(bestRecord.time_s),
        best_date: bestRecord.date || bestRecord.created_at,
        recent_time_s: Number(recentRecord.time_s),
        recent_date: recentRecord.date || recentRecord.created_at,
        change_percent: ((recentRecord.time_s - bestRecord.time_s) / bestRecord.time_s) * 100,
        trend_percent: trend
      }
    })
    .filter(Boolean)

  const bestTimes = distanceRows.reduce((acc, row) => {
    acc[row.distance_m] = row.best_time_s
    return acc
  }, {})

  const bestSpeedByDistance = Object.entries(bestTimes).reduce((acc, [distance, time]) => {
    const distNum = Number(distance)
    const timeNum = Number(time)
    if (distNum > 0 && timeNum > 0) {
      acc[distNum] = distNum / timeNum
    }
    return acc
  }, {})

  const maxVelocityMps = Object.values(bestSpeedByDistance).length
    ? Math.max(...Object.values(bestSpeedByDistance))
    : null

  const accelIndex =
    bestTimes[30] && bestTimes[60] ? Number((bestTimes[30] / bestTimes[60]).toFixed(2)) : null

  const rawSpeedReserve =
    bestSpeedByDistance[60] && bestSpeedByDistance[100]
      ? ((bestSpeedByDistance[60] - bestSpeedByDistance[100]) / bestSpeedByDistance[60]) * 100
      : null
  const speedReservePercent =
    rawSpeedReserve !== null && rawSpeedReserve >= 0 ? Number(rawSpeedReserve.toFixed(1)) : null

  const speedEndurance200 =
    bestTimes[100] && bestTimes[200]
      ? Number((bestTimes[200] / (2 * bestTimes[100])).toFixed(2))
      : null

  const consistencyByDistance = sprintTargetDistances.reduce((acc, distance) => {
    const times = recordsWithDates
      .filter((record) => Number(record.distance_m) === distance)
      .sort((a, b) => b.__date - a.__date)
      .slice(0, 8)
      .map((record) => Number(record.time_s))
      .filter((time) => time > 0)
    acc[distance] = times.length >= 3 ? Number(standardDeviation(times).toFixed(2)) : null
    return acc
  }, {})

  const pbCountLast30 = recordsWithDates.filter(
    (record) => record.is_personal_best && record.__date >= last30Start
  ).length

  const sessionQualityLast30 = sessions.filter((session) => {
    const dateObj = getRecordTimestamp({ date: session.date })
    if (!dateObj || dateObj < last30Start) return false
    if (session.type === 'gara' || session.type === 'test') return true
    if (session.rpe && session.rpe >= 8) return true

    return (session.workout_groups || []).some((group) =>
      (group.workout_sets || []).some((set) => {
        const intensity = set?.details?.intensity
        return Boolean(set?.details?.is_test || set?.details?.is_pb_candidate || intensity >= 7)
      })
    )
  }).length

  return {
    distanceRows,
    pbCountLast30,
    sessionQualityLast30,
    topSpeedMps: maxVelocityMps,
    speedEnduranceIndex: speedEndurance200,
    sprintMetrics: {
      recentBestByDistance,
      bestTimes,
      bestSpeedByDistance,
      maxVelocityMps,
      accelIndex,
      speedReservePercent,
      rawSpeedReserve,
      speedEndurance200,
      consistencyByDistance
    },
    dataQuality: {
      removedSuspiciousCount: removedCount
    }
  }
}

export function getSprintDataQuality(sessions, raceRecords, sprinterSummary) {
  const sprintSessions = sessions.filter((session) => isSprintSession(session))
  const missingRpe = sprintSessions.filter((session) => {
    const hasRpe = typeof session.rpe === 'number'
    const hasIntensity = (session.workout_groups || []).some((group) =>
      (group.workout_sets || []).some((set) => typeof set?.details?.intensity === 'number')
    )
    return !hasRpe && !hasIntensity
  })

  const raceRecordIssues = raceRecords.filter((record) => {
    const distance = Number(record.distance_m)
    const time = Number(record.time_s)
    const date = record.date || record.created_at
    if (!distance) return false
    if (!time || time <= 0) return true
    if (!date) return true
    return false
  })

  const rawReserve = sprinterSummary?.sprintMetrics?.rawSpeedReserve
  const negativeSpeedReserve = rawReserve !== null && rawReserve < 0
  const removedSuspicious = sprinterSummary?.dataQuality?.removedSuspiciousCount || 0

  const issues = []
  if (removedSuspicious > 0) {
    issues.push({
      id: 'normalized-records',
      message: `${removedSuspicious} risultati esclusi per tempi incoerenti (es. 60m >= 100m).`,
      severity: 'warning'
    })
  }
  if (missingRpe.length) {
    issues.push({
      id: 'missing-intensity',
      message: `${missingRpe.length} sessioni sprint senza RPE o intensità. Load stimato.`,
      severity: 'info'
    })
  }
  if (raceRecordIssues.length) {
    issues.push({
      id: 'race-records',
      message: `${raceRecordIssues.length} record gara con tempo o data non validi.`,
      severity: 'warning'
    })
  }
  if (negativeSpeedReserve) {
    issues.push({
      id: 'speed-reserve',
      message: 'Speed reserve negativo: verifica tempi 60m/100m.',
      severity: 'warning'
    })
  }

  return {
    issues,
    missingIntensityCount: missingRpe.length,
    invalidRaceRecords: raceRecordIssues.length
  }
}

/**
 * Esporta dati in CSV
 */
export function exportToCSV(sessions, raceRecords, fileName = 'training-stats.csv') {
  let csv = 'Data,Tipo,RPE,Distanza,Tempo,PB\n'

  const sessionMap = {}
  sessions.forEach((s) => {
    sessionMap[s.id] = s
  })

  raceRecords.forEach((record) => {
    const session = sessionMap[record.session_id]
    if (session) {
      csv += `${session.date},${session.type},${session.rpe || ''},${record.distance_m},${record.time_s},${record.is_personal_best ? 'Si' : 'No'}\n`
    }
  })

  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv))
  element.setAttribute('download', fileName)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}
