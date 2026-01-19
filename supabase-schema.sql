-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.athlete_profile (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  birth_date date NOT NULL,
  current_weight_kg numeric NOT NULL,
  height_cm integer,
  sport_specialization text,
  profile_picture_url text,
  bio text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT athlete_profile_pkey PRIMARY KEY (id)
);
CREATE TABLE public.injury_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  injury_type text NOT NULL,
  body_part text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'severe'::text])),
  cause_session_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT injury_history_pkey PRIMARY KEY (id),
  CONSTRAINT injury_history_session_id_fkey FOREIGN KEY (cause_session_id) REFERENCES public.training_sessions(id)
);
CREATE TABLE public.race_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  distance_m integer NOT NULL CHECK (distance_m > 0),
  time_s numeric NOT NULL CHECK (time_s > 0::numeric),
  rpe integer CHECK (rpe >= 0 AND rpe <= 10),
  location text,
  competition_name text,
  notes text,
  is_personal_best boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT race_records_pkey PRIMARY KEY (id),
  CONSTRAINT race_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id)
);
CREATE TABLE public.strength_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  exercise_name text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['squat'::text, 'bench'::text, 'deadlift'::text, 'clean'::text, 'jerk'::text, 'press'::text, 'pull'::text, 'other'::text])),
  weight_kg numeric NOT NULL CHECK (weight_kg > 0::numeric),
  reps integer NOT NULL DEFAULT 1,
  notes text,
  is_personal_best boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT strength_records_pkey PRIMARY KEY (id),
  CONSTRAINT strength_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id)
);
CREATE TABLE public.training_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  exercise_name text NOT NULL,
  exercise_type text NOT NULL CHECK (exercise_type = ANY (ARRAY['sprint'::text, 'jump'::text, 'throw'::text, 'endurance'::text])),
  performance_value numeric NOT NULL,
  performance_unit text NOT NULL CHECK (performance_unit = ANY (ARRAY['seconds'::text, 'meters'::text, 'reps'::text, 'kg'::text])),
  rpe integer CHECK (rpe >= 0 AND rpe <= 10),
  notes text,
  is_personal_best boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT training_records_pkey PRIMARY KEY (id),
  CONSTRAINT training_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id)
);
CREATE TABLE public.training_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  type text CHECK (type = ANY (ARRAY['pista'::text, 'palestra'::text, 'strada'::text, 'gara'::text, 'test'::text, 'scarico'::text, 'recupero'::text, 'altro'::text])),
  location text,
  rpe integer CHECK (rpe >= 0 AND rpe <= 10),
  feeling text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT training_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.workout_groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  order_index integer DEFAULT 0,
  name text,
  notes text,
  CONSTRAINT workout_groups_pkey PRIMARY KEY (id),
  CONSTRAINT workout_groups_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id)
);
CREATE TABLE public.workout_sets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL,
  exercise_name text NOT NULL,
  category text CHECK (category = ANY (ARRAY['sprint'::text, 'jump'::text, 'lift'::text, 'endurance'::text, 'mobility'::text, 'drill'::text, 'other'::text])),
  sets integer DEFAULT 1,
  reps integer DEFAULT 1,
  weight_kg numeric,
  distance_m numeric,
  time_s numeric,
  recovery_s integer,
  details jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workout_sets_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sets_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.workout_groups(id)
);

-- ============================================================================
-- TABELLA PER STATISTICHE MENSILI PRE-CALCOLATE
-- ============================================================================
CREATE TABLE public.monthly_stats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  year_month date NOT NULL,
  total_distance_km numeric DEFAULT 0,
  total_time_h numeric DEFAULT 0,
  total_sets integer DEFAULT 0,
  avg_rpe numeric DEFAULT 0,
  sessions_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT monthly_stats_pkey PRIMARY KEY (id),
  CONSTRAINT monthly_stats_unique_month UNIQUE (year_month)
);

-- ============================================================================
-- TRIGGER PER SINCRONIZZARE I PERSONAL BEST (race_records)
-- ============================================================================
-- Questo trigger scatta quando viene inserito o modificato un workout_set
-- Se è una corsa veloce e il tempo è migliore del record, aggiorna race_records

CREATE OR REPLACE FUNCTION check_and_update_pb()
RETURNS TRIGGER AS $$
DECLARE
  session_id_var uuid;
  existing_pb_time numeric;
BEGIN
  -- Recupera l'ID della sessione dal gruppo di allenamento
  SELECT session_id INTO session_id_var
  FROM public.workout_groups
  WHERE id = NEW.group_id;

  -- Se è una corsa veloce (sprint) con distanza e tempo
  IF NEW.category = 'sprint' AND NEW.distance_m IS NOT NULL AND NEW.time_s IS NOT NULL THEN
    
    -- Controlla se esiste già un PB per questa distanza
    SELECT time_s INTO existing_pb_time
    FROM public.race_records
    WHERE distance_m = NEW.distance_m
    LIMIT 1;

    -- Se non esiste un PB o il nuovo tempo è migliore
    IF existing_pb_time IS NULL THEN
      -- Inserisce un nuovo race_record
      INSERT INTO public.race_records (session_id, distance_m, time_s, is_personal_best)
      VALUES (session_id_var, NEW.distance_m::integer, NEW.time_s, true);
    
    ELSIF NEW.time_s < existing_pb_time THEN
      -- Aggiorna il PB esistente
      UPDATE public.race_records
      SET time_s = NEW.time_s, session_id = session_id_var, is_personal_best = true
      WHERE distance_m = NEW.distance_m;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pb_trigger
AFTER INSERT OR UPDATE ON public.workout_sets
FOR EACH ROW
EXECUTE FUNCTION check_and_update_pb();

-- ============================================================================
-- TRIGGER PER MANTENERE SINCRONIZZATE LE STATISTICHE MENSILI
-- ============================================================================
-- Questo trigger scatta quando viene inserito o modificato un workout_set
-- Aggiorna il totale mensilità nella tabella monthly_stats

CREATE OR REPLACE FUNCTION update_monthly_stats()
RETURNS TRIGGER AS $$
DECLARE
  session_date_var date;
  month_start date;
  total_distance numeric;
  total_time numeric;
  total_sets_count integer;
BEGIN
  -- Recupera la data della sessione
  SELECT date INTO session_date_var
  FROM public.training_sessions
  WHERE id = (SELECT session_id FROM public.workout_groups WHERE id = NEW.group_id);

  -- Calcola il primo giorno del mese
  month_start := date_trunc('month', session_date_var)::date;

  -- Calcola i totali per il mese
  SELECT 
    COALESCE(SUM(distance_m), 0) / 1000.0,
    COALESCE(SUM(time_s), 0) / 3600.0,
    COALESCE(COUNT(*), 0)
  INTO total_distance, total_time, total_sets_count
  FROM public.workout_sets ws
  JOIN public.workout_groups wg ON ws.group_id = wg.id
  JOIN public.training_sessions ts ON wg.session_id = ts.id
  WHERE DATE_TRUNC('month', ts.date)::date = month_start;

  -- Inserisce o aggiorna il record mensilità
  INSERT INTO public.monthly_stats (year_month, total_distance_km, total_time_h, total_sets, updated_at)
  VALUES (month_start, total_distance, total_time, total_sets_count, now())
  ON CONFLICT (year_month)
  DO UPDATE SET
    total_distance_km = total_distance,
    total_time_h = total_time,
    total_sets = total_sets_count,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stats_trigger
AFTER INSERT OR UPDATE ON public.workout_sets
FOR EACH ROW
EXECUTE FUNCTION update_monthly_stats();