-- ============================================
-- SCHEMA PROFILO ATLETA - VERSIONE SEMPLIFICATA
-- ============================================

-- 1. Profilo Atleta Base
CREATE TABLE public.athlete_profile (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  birth_date date NOT NULL,
  current_weight_kg numeric(5,2) NOT NULL,
  height_cm integer,
  sport_specialization text,
  profile_picture_url text,
  bio text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT athlete_profile_pkey PRIMARY KEY (id)
);

-- 2. Record Personali in Gara
CREATE TABLE public.race_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  distance_m integer NOT NULL,
  time_s numeric(6,2) NOT NULL,
  rpe integer CHECK (rpe >= 0 AND rpe <= 10),
  location text,
  competition_name text,
  notes text,
  is_personal_best boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT race_records_pkey PRIMARY KEY (id),
  CONSTRAINT race_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  CONSTRAINT race_records_time_positive CHECK (time_s > 0),
  CONSTRAINT race_records_distance_positive CHECK (distance_m > 0)
);

-- 3. Record Personali Allenamento (Sprint, Salti, ecc.)
CREATE TABLE public.training_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  exercise_name text NOT NULL,
  exercise_type text NOT NULL CHECK (exercise_type = ANY (ARRAY['sprint'::text, 'jump'::text, 'throw'::text, 'endurance'::text])),
  performance_value numeric(8,2) NOT NULL,
  performance_unit text NOT NULL CHECK (performance_unit = ANY (ARRAY['seconds'::text, 'meters'::text, 'reps'::text, 'kg'::text])),
  rpe integer CHECK (rpe >= 0 AND rpe <= 10),
  notes text,
  is_personal_best boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT training_records_pkey PRIMARY KEY (id),
  CONSTRAINT training_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE
);

-- 4. Massimali Forza Palestra
CREATE TABLE public.strength_records (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  exercise_name text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['squat'::text, 'bench'::text, 'deadlift'::text, 'clean'::text, 'jerk'::text, 'press'::text, 'pull'::text, 'other'::text])),
  weight_kg numeric(5,2) NOT NULL,
  reps integer NOT NULL DEFAULT 1,
  notes text,
  is_personal_best boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT strength_records_pkey PRIMARY KEY (id),
  CONSTRAINT strength_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  CONSTRAINT strength_weight_positive CHECK (weight_kg > 0)
);

-- 5. Storico Infortuni
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
  CONSTRAINT injury_history_session_id_fkey FOREIGN KEY (cause_session_id) REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  CONSTRAINT injury_dates_valid CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ============================================
-- INDICI PER PERFORMANCE
-- ============================================

CREATE INDEX idx_race_records_session ON public.race_records(session_id);
CREATE INDEX idx_race_records_is_pb ON public.race_records(is_personal_best);
CREATE INDEX idx_training_records_session ON public.training_records(session_id);
CREATE INDEX idx_training_records_is_pb ON public.training_records(is_personal_best);
CREATE INDEX idx_strength_records_session ON public.strength_records(session_id);
CREATE INDEX idx_strength_records_is_pb ON public.strength_records(is_personal_best);
CREATE INDEX idx_strength_records_category ON public.strength_records(category);
CREATE INDEX idx_injury_history_dates ON public.injury_history(start_date, end_date);

-- ============================================
-- INSERIMENTO PROFILO DI PROVA
-- ============================================

INSERT INTO public.athlete_profile (name, birth_date, current_weight_kg, height_cm, sport_specialization, bio)
VALUES (
  'Giovanni',
  '2005-12-17',
  65.0,
  173,
  'Velocità 100m',
  'Atleta specializzato nella velocità'
);

