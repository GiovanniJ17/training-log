import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { standardizeTrainingSession } from '../utils/standardizer.js';

/**
 * Saves a complete training session to database with cascade insert
 * Applies data standardization (exercise names, times, recovery durations) before saving
 * @param {Object} parsedData - Parsed training session object with session, groups, and sets
 * @returns {Promise<Object>} Saved session data with ID
 * @throws {Error} If database operation fails
 */
async function insertTrainingSession(parsedData) {
  const standardizedData = standardizeTrainingSession(parsedData);

  // 1. Inserisci la sessione principale
  const { data: session, error: sessionError } = await supabase
    .from('training_sessions')
    .insert([{
      date: standardizedData.session.date,
      title: standardizedData.session.title,
      type: standardizedData.session.type,
      location: standardizedData.session.location || null,
      rpe: standardizedData.session.rpe || null,
      feeling: standardizedData.session.feeling || null,
      notes: standardizedData.session.notes || null,
    }])
    .select()
    .single();
  if (sessionError) throw sessionError;

  // 2. Inserisci i gruppi di esercizi
  for (const [index, group] of standardizedData.groups.entries()) {
    const { data: workoutGroup, error: groupError } = await supabase
      .from('workout_groups')
      .insert([{
        session_id: session.id,
        order_index: group.order_index ?? index,
        name: group.name,
        notes: group.notes || null,
      }])
      .select()
      .single();

    if (groupError) throw groupError;

    // 3. Inserisci i set di esercizi per questo gruppo
    if (group.sets && group.sets.length > 0) {
      const setsToInsert = group.sets.map(set => ({
        group_id: workoutGroup.id,
        exercise_name: set.exercise_name,
        category: set.category || null,
        sets: set.sets || 1,
        reps: set.reps || 1,
        weight_kg: set.weight_kg || null,
        distance_m: set.distance_m || null,
        time_s: set.time_s || null,
        recovery_s: set.recovery_s || null,
        details: set.details || {},
        notes: set.notes || null,
      }));

      const { error: setsError } = await supabase
        .from('workout_sets')
        .insert(setsToInsert);

      if (setsError) throw setsError;
    }
  }

  return { success: true, sessionId: session.id };
}

/**
 * Salva una singola sessione (retrocompatibilità)
 */
