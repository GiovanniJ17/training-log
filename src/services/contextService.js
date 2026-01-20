/**
 * Context Service - RAG Pattern for AI
 * Recupera contesto storico e PB per rendere l'AI context-aware
 */

import { supabase } from '../lib/supabase';

/**
 * Recupera il contesto dell'atleta per migliorare il parsing AI
 * Include: PB attuali, ultime sessioni, infortuni attivi, pattern ricorrenti
 */
export async function getAthleteContext() {
  try {
    const context = {
      personalBests: await getPersonalBests(),
      recentSessions: await getRecentSessionTitles(5),
      activeInjuries: await getActiveInjuries(),
      commonPatterns: await getCommonExercisePatterns(),
    };

    return formatContextForAI(context);
  } catch (error) {
    console.error('[contextService] Error fetching context:', error);
    return ''; // Ritorna stringa vuota se fallisce, non bloccare il parsing
  }
}

/**
 * Recupera i Personal Bests attuali (top 5 per categoria)
 */
async function getPersonalBests() {
  const pbs = {
    sprint: [],
    strength: [],
  };

  // PB Sprint (usando le views o workout_sets direttamente)
  const { data: sprintPBs } = await supabase
    .from('workout_sets')
    .select(`
      distance_m,
      time_s,
      workout_groups!inner(
        training_sessions!inner(date)
      )
    `)
    .eq('category', 'sprint')
    .eq('is_personal_best', true)
    .not('distance_m', 'is', null)
    .not('time_s', 'is', null)
    .order('distance_m', { ascending: true })
    .limit(10);

  if (sprintPBs) {
    // Raggruppa per distanza e prendi il migliore
    const byDistance = {};
    sprintPBs.forEach(pb => {
      if (!byDistance[pb.distance_m] || pb.time_s < byDistance[pb.distance_m].time_s) {
        byDistance[pb.distance_m] = pb;
      }
    });
    pbs.sprint = Object.values(byDistance).slice(0, 5);
  }

  // PB Forza (usando workout_sets)
  const { data: strengthPBs } = await supabase
    .from('workout_sets')
    .select(`
      exercise_name,
      weight_kg,
      reps,
      workout_groups!inner(
        training_sessions!inner(date)
      )
    `)
    .eq('category', 'lift')
    .eq('is_personal_best', true)
    .not('weight_kg', 'is', null)
    .order('weight_kg', { ascending: false })
    .limit(10);

  if (strengthPBs) {
    // Raggruppa per esercizio e prendi il migliore (più pesante)
    const byExercise = {};
    strengthPBs.forEach(pb => {
      const key = pb.exercise_name.toLowerCase();
      if (!byExercise[key] || pb.weight_kg > byExercise[key].weight_kg) {
        byExercise[key] = pb;
      }
    });
    pbs.strength = Object.values(byExercise).slice(0, 5);
  }

  return pbs;
}

/**
 * Recupera i titoli delle ultime N sessioni per pattern recognition
 */
