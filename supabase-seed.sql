-- Script per popolare il database con dati di esempio
-- Utile per testing e sviluppo

-- Inserisci sessioni di esempio
DO $$
DECLARE
  session1_id uuid;
  session2_id uuid;
  session3_id uuid;
  group1_id uuid;
  group2_id uuid;
  group3_id uuid;
  group4_id uuid;
  group5_id uuid;
BEGIN
  -- Sessione 1: Pista velocità
  INSERT INTO training_sessions (date, title, type, rpe, feeling, notes)
  VALUES (CURRENT_DATE - INTERVAL '2 days', 'Allenamento velocità', 'pista', 9, 'Ottime sensazioni, gambe reattive', 'Sessione intensa ma produttiva')
  RETURNING id INTO session1_id;

  INSERT INTO workout_groups (session_id, order_index, name)
  VALUES (session1_id, 0, 'Riscaldamento')
  RETURNING id INTO group1_id;

  INSERT INTO workout_sets (group_id, exercise_name, category, distance_m, notes)
  VALUES 
    (group1_id, 'Corsa leggera', 'endurance', 2000, 'Ritmo tranquillo'),
    (group1_id, 'Drill tecnica', 'drill', NULL, '10 minuti vari drill');

  INSERT INTO workout_groups (session_id, order_index, name)
  VALUES (session1_id, 1, 'Lavoro principale')
  RETURNING id INTO group2_id;

  INSERT INTO workout_sets (group_id, exercise_name, category, sets, distance_m, time_s, recovery_s)
  VALUES (group2_id, 'Sprint 200m', 'sprint', 6, 200, 25.5, 180);

  -- Sessione 2: Palestra forza
  INSERT INTO training_sessions (date, title, type, rpe, feeling, notes)
  VALUES (CURRENT_DATE - INTERVAL '1 day', 'Forza gambe', 'palestra', 7, 'Buona sessione', 'Focus su forza massimale')
  RETURNING id INTO session2_id;

  INSERT INTO workout_groups (session_id, order_index, name)
  VALUES (session2_id, 0, 'Esercizi principali')
  RETURNING id INTO group3_id;

  INSERT INTO workout_sets (group_id, exercise_name, category, sets, reps, weight_kg, recovery_s)
  VALUES 
    (group3_id, 'Squat', 'lift', 4, 6, 90, 180),
    (group3_id, 'Stacco rumeno', 'lift', 3, 8, 80, 120),
    (group3_id, 'Affondi bulgari', 'lift', 3, 10, 30, 90);

  INSERT INTO workout_groups (session_id, order_index, name)
  VALUES (session2_id, 1, 'Core')
  RETURNING id INTO group4_id;

  INSERT INTO workout_sets (group_id, exercise_name, category, sets, time_s, recovery_s)
  VALUES 
    (group4_id, 'Plank frontale', 'other', 3, 60, 45),
    (group4_id, 'Plank laterale', 'other', 3, 45, 45);

  -- Sessione 3: Allenamento misto
  INSERT INTO training_sessions (date, title, type, rpe, feeling, notes)
  VALUES (CURRENT_DATE, 'Doppio allenamento', 'pista', 8, 'Stanco ma soddisfatto', 'Mattina pista, pomeriggio palestra')
  RETURNING id INTO session3_id;

  INSERT INTO workout_groups (session_id, order_index, name, notes)
  VALUES (session3_id, 0, 'Mattina - Pista', 'Lavoro di resistenza veloce')
  RETURNING id INTO group5_id;

  INSERT INTO workout_sets (group_id, exercise_name, category, sets, distance_m, time_s, recovery_s)
  VALUES (group5_id, 'Sprint 300m', 'sprint', 8, 300, 42, 300);

  -- Aggiungi più sessioni per statistiche significative
  INSERT INTO training_sessions (date, title, type, rpe, notes)
  VALUES 
    (CURRENT_DATE - INTERVAL '3 days', 'Scarico attivo', 'scarico', 3, 'Recupero leggero'),
    (CURRENT_DATE - INTERVAL '5 days', 'Fondo lento', 'strada', 5, '10km ritmo tranquillo'),
    (CURRENT_DATE - INTERVAL '7 days', 'Test massimali', 'test', 9, 'Verifica forza massimale'),
    (CURRENT_DATE - INTERVAL '10 days', 'Gara 100m', 'gara', 10, 'PB: 10.87s'),
    (CURRENT_DATE - INTERVAL '12 days', 'Mobilità e recupero', 'recupero', 2, 'Stretching e foam roller');

END $$;

-- Verifica inserimento
SELECT 
  ts.date,
  ts.title,
  ts.type,
  ts.rpe,
  COUNT(DISTINCT wg.id) as num_groups,
  COUNT(ws.id) as num_exercises
FROM training_sessions ts
LEFT JOIN workout_groups wg ON ts.id = wg.session_id
LEFT JOIN workout_sets ws ON wg.id = ws.group_id
GROUP BY ts.id, ts.date, ts.title, ts.type, ts.rpe
ORDER BY ts.date DESC;

-- Mostra statistiche
SELECT 
  type,
  COUNT(*) as count,
  ROUND(AVG(rpe)::numeric, 1) as avg_rpe
FROM training_sessions
WHERE rpe IS NOT NULL
GROUP BY type
ORDER BY count DESC;
