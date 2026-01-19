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
 * Recupera PB personali (i migliori di ogni categoria)
 */
export async function getPersonalBests() {
  try {
    // Recupera i record senza JOIN prima
    const [raceResult, trainingResult, strengthResult, sessionsResult] = await Promise.all([
      supabase.from('race_records').select('*').eq('is_personal_best', true).order('id', { ascending: false }),
      supabase.from('training_records').select('*').eq('is_personal_best', true).order('id', { ascending: false }),
      supabase.from('strength_records').select('*').eq('is_personal_best', true).order('id', { ascending: false }),
      supabase.from('training_sessions').select('id, date'),
    ]);

    if (raceResult.error || trainingResult.error || strengthResult.error || sessionsResult.error) {
      console.error('[athleteService] Query error:', { 
        raceResult: raceResult.error, 
        trainingResult: trainingResult.error, 
        strengthResult: strengthResult.error,
        sessionsResult: sessionsResult.error 
      });
      throw raceResult.error || trainingResult.error || strengthResult.error || sessionsResult.error;
    }

    // Crea un mappa di sessioni per lookup veloce
    const sessionsMap = {};
    if (sessionsResult.data) {
      sessionsResult.data.forEach(session => {
        sessionsMap[session.id] = session;
      });
    }

    // Arricchisci i record con i dati della sessione
    const enrichedRaceRecords = raceResult.data.map(record => ({
      ...record,
      training_sessions: sessionsMap[record.session_id] ? [sessionsMap[record.session_id]] : []
    }));

    const enrichedTrainingRecords = trainingResult.data.map(record => ({
      ...record,
      training_sessions: sessionsMap[record.session_id] ? [sessionsMap[record.session_id]] : []
    }));

    const enrichedStrengthRecords = strengthResult.data.map(record => ({
      ...record,
      training_sessions: sessionsMap[record.session_id] ? [sessionsMap[record.session_id]] : []
    }));

    console.log('[athleteService] Race records caricati:', enrichedRaceRecords);
    
    return {
      success: true,
      data: {
        raceRecords: enrichedRaceRecords,
        trainingRecords: enrichedTrainingRecords,
        strengthRecords: enrichedStrengthRecords,
      },
    };
  } catch (error) {
    console.error('Errore nel recupero PB personali:', error);
    return { success: false, error: error.message };
  }
}
