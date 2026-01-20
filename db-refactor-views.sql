-- =====================================================
-- DATABASE REFACTORING: Single Source of Truth
-- Elimina ridondanza dati usando VIEWS invece di tabelle separate
-- =====================================================

-- STEP 1: Aggiungi flag a workout_sets per marcare PB e tipologia
ALTER TABLE public.workout_sets 
ADD COLUMN IF NOT EXISTS is_personal_best BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_race BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS intensity INTEGER CHECK (intensity >= 0 AND intensity <= 10);

-- Aggiungi indici per performance
CREATE INDEX IF NOT EXISTS idx_workout_sets_is_pb ON public.workout_sets(is_personal_best) WHERE is_personal_best = true;
CREATE INDEX IF NOT EXISTS idx_workout_sets_is_race ON public.workout_sets(is_race) WHERE is_race = true;
CREATE INDEX IF NOT EXISTS idx_workout_sets_category ON public.workout_sets(category);

-- STEP 2: Migra i dati esistenti dalle tabelle ridondanti ai flag
-- (Questa migrazione è sicura: non cancella dati, solo li marca)

-- Marca i race_records esistenti
UPDATE public.workout_sets ws
SET is_race = true,
    is_personal_best = rr.is_personal_best,
    is_test = true
FROM public.race_records rr
INNER JOIN public.workout_groups wg ON wg.session_id = rr.session_id
WHERE ws.group_id = wg.id
  AND ws.distance_m = rr.distance_m
  AND ws.time_s = rr.time_s;

-- Marca i strength_records esistenti  
UPDATE public.workout_sets ws
SET is_personal_best = sr.is_personal_best,
    is_test = true
FROM public.strength_records sr
INNER JOIN public.workout_groups wg ON wg.session_id = sr.session_id
WHERE ws.group_id = wg.id
  AND ws.exercise_name = sr.exercise_name
  AND ws.weight_kg = sr.weight_kg;

-- Marca i training_records esistenti
UPDATE public.workout_sets ws
SET is_personal_best = tr.is_personal_best,
    is_test = true
FROM public.training_records tr
INNER JOIN public.workout_groups wg ON wg.session_id = tr.session_id
WHERE ws.group_id = wg.id
  AND ws.exercise_name = tr.exercise_name;

-- STEP 3: Crea VIEWS che sostituiscono le tabelle ridondanti
-- Queste views sono READ-ONLY e si aggiornano automaticamente

-- VIEW: race_records (compatibilità retroattiva)
CREATE OR REPLACE VIEW public.view_race_records AS
SELECT 
  ws.id,
  ts.id as session_id,
  ts.date,
  ws.distance_m,
  ws.time_s,
  ts.rpe,
  ts.location,
  ts.notes as competition_name,
  ws.notes,
  ws.is_personal_best,
  ws.created_at
FROM public.workout_sets ws
INNER JOIN public.workout_groups wg ON ws.group_id = wg.id
INNER JOIN public.training_sessions ts ON wg.session_id = ts.id
WHERE ws.category = 'sprint'
  AND ws.distance_m IS NOT NULL
  AND ws.distance_m > 0
  AND ws.time_s IS NOT NULL
  AND ws.time_s > 0
  AND (ws.is_race = true OR ws.is_test = true OR ts.type IN ('gara', 'test'))
ORDER BY ts.date DESC, ws.time_s ASC;

-- VIEW: strength_records (compatibilità retroattiva)
CREATE OR REPLACE VIEW public.view_strength_records AS
SELECT 
  ws.id,
  ts.id as session_id,
  ts.date,
  ws.exercise_name,
  -- Mappa la categoria da workout_sets
  CASE 
    WHEN LOWER(ws.exercise_name) LIKE '%squat%' THEN 'squat'
    WHEN LOWER(ws.exercise_name) LIKE '%bench%' OR LOWER(ws.exercise_name) LIKE '%panca%' THEN 'bench'
    WHEN LOWER(ws.exercise_name) LIKE '%deadlift%' OR LOWER(ws.exercise_name) LIKE '%stacco%' THEN 'deadlift'
    WHEN LOWER(ws.exercise_name) LIKE '%clean%' OR LOWER(ws.exercise_name) LIKE '%girata%' THEN 'clean'
    WHEN LOWER(ws.exercise_name) LIKE '%jerk%' OR LOWER(ws.exercise_name) LIKE '%slancio%' THEN 'jerk'
    WHEN LOWER(ws.exercise_name) LIKE '%press%' THEN 'press'
    WHEN LOWER(ws.exercise_name) LIKE '%pull%' OR LOWER(ws.exercise_name) LIKE '%traz%' THEN 'pull'
    ELSE 'other'
  END as category,
  ws.weight_kg,
  ws.reps,
  ws.notes,
  ws.is_personal_best,
  ws.created_at
FROM public.workout_sets ws
INNER JOIN public.workout_groups wg ON ws.group_id = wg.id
INNER JOIN public.training_sessions ts ON wg.session_id = ts.id
WHERE ws.category = 'lift'
  AND ws.weight_kg IS NOT NULL
  AND ws.weight_kg > 0
  AND (ws.is_test = true OR ts.type IN ('palestra', 'test'))
ORDER BY ts.date DESC, ws.weight_kg DESC;