export async function saveTrainingSession(parsedData) {
  try {
    return await insertTrainingSession(parsedData);
  } catch (error) {
    console.error('Errore nel salvataggio:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Salva più sessioni in sequenza (per input multi-giorno)
 */
export async function saveTrainingSessions(parsedPayload) {
  const sessions = Array.isArray(parsedPayload.sessions)
    ? parsedPayload.sessions
    : [parsedPayload];

  const savedIds = [];

  for (const [idx, session] of sessions.entries()) {
    try {
      const result = await insertTrainingSession(session);
      if (!result.success) {
        return { success: false, error: `Sessione ${idx + 1}: ${result.error}`, savedIds };
      }
      savedIds.push(result.sessionId);
    } catch (error) {
      console.error('Errore nel salvataggio multi-sessione:', error);
      return { success: false, error: `Sessione ${idx + 1}: ${error.message}`, savedIds };
    }
  }

  return { success: true, sessionIds: savedIds };
}

/**
 * Recupera tutte le sessioni di allenamento
 */
export async function getTrainingSessions(limit = 50, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nel recupero sessioni:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera una sessione completa con tutti i gruppi ed esercizi
 */
export async function getSessionDetails(sessionId) {
  try {
    // Recupera la sessione
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Recupera i gruppi
    const { data: groups, error: groupsError } = await supabase
      .from('workout_groups')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true });

    if (groupsError) throw groupsError;

    // Per ogni gruppo, recupera i set
    const groupsWithSets = await Promise.all(
      groups.map(async (group) => {
        const { data: sets, error: setsError } = await supabase
          .from('workout_sets')
          .select('*')
          .eq('group_id', group.id);

        if (setsError) throw setsError;

        return { ...group, sets };
      })
    );

    return {
      success: true,
      data: {
        ...session,
        groups: groupsWithSets,
      },
    };
  } catch (error) {
    console.error('Errore nel recupero dettagli:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Elimina una sessione di allenamento (cascade delete)
 */
export async function deleteTrainingSession(sessionId) {
  try {
    const { error } = await supabase
      .from('training_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Errore nell\'eliminazione:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Statistiche semplici
 */
export async function getTrainingStats(startDate, endDate) {
  try {
    let query = supabase
      .from('training_sessions')
      .select('*');

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: sessions, error } = await query;
    if (error) throw error;

    // Calcola statistiche
    const totalSessions = sessions.length;
    const avgRPE = sessions
      .filter(s => s.rpe !== null)
      .reduce((sum, s) => sum + s.rpe, 0) / sessions.filter(s => s.rpe !== null).length || 0;

    const typeDistribution = sessions.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {});

    return {
      success: true,
      data: {
        totalSessions,
        avgRPE: avgRPE.toFixed(1),
        typeDistribution,
        sessions,
      },
    };
  } catch (error) {
    console.error('Errore nel recupero statistiche:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera sessioni per un giorno specifico
 */
export async function getSessionsByDate(date) {
  try {
    const dateStr = date instanceof Date ? format(date, 'yyyy-MM-dd') : date;
    
    const { data: sessions, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('date', dateStr)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: sessions };
  } catch (error) {
    console.error('Errore nel recupero sessioni per data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recupera sessioni per un mese (optimizzato per vista calendario)
 */
export async function getSessionsForMonth(year, month) {
  try {
    const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
    const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');

    const { data: sessions, error } = await supabase
      .from('training_sessions')
      .select('id, date, type, title, rpe')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;
    
    // Organizza per data
    const sessionsByDate = {};
    sessions.forEach(session => {
      if (!sessionsByDate[session.date]) {
        sessionsByDate[session.date] = [];
      }
      sessionsByDate[session.date].push(session);
    });

    return { success: true, data: sessionsByDate };
  } catch (error) {
    console.error('Errore nel recupero sessioni per mese:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiorna una sessione di allenamento (metadati)
 */
export async function updateTrainingSession(sessionId, updates) {
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .update({
        title: updates.title !== undefined ? updates.title : undefined,
        type: updates.type !== undefined ? updates.type : undefined,
        location: updates.location !== undefined ? updates.location : undefined,
        rpe: updates.rpe !== undefined ? updates.rpe : undefined,
        feeling: updates.feeling !== undefined ? updates.feeling : undefined,
        notes: updates.notes !== undefined ? updates.notes : undefined,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiornamento sessione:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiorna un singolo esercizio (workout set)
 */
export async function updateWorkoutSet(setId, updates) {
  try {
    const updateObj = {};
    
    if (updates.exercise_name !== undefined) updateObj.exercise_name = updates.exercise_name;
    if (updates.category !== undefined) updateObj.category = updates.category;
    if (updates.sets !== undefined) updateObj.sets = updates.sets;
    if (updates.reps !== undefined) updateObj.reps = updates.reps;
    if (updates.weight_kg !== undefined) updateObj.weight_kg = updates.weight_kg;
    if (updates.distance_m !== undefined) updateObj.distance_m = updates.distance_m;
    if (updates.time_s !== undefined) updateObj.time_s = updates.time_s;
    if (updates.recovery_s !== undefined) updateObj.recovery_s = updates.recovery_s;
    if (updates.notes !== undefined) updateObj.notes = updates.notes;
    if (updates.details !== undefined) updateObj.details = updates.details;

    const { data, error } = await supabase
      .from('workout_sets')
      .update(updateObj)
      .eq('id', setId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiornamento esercizio:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiorna un gruppo di esercizi
 */
export async function updateWorkoutGroup(groupId, updates) {
  try {
    const { data, error } = await supabase
      .from('workout_groups')
      .update({
        name: updates.name !== undefined ? updates.name : undefined,
        notes: updates.notes !== undefined ? updates.notes : undefined,
        order_index: updates.order_index !== undefined ? updates.order_index : undefined,
      })
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Errore nell\'aggiornamento gruppo:', error);
    return { success: false, error: error.message };
  }
}
