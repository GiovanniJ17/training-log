import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { standardizeTrainingSession } from '../utils/standardizer.js';
import {
  addRaceRecord,
  addTrainingRecord,
  addStrengthRecord,
  addInjury,
} from './athleteService.js';

/**
 * Saves a complete training session to database using atomic RPC transaction
 * Applies data standardization (exercise names, times, recovery durations) before saving
 * Uses Postgres stored procedure for ACID compliance - all or nothing insert
 * @param {Object} parsedData - Parsed training session object with session, groups, and sets
 * @returns {Promise<Object>} Saved session data with ID
 * @throws {Error} If database operation fails
 */
async function insertTrainingSession(parsedData) {
  const standardizedData = standardizeTrainingSession(parsedData);

  // Prepara i gruppi in formato JSON per la stored procedure
  const groupsJson = standardizedData.groups.map(group => ({
    order_index: group.order_index,
    name: group.name,
    notes: group.notes,
    sets: group.sets // Array già standardizzato
  }));

  // Chiamata RPC atomica: O tutto o niente! 🛡️
  // 1 sola chiamata di rete invece di N (sessione + gruppi + set)
  // Se la connessione cade, il database fa rollback automatico
  const { data: sessionId, error } = await supabase.rpc('insert_full_training_session', {
    p_date: standardizedData.session.date,
    p_title: standardizedData.session.title,
    p_type: standardizedData.session.type,
    p_location: standardizedData.session.location || null,
    p_rpe: standardizedData.session.rpe || null,
    p_feeling: standardizedData.session.feeling || null,
    p_notes: standardizedData.session.notes || null,
    p_groups: groupsJson
  });

  if (error) throw error;

  return { success: true, sessionId: sessionId, sessionDate: standardizedData.session.date };
}

/**
 * Salva automaticamente i PB e infortuni estratti dal parsing
 */
