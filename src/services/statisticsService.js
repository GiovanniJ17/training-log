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
 * Recupera tutte le sessioni e record per il periodo specificato
 */
export async function getStatsData(startDate = null, endDate = null) {
  try {
    // Default: ultimi 3 mesi
    const rawEnd = endDate || new Date();
    const end = new Date(rawEnd); // Solo fino a oggi (niente futuro)
    const start = startDate || new Date(rawEnd.getTime() - 90 * 24 * 60 * 60 * 1000);

    console.log('[statisticsService] range', {
      start: start.toISOString(),
      end: end.toISOString(),
      rawEnd: rawEnd.toISOString(),
    });

    // Prendi tutti i dati e filtra lato client per evitare problemi di join/alias
    const [sessionsRes, raceRes, strengthRes, injuriesRes] = await Promise.all([
      supabase.from('training_sessions').select('*').order('date', { ascending: true }),
      supabase.from('race_records').select('*, training_sessions(id, date)'),
      supabase.from('strength_records').select('*, training_sessions(id, date)'),
      supabase.from('injury_history').select('*'),
    ]);

    if (sessionsRes.error || raceRes.error || strengthRes.error || injuriesRes.error) {
      console.error('[statisticsService] Query error', { sessionsRes, raceRes, strengthRes, injuriesRes });
      throw sessionsRes.error || raceRes.error || strengthRes.error || injuriesRes.error;
    }

    const inRange = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= start && d <= end;
    };

    const sessions = (sessionsRes.data || []).filter(s => inRange(s.date));
    const getLinkedDate = (rec) => rec?.training_sessions?.[0]?.date || rec?.training_sessions?.date || rec?.created_at;
    const raceRecords = (raceRes.data || []).filter(r => inRange(getLinkedDate(r)));
    const strengthRecords = (strengthRes.data || []).filter(r => inRange(getLinkedDate(r)));
    const injuries = injuriesRes.data || [];

    console.log('[statisticsService] counts', {
      sessions: sessions.length,
      raceRecords: raceRecords.length,
      strengthRecords: strengthRecords.length,
      injuries: injuries.length,
      sessionIds: sessions.map(s => ({ id: s.id, date: s.date })),
      raceIds: raceRecords.map(r => ({ id: r.id, session: r.session_id, date: getLinkedDate(r) })),
      strengthIds: strengthRecords.map(r => ({ id: r.id, session: r.session_id, date: getLinkedDate(r) })),
      injuryIds: injuries.map(i => ({ id: i.id, start: i.start_date, end: i.end_date })),
    });

    return {
      success: true,
      data: {
        sessions,
        raceRecords,
        strengthRecords,
        injuries,
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
export function calculateKPIs(sessions, raceRecords, strengthRecords) {
  const stats = {
    totalSessions: sessions.length,
    totalVolume: 0,
    avgRPE: 0,
    sessionsByType: {},
    pbCount: raceRecords.filter(r => r.is_personal_best).length,
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
  });

  stats.avgRPE = rpeCount > 0 ? (totalRPE / rpeCount).toFixed(1) : 0;

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
      const dateA = a.training_sessions?.[0]?.date || a.created_at;
      const dateB = b.training_sessions?.[0]?.date || b.created_at;
      return new Date(dateA) - new Date(dateB);
    });

    sortedRecords.forEach((record, idx) => {
      const date = record.training_sessions?.[0]?.date || record.created_at;
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
        const rDate = new Date(r.created_at);
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
    const date = new Date(record.created_at);
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
