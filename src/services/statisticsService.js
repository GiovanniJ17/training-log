/**
 * Statistics Service
 * Calcola metriche complesse per dashboard statistiche
 */

import { createClient } from '@supabase/supabase-js';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getWeek, getYear, format } from 'date-fns';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Recupera tutte le sessioni e i record (estratti dai workout_sets) per il periodo indicato
 */
export async function getStatsData(startDate = null, endDate = null) {
  try {
    const rawEnd = endDate || new Date();
    const end = new Date(rawEnd);
    const start = startDate || new Date(rawEnd.getTime() - 90 * 24 * 60 * 60 * 1000);

    console.log('[statisticsService] range', {
      start: start.toISOString(),
      end: end.toISOString(),
      rawEnd: rawEnd.toISOString(),
    });

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('training_sessions')
      .select(`
        *,
        workout_groups (
          *,
          workout_sets (*)
        )
      `)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString())
      .order('date', { ascending: true });

    const { data: injuriesData, error: injuriesError } = await supabase
      .from('injury_history')
      .select('*');

    if (sessionsError || injuriesError) {
      console.error('[statisticsService] Query error', { sessionsError, injuriesError });
      throw sessionsError || injuriesError;
    }

    const sessions = sessionsData || [];
    const raceRecords = [];
    const strengthRecords = [];
    const trainingRecords = [];

    const isWarmup = (name) => {
      if (!name || typeof name !== 'string') return false;
      return /riscald|warm\s?-?up|attivazione|drills/i.test(name);
    };

    sessions.forEach(session => {
      const groups = session.workout_groups || [];

      groups.forEach(group => {
        const sets = group.workout_sets || [];

        sets.forEach(set => {
          const warmup = isWarmup(group?.name) || isWarmup(set?.exercise_name);
          const isTestFlag = Boolean(
            set?.details?.is_test ||
            set?.details?.is_pb_candidate ||
            session.type === 'gara' ||
            session.type === 'test'
          );
          const highIntensity = typeof set?.details?.intensity === 'number' ? set.details.intensity >= 7 : false;
          const normalizedExercise = typeof set.exercise_name === 'string' ? set.exercise_name.trim().toLowerCase() : '';

          // Record corsa: includi solo set cronometrati non marcati come riscaldamento
          if (set.distance_m > 0 && set.time_s > 0 && !warmup) {
            if (isTestFlag || highIntensity || set.category === 'sprint') {
              raceRecords.push({
                id: set.id,
                session_id: session.id,
                date: session.date,
                created_at: session.date,
                distance_m: set.distance_m,
                time_s: set.time_s,
                is_personal_best: set.details?.is_personal_best || false,
                is_test: isTestFlag,
                type: 'race',
              });
            }
          }

          // Record forza: includi set con peso, ignora warmup leggero
          if (set.weight_kg > 0 && !warmup) {
            strengthRecords.push({
              id: set.id,
              session_id: session.id,
              date: session.date,
              created_at: session.date,
              exercise_name: set.exercise_name,
              normalized_exercise_name: normalizedExercise || null,
              weight_kg: set.weight_kg,
              reps: set.reps,
              sets: set.sets,
              is_personal_best: set.details?.is_personal_best || false,
              is_test: isTestFlag,
            });
          }
        });
      });
    });

    console.log('[statisticsService] counts', {
      sessions: sessions.length,
      raceRecords: raceRecords.length,
      strengthRecords: strengthRecords.length,
      injuries: (injuriesData || []).length,
    });

    return {
      success: true,
      data: {
        sessions,
        raceRecords,
        trainingRecords,
        strengthRecords,
        injuries: injuriesData || [],
      },
    };
  } catch (error) {
    console.error('Errore nel recupero dati statistiche:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calcola KPI principali
 */
export function calculateKPIs(sessions, raceRecords, strengthRecords, trainingRecords = []) {
  const stats = {
    totalSessions: sessions.length,
    totalVolume: 0,
    totalDistanceM: 0,
    totalTonnageKg: 0,
    avgRPE: 0,
    sessionsByType: {},
    pbCount: (raceRecords.filter(r => r.is_personal_best).length) + (trainingRecords.filter(t => t.is_personal_best).length),
    streak: calculateStreak(sessions),
  };

  // Calcola volume totale (sessioni con distanza/durata)
  let totalRPE = 0;
  let rpeCount = 0;

  sessions.forEach(session => {
    const type = session.type || 'altro';
    stats.sessionsByType[type] = (stats.sessionsByType[type] || 0) + 1;

    if (session.rpe) {
      totalRPE += session.rpe;
      rpeCount++;
    }

    // Volume: somma distanza e tonnellaggio dai set annidati
    (session.workout_groups || []).forEach(group => {
      (group.workout_sets || []).forEach(set => {
        const setCount = set.sets || 1;
        const reps = set.reps || 1;
        if (set.distance_m) {
          stats.totalDistanceM += Number(set.distance_m || 0) * setCount;
        }
        if (set.weight_kg) {
          stats.totalTonnageKg += Number(set.weight_kg || 0) * setCount * reps;
        }
      });
    });
  });

  stats.avgRPE = rpeCount > 0 ? (totalRPE / rpeCount).toFixed(1) : 0;
  stats.volume = {
    distance_m: Math.round(stats.totalDistanceM),
    tonnage_kg: Math.round(stats.totalTonnageKg),
  };

  return stats;
}

/**
 * Calcola streak (giorni consecutivi di allenamento)
 */
function calculateStreak(sessions) {
  if (sessions.length === 0) return 0;

  // Considera solo sessioni fino a oggi per la streak
  const today = new Date();
  const sortedDates = sessions
    .map(s => new Date(s.date))
    .filter(d => d <= today)
    .map(d => d.getTime())
    .sort((a, b) => b - a);

  let streak = 1;
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const diff = (sortedDates[i] - sortedDates[i + 1]) / (1000 * 60 * 60 * 24);
    if (Math.abs(diff - 1) < 0.1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Prepara dati per grafico progressione tempi
 */
export function getProgressionChartData(raceRecords) {
  const recordsByDistance = {};

  raceRecords.forEach(record => {
    const distance = record.distance_m;
    if (!recordsByDistance[distance]) {
      recordsByDistance[distance] = [];
    }
    recordsByDistance[distance].push(record);
  });

  // Per ogni distanza, ordina per data e prepara i dati
  const chartData = [];

  Object.entries(recordsByDistance).forEach(([distance, records]) => {
    const sortedRecords = records.sort((a, b) => {
      const dateA = a.date || a.created_at;
      const dateB = b.date || b.created_at;
      return new Date(dateA) - new Date(dateB);
    });

    sortedRecords.forEach((record, idx) => {
      const date = record.date || record.created_at;
      const key = `${distance}m`;

      let item = chartData.find(d => d.date === date);
      if (!item) {
        item = { date };
        chartData.push(item);
      }

      item[key] = parseFloat(record.time_s.toFixed(2));
    });
  });

  return chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Prepara dati per heatmap settimanale
 */
export function getWeeklyHeatmapData(sessions) {
  const weeklyData = {};

  sessions.forEach(session => {
    const date = new Date(session.date);
    const year = getYear(date);
    const week = getWeek(date);
    const key = `${year}-W${week}`;

    if (!weeklyData[key]) {
      weeklyData[key] = {
        week: key,
        sessionCount: 0,
        totalRPE: 0,
        rpeCount: 0,
        sessions: [],
      };
    }

    weeklyData[key].sessionCount++;
    weeklyData[key].sessions.push(session);
    if (session.rpe) {
      weeklyData[key].totalRPE += session.rpe;
      weeklyData[key].rpeCount++;
    }
  });

  // Calcola average RPE per settimana
  const heatmapData = Object.values(weeklyData).map(w => ({
    week: w.week,
    sessionCount: w.sessionCount,
    avgRPE: w.rpeCount > 0 ? (w.totalRPE / w.rpeCount).toFixed(1) : 0,
    intensity: w.rpeCount > 0 ? Math.round((w.totalRPE / w.rpeCount) / 10 * 100) : 0, // 0-100
  }));

  return heatmapData;
}

/**
 * Calcola distribuzione tipi di allenamento
 */
export function getSessionTypeDistribution(sessions) {
  const distribution = {};

  sessions.forEach(session => {
    const type = session.type || 'altro';
    distribution[type] = (distribution[type] || 0) + 1;
  });

  return Object.entries(distribution).map(([type, count]) => ({
    name: type,
    value: count,
    percentage: ((count / sessions.length) * 100).toFixed(1),
  }));
}

/**
 * Calcola statistiche box plot per distanza
 */
export function getTimeSeriesStats(raceRecords, distance) {
  const recordsForDistance = raceRecords.filter(r => r.distance_m === distance);

  if (recordsForDistance.length === 0) {
    return null;
  }

  const times = recordsForDistance.map(r => parseFloat(r.time_s)).sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const q1 = times[Math.floor(times.length * 0.25)];
  const median = times[Math.floor(times.length * 0.5)];
  const q3 = times[Math.floor(times.length * 0.75)];

  return {
    distance,
    min: parseFloat(min.toFixed(2)),
    q1: parseFloat(q1.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    q3: parseFloat(q3.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    count: times.length,
  };
}

/**
 * Prepara dati scatter plot RPE vs Performance
 */
export function getRPEPerformanceCorrelation(sessions, raceRecords) {
  const sessionMap = {};
  sessions.forEach(s => {
    sessionMap[s.id] = s;
  });

  const scatterData = raceRecords
    .filter(r => {
      const session = sessionMap[r.session_id];
      return session && session.rpe;
    })
    .map(r => ({
      rpe: sessionMap[r.session_id].rpe,
      time: parseFloat(r.time_s.toFixed(2)),
      distance: r.distance_m,
      date: sessionMap[r.session_id].date,
    }));

  return scatterData;
}

/**
 * Calcola timeline infortuni con impatto su performance
 */
export function getInjuryTimeline(injuries, raceRecords) {
  return injuries
    .filter(inj => inj.start_date)
    .map(inj => {
      // Conta record durante l'infortunio
      const affectedRecords = raceRecords.filter(r => {
        const rDate = new Date(r.date || r.created_at);
        const injStart = new Date(inj.start_date);
        const injEnd = inj.end_date ? new Date(inj.end_date) : new Date();
        return rDate >= injStart && rDate <= injEnd;
      });

      return {
        injury_type: inj.injury_type,
        body_part: inj.body_part,
        start_date: inj.start_date,
        end_date: inj.end_date,
        severity: inj.severity,
        duration: inj.end_date
          ? Math.floor((new Date(inj.end_date) - new Date(inj.start_date)) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date() - new Date(inj.start_date)) / (1000 * 60 * 60 * 24)),
        affectedRecords: affectedRecords.length,
      };
    })
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
}

/**
 * Calcola metriche mensili
 */
export function getMonthlyMetrics(sessions, raceRecords) {
  const monthlyData = {};

  raceRecords.forEach(record => {
    const rawDate = record.date || record.created_at;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const monthKey = format(date, 'yyyy-MM');

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        times: [],
        count: 0,
      };
    }

    monthlyData[monthKey].times.push(parseFloat(record.time_s));
    monthlyData[monthKey].count++;
  });

  return Object.values(monthlyData)
    .map(m => ({
      month: m.month,
      count: m.count,
      avg: (m.times.reduce((a, b) => a + b, 0) / m.times.length).toFixed(2),
      min: Math.min(...m.times).toFixed(2),
      max: Math.max(...m.times).toFixed(2),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Esporta dati in CSV
 */
export function exportToCSV(sessions, raceRecords, fileName = 'training-stats.csv') {
  let csv = 'Data,Tipo,RPE,Distanza,Tempo,PB\n';

  const sessionMap = {};
  sessions.forEach(s => {
    sessionMap[s.id] = s;
  });

  raceRecords.forEach(record => {
    const session = sessionMap[record.session_id];
    if (session) {
      csv += `${session.date},${session.type},${session.rpe || ''},${record.distance_m},${record.time_s},${record.is_personal_best ? 'Si' : 'No'}\n`;
    }
  });

  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
  element.setAttribute('download', fileName);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
