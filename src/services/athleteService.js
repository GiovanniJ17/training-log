import { supabase } from '../lib/supabase';

/**
 * Recupera il profilo atleta
 */
export async function getAthleteProfile() {
  try {
    const { data, error } = await supabase
      .from('athlete_profile')
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nel recupero profilo atleta:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiorna il profilo atleta
 */
export async function updateAthleteProfile(updates) {
  try {
    // Prendi il primo profilo (monoutente)
    const { data: profile, error: fetchError } = await supabase
      .from('athlete_profile')
      .select('id')
      .limit(1)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('athlete_profile')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiornamento profilo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera i PB in gara
 */
export async function getRaceRecords() {
  try {
    const { data, error } = await supabase
      .from('race_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nel recupero race records:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiungi un record di gara
 */
export async function addRaceRecord(sessionId, raceData) {
  try {
    const { data, error } = await supabase
      .from('race_records')
      .insert([{
        session_id: sessionId,
        distance_m: raceData.distance_m,
        time_s: raceData.time_s,
        rpe: raceData.rpe || null,
        location: raceData.location || null,
        competition_name: raceData.competition_name || null,
        notes: raceData.notes || null,
        is_personal_best: raceData.is_personal_best || false,
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiunta race record:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera i PB di allenamento (sprint, salti, ecc.)
 */
export async function getTrainingRecords() {
  try {
    const { data, error } = await supabase
      .from('training_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nel recupero training records:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiungi un record di allenamento
 */
export async function addTrainingRecord(sessionId, trainingData) {
  try {
    const { data, error } = await supabase
      .from('training_records')
      .insert([{
        session_id: sessionId,
        exercise_name: trainingData.exercise_name,
        exercise_type: trainingData.exercise_type, // 'sprint', 'jump', 'throw', 'endurance'
        performance_value: trainingData.performance_value,
        performance_unit: trainingData.performance_unit, // 'seconds', 'meters', 'reps', 'kg'
        rpe: trainingData.rpe || null,
        notes: trainingData.notes || null,
        is_personal_best: trainingData.is_personal_best || false,
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiunta training record:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera i massimali di forza
 */
export async function getStrengthRecords() {
  try {
    const { data, error } = await supabase
      .from('strength_records')
      .select('*')
      .order('category', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nel recupero strength records:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera i massimali per categoria
 */
export async function getStrengthRecordsByCategory(category) {
  try {
    const { data, error } = await supabase
      .from('strength_records')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nel recupero strength records per categoria:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiungi un massimale di forza
 */
export async function addStrengthRecord(sessionId, strengthData) {
  try {
    const { data, error } = await supabase
      .from('strength_records')
      .insert([{
        session_id: sessionId,
        exercise_name: strengthData.exercise_name,
        category: strengthData.category,
        weight_kg: strengthData.weight_kg,
        reps: strengthData.reps || 1,
        notes: strengthData.notes || null,
        is_personal_best: strengthData.is_personal_best || false,
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiunta strength record:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera storico infortuni
 */
export async function getInjuryHistory() {
  try {
    const { data, error } = await supabase
      .from('injury_history')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nel recupero injury history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiungi un infortunio
 */
export async function addInjury(injuryData) {
  try {
    const { data, error } = await supabase
      .from('injury_history')
      .insert([{
        injury_type: injuryData.injury_type,
        body_part: injuryData.body_part,
        start_date: injuryData.start_date,
        end_date: injuryData.end_date || null,
        severity: injuryData.severity, // 'minor', 'moderate', 'severe'
        cause_session_id: injuryData.cause_session_id || null,
        notes: injuryData.notes || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiunta infortunio:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Risolvi un infortunio (aggiungi end_date)
 */
export async function resolveInjury(injuryId, endDate) {
  try {
    const { data, error } = await supabase
      .from('injury_history')
      .update({
        end_date: endDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', injuryId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nella risoluzione infortunio:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera PB personali dalle tabelle dedicate (ottimizzato)
 * 
 * Legge direttamente dalle tabelle race_records, strength_records, training_records
 * invece di ricalcolare scansionando i workout_sets.
 * 
 * Vantaggi:
 * - Molto più veloce (legge da tabelle con indici)
 * - Preciso (usa i dati ufficiali con flag is_personal_best)
 * - Mantiene separazione tra record ufficiali e allenamenti
 */
export async function getPersonalBests() {
  try {
    // Recuperando PB dalle tabelle dedicate
    
    // Leggi dai tre record type in parallelo
    const [raceResult, trainingResult, strengthResult] = await Promise.all([
      getRaceRecords(),
      getTrainingRecords(),
      getStrengthRecords()
    ]);

    if (!raceResult.success || !trainingResult.success || !strengthResult.success) {
      throw new Error('Errore nel recupero uno o più tipi di PB');
    }

    // Filtra solo i record con is_personal_best = true
    const raceRecords = (raceResult.data || []).filter(r => r.is_personal_best);
    const trainingRecords = (trainingResult.data || []).filter(t => t.is_personal_best);
    const strengthRecords = (strengthResult.data || []).filter(s => s.is_personal_best);

    return {
      success: true,
      data: {
        raceRecords,
        trainingRecords,
        strengthRecords,
      },
    };
  } catch (error) {
    console.error('Errore nel recupero PB personali:', error);
    // Fallback: tenta il metodo legacy se c'è un errore
    console.warn('[athleteService] Fallback a getPersonalBestsFromWorkoutSets()');
    return await getPersonalBestsFromWorkoutSets();
  }
}

/**
 * Recupera i Personal Best analizzando workout_sets (LEGACY)
 * 
 * DEPRECATO: Usato solo come fallback in getPersonalBests() se fallisce la lettura
 * dalle tabelle dedicate.
 * 
 * Questo metodo è lento perché scansiona TUTTI i workout_sets e ricalcola i PB al volo.
 * Preferibilmente usa getPersonalBests() che legge dalle tabelle dedicate.
 * 
 * Manteniamo questa funzione come fallback per compatibilità.
 */
export async function getPersonalBestsFromWorkoutSets() {
  try {
    // Recupera tutti i workout_sets con categoria sprint/jump/lift
    const { data: workoutSets, error } = await supabase
      .from('workout_sets')
      .select(`
        *,
        workout_groups!inner(
          session_id,
          training_sessions!inner(
            id,
            date,
            type
          )
        )
      `)
      .in('category', ['sprint', 'jump', 'lift'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Raggruppa per categoria e trova i migliori
    const sprintPBs = [];
    const jumpPBs = [];
    const strengthPBs = [];

    // Traccia i migliori per ogni combinazione di esercizio/distanza
    const bestSprints = {};
    const bestJumps = {};
    const bestLifts = {};

    workoutSets?.forEach(set => {
      const session = set.workout_groups?.training_sessions;
      
      if (set.category === 'sprint' && set.distance_m && set.time_s) {
        const key = `${set.exercise_name}_${set.distance_m}m`;
        if (!bestSprints[key] || set.time_s < bestSprints[key].time_s) {
          bestSprints[key] = {
            ...set,
            session_date: session?.date,
            session_type: session?.type,
          };
        }
      } else if (set.category === 'jump' && set.distance_m) {
        const key = set.exercise_name;
        if (!bestJumps[key] || set.distance_m > bestJumps[key].distance_m) {
          bestJumps[key] = {
            ...set,
            session_date: session?.date,
            session_type: session?.type,
          };
        }
      } else if (set.category === 'lift' && set.weight_kg) {
        const key = set.exercise_name;
        if (!bestLifts[key] || set.weight_kg > bestLifts[key].weight_kg) {
          bestLifts[key] = {
            ...set,
            session_date: session?.date,
            session_type: session?.type,
          };
        }
      }
    });

    // Converti in array per compatibilità con UI esistente
    const raceRecords = Object.values(bestSprints).map(pb => ({
      id: pb.id,
      distance_m: pb.distance_m,
      time_s: pb.time_s,
      exercise_name: pb.exercise_name,
      notes: pb.notes,
      is_personal_best: true,
      training_sessions: [{ date: pb.session_date, type: pb.session_type }]
    }));

    const trainingRecords = Object.values(bestJumps).map(pb => ({
      id: pb.id,
      exercise_name: pb.exercise_name,
      exercise_type: 'jump',
      performance_value: pb.distance_m,
      performance_unit: 'meters',
      notes: pb.notes,
      is_personal_best: true,
      training_sessions: [{ date: pb.session_date, type: pb.session_type }]
    }));

    const strengthRecords = Object.values(bestLifts).map(pb => ({
      id: pb.id,
      exercise_name: pb.exercise_name,
      category: 'lift',
      weight_kg: pb.weight_kg,
      reps: pb.reps || 1,
      notes: pb.notes,
      is_personal_best: true,
      training_sessions: [{ date: pb.session_date, type: pb.session_type }]
    }));

    // PB caricati correttamente

    return {
      success: true,
      data: {
        raceRecords,
        trainingRecords,
        strengthRecords,
      },
    };
  } catch (error) {
    console.error('Errore nel recupero PB da workout_sets:', error);
    return { success: false, error: error.message };
  }
}
