/**
 * Proactive Coach Service
 * Sistema di alert automatici per prevenire infortuni e sovraccarico
 * 
 * Features:
 * - Detect volume spikes (>20% week-over-week)
 * - Monitor injury risk zones (carico + infortunio attivo)
 * - Suggest deload weeks
 * - Track recovery patterns
 */

import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';

/**
 * Analizza lo stato dell'atleta e genera alert proattivi
 */
export async function generateProactiveAlerts() {
  const alerts = [];

  try {
    // 1. Check volume spike (settimana corrente vs settimana scorsa)
    const volumeAlert = await checkVolumeSpikeAlert();
    if (volumeAlert) alerts.push(volumeAlert);

    // 2. Check carico con infortunio attivo
    const injuryAlert = await checkActiveInjuryLoadAlert();
    if (injuryAlert) alerts.push(injuryAlert);

    // 3. Check necessità deload (3+ settimane ad alta intensità)
    const deloadAlert = await checkDeloadAlert();
    if (deloadAlert) alerts.push(deloadAlert);

    // 4. Check pattern recupero insufficiente
    const recoveryAlert = await checkRecoveryPatternAlert();
    if (recoveryAlert) alerts.push(recoveryAlert);

    return alerts;
  } catch (error) {
    console.error('[proactiveCoach] Error generating alerts:', error);
    return [];
  }
}

/**
 * Alert: Incremento volume settimanale > 20%
 */
async function checkVolumeSpikeAlert() {
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(thisWeekStart, 1);

  const [thisWeekData, lastWeekData] = await Promise.all([
    getWeeklyVolume(thisWeekStart),
    getWeeklyVolume(lastWeekStart)
  ]);

  if (!lastWeekData.totalVolume || lastWeekData.totalVolume === 0) {
    return null; // Prima settimana, niente confronto
  }

  const increase = ((thisWeekData.totalVolume - lastWeekData.totalVolume) / lastWeekData.totalVolume) * 100;

  if (increase > 20) {
    return {
      type: 'volume_spike',
      severity: increase > 40 ? 'high' : 'medium',
      title: '⚠️ Aumento volume eccessivo',
      message: `Il volume di questa settimana è aumentato del ${Math.round(increase)}% rispetto alla scorsa (${Math.round(thisWeekData.totalVolume)}m vs ${Math.round(lastWeekData.totalVolume)}m). Rischio infortunio elevato.`,
      recommendation: 'Considera di ridurre il volume del 10-15% nei prossimi 2-3 giorni o inserire una sessione di scarico.',
      data: {
        currentWeek: thisWeekData,
        lastWeek: lastWeekData,
        increase: Math.round(increase)
      }
    };
  }

  return null;
}

/**
 * Alert: Carico elevato con infortunio attivo nella zona coinvolta
 */
async function checkActiveInjuryLoadAlert() {
  // Recupera infortuni attivi
  const { data: injuries } = await supabase
    .from('injury_history')
    .select('*')
    .is('end_date', null);

  if (!injuries || injuries.length === 0) return null;

  // Recupera sessioni dell'ultima settimana
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const { data: sessions } = await supabase
    .from('training_sessions')
    .select(`
      *,
      workout_groups (
        *,
        workout_sets (*)
      )
    `)
    .gte('date', weekStart.toISOString())
    .order('date', { ascending: false });

  if (!sessions || sessions.length === 0) return null;

  // Check se c'è carico pesante su zona infortunata
  const riskyExercises = [];
  
  sessions.forEach(session => {
    session.workout_groups?.forEach(group => {
      group.workout_sets?.forEach(set => {
        injuries.forEach(injury => {
          const bodyPart = injury.body_part.toLowerCase();
          const exerciseName = set.exercise_name.toLowerCase();
          
          // Mapping body parts -> esercizi
          const riskyMappings = {
            'ginocchio': ['squat', 'lunge', 'affondi', 'sprint', 'salto'],
            'schiena': ['deadlift', 'stacco', 'squat', 'row'],
            'spalla': ['bench', 'panca', 'press', 'overhead'],
            'tendine': ['sprint', 'salto', 'jump'],
          };
          
          const riskyKeywords = riskyMappings[bodyPart] || [];
          const isRisky = riskyKeywords.some(keyword => exerciseName.includes(keyword));
          
          if (isRisky && (set.weight_kg > 100 || set.category === 'sprint')) {
            riskyExercises.push({
              exercise: set.exercise_name,
              injury: injury.body_part,
              severity: injury.severity,
              sessionDate: session.date
            });
          }
        });
      });
    });
  });

  if (riskyExercises.length > 0) {
    return {
      type: 'injury_risk',
      severity: 'high',
      title: '🚨 Carico su zona infortunata',
      message: `Hai eseguito ${riskyExercises.length} esercizio/i ad alto carico con un infortunio attivo (${injuries[0].body_part}).`,
      recommendation: `Evita carichi pesanti su ${injuries[0].body_part} fino a guarigione completa. Considera esercizi a basso impatto o terapia.`,
      data: {
        riskyExercises,
        activeInjuries: injuries
      }
    };
  }

  return null;
}

