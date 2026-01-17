import { supabase } from '../lib/supabase';
import { standardizeTrainingSession } from '../utils/standardizer.js';

/**
 * Saves a complete training session to database with cascade insert
 * Applies data standardization (exercise names, times, recovery durations) before saving
 * @param {Object} parsedData - Parsed training session object with session, groups, and sets
 * @returns {Promise<Object>} Saved session data with ID
 * @throws {Error} If database operation fails
 */
export async function saveTrainingSession(parsedData) {
  try {
    // 0. Standardizza i dati per coerenza (esercizi, tempi, recuperi)
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
  } catch (error) {
    console.error('Errore nel salvataggio:', error);
    return { success: false, error: error.message };
  }
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