async function getRecentSessionTitles(limit = 5) {
  const { data } = await supabase
    .from('training_sessions')
    .select('date, title, type')
    .order('date', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Recupera infortuni attivi (senza end_date)
 */
async function getActiveInjuries() {
  const { data } = await supabase
    .from('injury_history')
    .select('injury_type, body_part, severity, start_date')
    .is('end_date', null)
    .order('start_date', { ascending: false });

  return data || [];
}

/**
 * Recupera pattern comuni di esercizi (es. "solito riscaldamento")
 * Trova gli esercizi più frequenti per tipo di sessione
 */
async function getCommonExercisePatterns() {
  // Query per trovare i 3 esercizi più comuni nel riscaldamento
  const { data: warmupData } = await supabase
    .from('workout_sets')
    .select(`
      exercise_name,
      workout_groups!inner(name)
    `)
    .ilike('workout_groups.name', '%riscald%')
    .limit(50);

  if (!warmupData || warmupData.length === 0) return { warmup: [] };

  // Conta frequenza esercizi
  const frequency = {};
  warmupData.forEach(item => {
    const name = item.exercise_name.toLowerCase();
    frequency[name] = (frequency[name] || 0) + 1;
  });

  // Prendi i top 3
  const topWarmup = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return { warmup: topWarmup };
}

/**
 * Formatta il contesto in una stringa leggibile per l'AI
 */
function formatContextForAI(context) {
  const lines = [];

  lines.push('=== ATHLETE CONTEXT (Use this to interpret ambiguous data) ===');
  lines.push('');

  // Personal Bests
  if (context.personalBests.sprint.length > 0) {
    lines.push('CURRENT SPRINT PBs:');
    context.personalBests.sprint.forEach(pb => {
      lines.push(`  - ${pb.distance_m}m: ${pb.time_s}s (set on ${pb.workout_groups.training_sessions.date})`);
    });
    lines.push('');
  }

  if (context.personalBests.strength.length > 0) {
    lines.push('CURRENT STRENGTH PBs:');
    context.personalBests.strength.forEach(pb => {
      const repsInfo = pb.reps > 1 ? ` x${pb.reps} reps` : '';
      lines.push(`  - ${pb.exercise_name}: ${pb.weight_kg}kg${repsInfo} (set on ${pb.workout_groups.training_sessions.date})`);
    });
    lines.push('');
  }

  // Recent sessions
  if (context.recentSessions.length > 0) {
    lines.push('RECENT SESSIONS (last 5):');
    context.recentSessions.forEach(session => {
      lines.push(`  - ${session.date}: ${session.title || session.type}`);
    });
    lines.push('');
  }

  // Active injuries - CRITICAL for safety
  if (context.activeInjuries.length > 0) {
    lines.push('⚠️ ACTIVE INJURIES (consider when interpreting high loads):');
    context.activeInjuries.forEach(injury => {
      lines.push(`  - ${injury.body_part}: ${injury.injury_type} (${injury.severity}, since ${injury.start_date})`);
    });
    lines.push('');
  }

  // Common patterns
  if (context.commonPatterns.warmup.length > 0) {
    lines.push('STANDARD WARMUP (if user says "solito riscaldamento"):');
    context.commonPatterns.warmup.forEach(exercise => {
      lines.push(`  - ${exercise}`);
    });
    lines.push('');
  }

  lines.push('=== END CONTEXT ===');
  lines.push('');

  return lines.join('\n');
}

/**
 * Calcola se un tempo/peso è sospetto (potenziale errore)
 * Es: 100m in 9s (impossibile), Squat 300kg per un amatore
 */
export function detectAnomalies(parsedData, context) {
  const warnings = [];

  parsedData.groups?.forEach(group => {
    group.sets?.forEach(set => {
      // Anomalia tempo: 100m in meno di 9.5s (record mondiale circa 9.58)
      if (set.distance_m === 100 && set.time_s && set.time_s < 9.5) {
        warnings.push({
          type: 'impossible_time',
          field: 'time_s',
          value: set.time_s,
          exercise: set.exercise_name,
          message: `100m in ${set.time_s}s sembra impossibile. Record mondiale ~9.58s. Intendevi 60m o ${set.time_s + 10}s?`,
        });
      }

      // Anomalia peso: verifica vs PB esistente (es: squat 200kg quando PB è 120kg)
      if (set.weight_kg && context?.personalBests?.strength) {
        const pbForExercise = context.personalBests.strength.find(
          pb => pb.exercise_name.toLowerCase() === set.exercise_name.toLowerCase()
        );
        
        if (pbForExercise && set.weight_kg > pbForExercise.weight_kg * 1.5) {
          warnings.push({
            type: 'unusual_load',
            field: 'weight_kg',
            value: set.weight_kg,
            exercise: set.exercise_name,
            message: `${set.exercise_name} ${set.weight_kg}kg è +${Math.round((set.weight_kg / pbForExercise.weight_kg - 1) * 100)}% rispetto al PB (${pbForExercise.weight_kg}kg). Verifica il dato.`,
          });
        }
      }
    });
  });

  return warnings;
}