/**
 * Alert: Deload necessario (3+ settimane consecutive ad alta intensità)
 */
async function checkDeloadAlert() {
  const weeks = 4;
  const weeksData = [];
  
  for (let i = 0; i < weeks; i++) {
    const weekStart = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
    const data = await getWeeklyVolume(weekStart);
    weeksData.push(data);
  }

  // Check se ultime 3 settimane hanno RPE medio > 7
  const lastThreeWeeks = weeksData.slice(0, 3);
  const highIntensityWeeks = lastThreeWeeks.filter(w => w.avgRPE > 7).length;

  if (highIntensityWeeks >= 3) {
    return {
      type: 'deload_needed',
      severity: 'medium',
      title: '💪 Tempo di scarico',
      message: `Hai completato ${highIntensityWeeks} settimane consecutive ad alta intensità (RPE medio > 7).`,
      recommendation: 'Pianifica una settimana di scarico (volume -40%, intensità -20%) per ottimizzare il recupero e prevenire sovrallenamento.',
      data: {
        weeksData: lastThreeWeeks
      }
    };
  }

  return null;
}

/**
 * Alert: Pattern recupero insufficiente (sessioni consecutive senza riposo)
 */
async function checkRecoveryPatternAlert() {
  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('date, rpe')
    .gte('date', subWeeks(new Date(), 2).toISOString())
    .order('date', { ascending: false });

  if (!sessions || sessions.length < 5) return null;

  // Cerca streak di giorni consecutivi
  const dates = sessions.map(s => new Date(s.date).getTime()).sort((a, b) => b - a);
  let consecutiveDays = 1;
  let maxStreak = 1;

  for (let i = 0; i < dates.length - 1; i++) {
    const diff = (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
    if (Math.abs(diff - 1) < 0.1) {
      consecutiveDays++;
      maxStreak = Math.max(maxStreak, consecutiveDays);
    } else {
      consecutiveDays = 1;
    }
  }

  if (maxStreak >= 6) {
    return {
      type: 'recovery_needed',
      severity: 'medium',
      title: '😴 Recupero insufficiente',
      message: `Hai allenato per ${maxStreak} giorni consecutivi senza riposo completo.`,
      recommendation: 'Inserisci almeno 1 giorno di riposo totale ogni 5-6 giorni di allenamento per ottimizzare il recupero muscolare.',
      data: {
        consecutiveDays: maxStreak
      }
    };
  }

  return null;
}

/**
 * Helper: Calcola volume settimanale
 */
async function getWeeklyVolume(weekStart) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const { data: sessions } = await supabase
    .from('training_sessions')
    .select(`
      *,
      workout_groups (
        *,
        workout_sets (*)
      )
    `)
    .gte('date', weekStart.toISOString())
    .lte('date', weekEnd.toISOString());

  if (!sessions || sessions.length === 0) {
    return { totalVolume: 0, totalTonnage: 0, avgRPE: 0, sessionCount: 0 };
  }

  let totalDistance = 0;
  let totalTonnage = 0;
  let totalRPE = 0;
  let rpeCount = 0;

  sessions.forEach(session => {
    if (session.rpe) {
      totalRPE += session.rpe;
      rpeCount++;
    }

    session.workout_groups?.forEach(group => {
      group.workout_sets?.forEach(set => {
        if (set.distance_m) {
          totalDistance += set.distance_m * (set.sets || 1);
        }
        if (set.weight_kg) {
          totalTonnage += set.weight_kg * (set.sets || 1) * (set.reps || 1);
        }
      });
    });
  });

  return {
    totalVolume: totalDistance,
    totalTonnage,
    avgRPE: rpeCount > 0 ? totalRPE / rpeCount : 0,
    sessionCount: sessions.length
  };
}

/**
 * Salva alert nel database (per tracking storico)
 */
export async function saveAlert(alert) {
  // TODO: Implementa tabella 'coach_alerts' nel DB per storico
  console.log('[proactiveCoach] Alert generated:', alert);
  return alert;
}
