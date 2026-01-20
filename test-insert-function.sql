-- =================================================================
-- TEST DELLA FUNZIONE insert_full_training_session
-- Questo script testa se la funzione funziona correttamente
-- =================================================================

-- Test 1: Inserimento semplice con una sessione, un gruppo, un set
SELECT 'Test 1: Inserimento semplice' AS test_name;

DO $$
DECLARE
  v_result uuid;
  v_session_id uuid;
  v_group_count integer;
  v_set_count integer;
BEGIN
  -- Chiama la funzione
  v_result := public.insert_full_training_session(
    p_date := CURRENT_DATE,
    p_title := 'Test Session',
    p_type := 'pista',
    p_location := 'Test Location',
    p_rpe := 7,
    p_feeling := 'Good',
    p_notes := 'Test notes',
    p_groups := jsonb_build_array(
      jsonb_build_object(
        'order_index', 1,
        'name', 'Warm-up',
        'notes', 'Warm-up group',
        'sets', jsonb_build_array(
          jsonb_build_object(
            'exercise_name', '100m sprint',
            'category', 'sprint',
            'sets', 1,
            'reps', 1,
            'distance_m', 100,
            'time_s', 11.5,
            'recovery_s', 120,
            'notes', 'Test sprint'
          )
        )
      )
    )
  );

  RAISE NOTICE 'Sessione creata con ID: %', v_result;

  -- Verifica che la sessione sia stata inserita
  SELECT COUNT(*) INTO v_group_count FROM public.workout_groups WHERE session_id = v_result;
  SELECT COUNT(*) INTO v_set_count FROM public.workout_sets ws
    JOIN public.workout_groups wg ON ws.group_id = wg.id
    WHERE wg.session_id = v_result;

  RAISE NOTICE 'Gruppi inseriti: %, Set inseriti: %', v_group_count, v_set_count;

  IF v_group_count = 1 AND v_set_count = 1 THEN
    RAISE NOTICE '✅ Test 1 PASSED';
  ELSE
    RAISE EXCEPTION '❌ Test 1 FAILED: Conteggi non corretti (gruppi: %, set: %)', v_group_count, v_set_count;
  END IF;
END $$;

-- Test 2: Verifica che il trigger PB non generi stack depth
RAISE NOTICE '';
RAISE NOTICE 'Test 2: Verifica trigger PB senza stack depth';

DO $$
DECLARE
  v_result uuid;
BEGIN
  -- Inserisci un altro sprint per testare il trigger PB
  v_result := public.insert_full_training_session(
    p_date := CURRENT_DATE,
    p_title := 'PB Test Session',
    p_type := 'pista',
    p_location := 'Test Location',
    p_rpe := 8,
    p_feeling := 'Excellent',
    p_notes := 'Testing PB trigger',
    p_groups := jsonb_build_array(
      jsonb_build_object(
        'order_index', 1,
        'name', 'Main set',
        'notes', null,
        'sets', jsonb_build_array(
          jsonb_build_object(
            'exercise_name', '200m sprint',
            'category', 'sprint',
            'sets', 1,
            'reps', 1,
            'distance_m', 200,
            'time_s', 23.5,
            'recovery_s', 180,
            'notes', 'Fast run'
          )
        )
      )
    )
  );

  RAISE NOTICE '✅ Test 2 PASSED - Nessun stack depth error!';
END $$;

-- Verifica finale: mostra le sessioni inserite
RAISE NOTICE '';
RAISE NOTICE 'Verifiche finali:';

SELECT 'Sessioni inserite' AS check_name, COUNT(*) AS count FROM public.training_sessions
WHERE title LIKE 'Test%' OR title LIKE 'PB%'
UNION ALL
SELECT 'Gruppi inseriti' AS check_name, COUNT(*) AS count FROM public.workout_groups
WHERE session_id IN (SELECT id FROM public.training_sessions WHERE title LIKE 'Test%' OR title LIKE 'PB%')
UNION ALL
SELECT 'Set inseriti' AS check_name, COUNT(*) AS count FROM public.workout_sets
WHERE group_id IN (
  SELECT id FROM public.workout_groups
  WHERE session_id IN (SELECT id FROM public.training_sessions WHERE title LIKE 'Test%' OR title LIKE 'PB%')
);

RAISE NOTICE 'Tutti i test completati!';
