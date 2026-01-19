-- =====================================================
-- RPC Function: insert_full_training_session
-- =====================================================
-- Inserisce una sessione completa di allenamento in una singola transazione atomica.
-- Questo garantisce che o tutto viene salvato o niente, prevenendo dati inconsistenti.
--
-- COME USARE:
-- 1. Apri Supabase Dashboard → SQL Editor
-- 2. Copia e incolla questo codice
-- 3. Esegui (Run)
-- 4. La funzione sarà disponibile via supabase.rpc('insert_full_training_session', {...})
-- =====================================================

CREATE OR REPLACE FUNCTION insert_full_training_session(
  p_date DATE,
  p_title TEXT,
  p_type TEXT,
  p_location TEXT,
  p_rpe INTEGER,
  p_feeling TEXT,
  p_notes TEXT,
  p_groups JSONB
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_group_data JSONB;
  v_group_id UUID;
  v_set_data JSONB;
BEGIN
  -- 1. Inserisci la sessione principale
  INSERT INTO public.training_sessions (date, title, type, location, rpe, feeling, notes)
  VALUES (p_date, p_title, p_type, p_location, p_rpe, p_feeling, p_notes)
  RETURNING id INTO v_session_id;

  -- 2. Cicla attraverso i gruppi (se presenti)
  IF p_groups IS NOT NULL AND jsonb_array_length(p_groups) > 0 THEN
    FOR v_group_data IN SELECT * FROM jsonb_array_elements(p_groups)
    LOOP
      -- Inserisci il gruppo
      INSERT INTO public.workout_groups (session_id, order_index, name, notes)
      VALUES (
        v_session_id,
        (v_group_data->>'order_index')::INT,
        v_group_data->>'name',
        v_group_data->>'notes'
      )
      RETURNING id INTO v_group_id;

      -- 3. Cicla attraverso i set di questo gruppo (se presenti)
      IF v_group_data->'sets' IS NOT NULL AND jsonb_array_length(v_group_data->'sets') > 0 THEN
        FOR v_set_data IN SELECT * FROM jsonb_array_elements(v_group_data->'sets')
        LOOP
          INSERT INTO public.workout_sets (
            group_id, exercise_name, category, sets, reps, 
            weight_kg, distance_m, time_s, recovery_s, details, notes
          )
          VALUES (
            v_group_id,
            v_set_data->>'exercise_name',
            v_set_data->>'category',
            (v_set_data->>'sets')::INT,
            (v_set_data->>'reps')::INT,
            (v_set_data->>'weight_kg')::NUMERIC,
            (v_set_data->>'distance_m')::NUMERIC,
            (v_set_data->>'time_s')::NUMERIC,
            (v_set_data->>'recovery_s')::INT,
            COALESCE(v_set_data->'details', '{}'::jsonb),
            v_set_data->>'notes'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- Ritorna l'ID della sessione creata
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Test rapido (opzionale, decommentare per verificare)
-- SELECT insert_full_training_session(
--   '2026-01-19'::DATE,
--   'Test Session',
--   'test',
--   NULL,
--   NULL,
--   NULL,
--   NULL,
--   '[]'::JSONB
-- );