-- VIEW: training_records (compatibilità retroattiva)
CREATE OR REPLACE VIEW public.view_training_records AS
SELECT 
  ws.id,
  ts.id as session_id,
  ts.date,
  ws.exercise_name,
  -- Determina exercise_type dalla categoria
  CASE ws.category
    WHEN 'sprint' THEN 'sprint'
    WHEN 'jump' THEN 'jump'
    WHEN 'endurance' THEN 'endurance'
    ELSE 'sprint'
  END as exercise_type,
  COALESCE(ws.time_s, ws.distance_m, ws.reps::numeric) as performance_value,
  CASE 
    WHEN ws.time_s IS NOT NULL THEN 'seconds'
    WHEN ws.distance_m IS NOT NULL THEN 'meters'
    WHEN ws.reps IS NOT NULL THEN 'reps'
    ELSE 'seconds'
  END as performance_unit,
  ts.rpe,
  ws.notes,
  ws.is_personal_best,
  ws.created_at
FROM public.workout_sets ws
INNER JOIN public.workout_groups wg ON ws.group_id = wg.id
INNER JOIN public.training_sessions ts ON wg.session_id = ts.id
WHERE ws.category IN ('sprint', 'jump', 'endurance')
  AND ws.is_test = true
  AND (ws.time_s > 0 OR ws.distance_m > 0 OR ws.reps > 0)
ORDER BY ts.date DESC;

-- STEP 4: Grant permissions
GRANT SELECT ON public.view_race_records TO anon, authenticated;
GRANT SELECT ON public.view_strength_records TO anon, authenticated;
GRANT SELECT ON public.view_training_records TO anon, authenticated;

-- STEP 5: (OPZIONALE) Rinomina le vecchie tabelle invece di eliminarle
-- Questo permette di fare rollback se necessario
ALTER TABLE IF EXISTS public.race_records RENAME TO _deprecated_race_records;
ALTER TABLE IF EXISTS public.strength_records RENAME TO _deprecated_strength_records;
ALTER TABLE IF EXISTS public.training_records RENAME TO _deprecated_training_records;

-- STEP 6: Crea funzione helper per calcolare automaticamente i PB
CREATE OR REPLACE FUNCTION public.check_and_mark_personal_best()
RETURNS TRIGGER AS $$
DECLARE
  existing_best NUMERIC;
  is_new_pb BOOLEAN := false;
BEGIN
  -- Solo per set cronometrati o pesati
  IF NEW.category = 'sprint' AND NEW.distance_m > 0 AND NEW.time_s > 0 THEN
    -- Verifica se è PB per questa distanza
    SELECT MIN(ws.time_s) INTO existing_best
    FROM public.workout_sets ws
    INNER JOIN public.workout_groups wg ON ws.group_id = wg.id
    INNER JOIN public.training_sessions ts ON wg.session_id = ts.id
    WHERE ws.distance_m = NEW.distance_m
      AND ws.category = 'sprint'
      AND ws.id != NEW.id;
    
    IF existing_best IS NULL OR NEW.time_s < existing_best THEN
      is_new_pb := true;
      -- Rimuovi il flag dai vecchi record
      UPDATE public.workout_sets ws
      SET is_personal_best = false
      FROM public.workout_groups wg
      WHERE ws.group_id = wg.id
        AND ws.distance_m = NEW.distance_m
        AND ws.category = 'sprint'
        AND ws.id != NEW.id;
    END IF;
    
  ELSIF NEW.category = 'lift' AND NEW.weight_kg > 0 THEN
    -- Verifica se è PB per questo esercizio
    SELECT MAX(ws.weight_kg) INTO existing_best
    FROM public.workout_sets ws
    WHERE LOWER(ws.exercise_name) = LOWER(NEW.exercise_name)
      AND ws.category = 'lift'
      AND ws.id != NEW.id;
    
    IF existing_best IS NULL OR NEW.weight_kg > existing_best THEN
      is_new_pb := true;
      -- Rimuovi il flag dai vecchi record
      UPDATE public.workout_sets ws
      SET is_personal_best = false
      WHERE LOWER(ws.exercise_name) = LOWER(NEW.exercise_name)
        AND ws.category = 'lift'
        AND ws.id != NEW.id;
    END IF;
  END IF;
  
  NEW.is_personal_best := is_new_pb;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger automatico per marcare i PB
DROP TRIGGER IF EXISTS trigger_auto_mark_pb ON public.workout_sets;
CREATE TRIGGER trigger_auto_mark_pb
  BEFORE INSERT OR UPDATE ON public.workout_sets
  FOR EACH ROW
  WHEN (NEW.is_test = true OR NEW.is_race = true)
  EXECUTE FUNCTION public.check_and_mark_personal_best();

-- =====================================================
-- COMMENTI
-- =====================================================
COMMENT ON VIEW public.view_race_records IS 'View read-only dei record di gara (sostituisce race_records table)';
COMMENT ON VIEW public.view_strength_records IS 'View read-only dei record di forza (sostituisce strength_records table)';
COMMENT ON VIEW public.view_training_records IS 'View read-only dei record di allenamento (sostituisce training_records table)';
COMMENT ON FUNCTION public.check_and_mark_personal_best IS 'Calcola e marca automaticamente i PB quando viene inserito/aggiornato un workout_set';