async function saveExtractedRecords(sessionId, sessionDate, personalBests = [], injuries = []) {
  try {
    // Salva i PB con validazione
    for (const pb of personalBests) {
      if (pb.type === 'race') {
        // Valida se è davvero un PB controllando i record esistenti
        const { data: existingRecords } = await supabase
          .from('race_records')
          .select('time_s')
          .eq('distance_m', pb.distance_m)
          .order('time_s', { ascending: true })
          .limit(1);

        const isTruePB = !existingRecords || existingRecords.length === 0 || pb.time_s < existingRecords[0].time_s;

        await addRaceRecord(sessionId, {
          distance_m: pb.distance_m,
          time_s: pb.time_s,
          is_personal_best: isTruePB,
        });
      } else if (pb.type === 'training') {
        // PB di allenamento (sprint): confronta per esercizio/tempo
        const { data: existingTraining } = await supabase
          .from('training_records')
          .select('performance_value')
          .eq('exercise_type', 'sprint')
          .eq('performance_unit', 'seconds')
          .eq('exercise_name', pb.exercise_name)
          .order('performance_value', { ascending: true })
          .limit(1);

        const isTruePB = !existingTraining || existingTraining.length === 0 || pb.performance_value < existingTraining[0].performance_value;

        await addTrainingRecord(sessionId, {
          exercise_name: pb.exercise_name,
          exercise_type: pb.exercise_type || 'sprint',
          performance_value: pb.performance_value,
          performance_unit: pb.performance_unit || 'seconds',
          rpe: pb.rpe || null,
          notes: pb.notes || null,
          is_personal_best: isTruePB,
        });
      } else if (pb.type === 'strength') {
        // Valida se è davvero un PB massimale controllando i record esistenti
        const { data: existingRecords } = await supabase
          .from('strength_records')
          .select('weight_kg')
          .eq('category', pb.category)
          .order('weight_kg', { ascending: false })
          .limit(1);

        const isTruePB = !existingRecords || existingRecords.length === 0 || pb.weight_kg > existingRecords[0].weight_kg;

        await addStrengthRecord(sessionId, {
          exercise_name: pb.exercise_name,
          category: pb.category,
          weight_kg: pb.weight_kg,
          reps: pb.reps || 1,
          is_personal_best: isTruePB,
        });
      }
    }

    // Salva gli infortuni
    for (const injury of injuries) {
      try {
        await addInjury({
          injury_type: injury.injury_type,
          body_part: injury.body_part,
          start_date: sessionDate || new Date().toISOString().split('T')[0],
          severity: injury.severity,
          cause_session_id: sessionId,
        });
      } catch (injuryError) {
        console.warn(`Errore nel salvataggio infortunio (${injury.body_part}):`, injuryError);
        // Continua comunque con gli altri infortuni
      }
    }

    return { success: true };
  } catch (error) {
    console.warn('Errore nel salvataggio record estratti:', error);
    // Non fallire il salvataggio della sessione se fallisce il salvataggio dei record
    return { success: false, error: error.message };
  }
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
 * Estrae e salva anche automaticamente PB e infortuni
 */
export async function saveTrainingSessions(parsedPayload) {
  const sessions = Array.isArray(parsedPayload.sessions)
    ? parsedPayload.sessions
    : [parsedPayload];

  const personalBests = parsedPayload.personalBests || [];
  const injuries = parsedPayload.injuries || [];

  const savedIds = [];

  for (const [idx, session] of sessions.entries()) {
    try {
      const result = await insertTrainingSession(session);
      if (!result.success) {
        return { success: false, error: `Sessione ${idx + 1}: ${result.error}`, savedIds };
      }
      savedIds.push(result.sessionId);

      // Salva i PB e infortuni per questa sessione
      if (personalBests.length > 0 || injuries.length > 0) {
        await saveExtractedRecords(result.sessionId, result.sessionDate, personalBests, injuries);
      }
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
 * Statistiche avanzate con algoritmi
 */
export async function getTrainingStats(startDate, endDate) {
  try {
    // Recupera sessioni nel periodo
    let sessionQuery = supabase
      .from('training_sessions')
      .select('*')
      .order('date', { ascending: true });

    if (startDate) {
      sessionQuery = sessionQuery.gte('date', startDate);
    }
    if (endDate) {
      sessionQuery = sessionQuery.lte('date', endDate);
    }

    const { data: sessions, error } = await sessionQuery;
    if (error) throw error;

    // Ottieni gli ID delle sessioni nel periodo
    const sessionIds = sessions.map(s => s.id);

    // Recupera i gruppi per queste sessioni
    const { data: groups, error: groupsError } = await supabase
      .from('workout_groups')
      .select('id, session_id')
      .in('session_id', sessionIds);
    
    if (groupsError) throw groupsError;

    const groupIds = groups.map(g => g.id);

    // Recupera i sets per questi gruppi
    const { data: sets, error: setsError } = await supabase
      .from('workout_sets')
      .select('*')
      .in('group_id', groupIds);
    
    if (setsError) throw setsError;

    // Calcola statistiche base
    const totalSessions = sessions.length;
    
    // RPE medio (solo sessioni con RPE)
    const sessionsWithRPE = sessions.filter(s => s.rpe !== null && s.rpe !== undefined);
    const avgRPE = sessionsWithRPE.length > 0
      ? (sessionsWithRPE.reduce((sum, s) => sum + s.rpe, 0) / sessionsWithRPE.length)
      : null;

    // Distribuzione tipi
    const typeDistribution = sessions.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {});

    // Volume totale distanza (somma distance_m * sets)
    const totalDistance = sets
      .filter(s => s.distance_m)
      .reduce((sum, s) => sum + (s.distance_m * (s.sets || 1)), 0);
    
    // Volume totale peso (somma weight_kg * reps * sets)
    const totalWeight = sets
      .filter(s => s.weight_kg && s.reps)
      .reduce((sum, s) => sum + (s.weight_kg * s.reps * (s.sets || 1)), 0);

    // Calcola streak (giorni consecutivi) - usa TUTTE le sessioni non solo quelle filtrate
    const { data: allSessions, error: allError } = await supabase
      .from('training_sessions')
      .select('date')
      .order('date', { ascending: false });
    
    if (allError) throw allError;
    const streak = calculateStreak(allSessions);

    return {
      success: true,
      data: {
        totalSessions,
        avgRPE: avgRPE !== null ? avgRPE.toFixed(1) : null,
        typeDistribution,
        totalDistanceKm: (totalDistance / 1000).toFixed(2),
        totalWeightKg: totalWeight.toFixed(0),
        currentStreak: streak,
        sessions,
      },
    };
  } catch (error) {
    console.error('Errore nel recupero statistiche:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calcola streak di allenamenti consecutivi
 */
function calculateStreak(sessions) {
  if (sessions.length === 0) return 0;
  
  // Ottieni le date uniche (possono esserci più sessioni nello stesso giorno)
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  if (uniqueDates.length === 0) return 0;
  
  // Trova la data più recente nel database
  const mostRecentDate = new Date(uniqueDates[0]);
  mostRecentDate.setHours(0, 0, 0, 0);
  
  let streak = 1; // Conta la prima data
  let currentDate = new Date(mostRecentDate);
  
  // Conta all'indietro le date consecutive
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i]);
    prevDate.setHours(0, 0, 0, 0);
    
    // Calcola la data attesa (giorno precedente)
    const expectedDate = new Date(currentDate);
    expectedDate.setDate(expectedDate.getDate() - 1);
    
    // Verifica se è consecutiva
    if (prevDate.getTime() === expectedDate.getTime()) {
      streak++;
      currentDate = new Date(prevDate);
    } else {
      // Interrompi se non consecutiva
      break;
    }
  }
  
  return streak;
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
