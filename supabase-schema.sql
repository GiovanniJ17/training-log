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
  CONSTRAINT injury_history_cause_session_id_fkey FOREIGN KEY (cause_session_id) REFERENCES public.training_sessions(id)
);
CREATE TABLE public.monthly_stats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  year_month date NOT NULL UNIQUE,
  total_distance_km numeric DEFAULT 0,
  total_time_h numeric DEFAULT 0,
  total_sets integer DEFAULT 0,
  avg_rpe numeric DEFAULT 0,
  sessions_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT monthly_stats_pkey PRIMARY KEY (id)
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
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT training_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.workout_groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  order_index integer DEFAULT 0,
  name text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
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
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workout_sets_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sets_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.workout_groups(id)
);

-- Performance Indexes
-- Ottimizza le query di join per le foreign keys
CREATE INDEX IF NOT EXISTS idx_workout_groups_session ON public.workout_groups(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_group ON public.workout_sets(group_id);

-- Ottimizza le query per data (uso frequente per filtrare sessioni)
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON public.training_sessions(date DESC);

-- Ottimizza le query per tipo di sessione
CREATE INDEX IF NOT EXISTS idx_training_sessions_type ON public.training_sessions(type);

-- Ottimizza le ricerche per categoria di esercizio
CREATE INDEX IF NOT EXISTS idx_workout_sets_category ON public.workout_sets(category);

-- Indice composito per query statistiche comuni (data + tipo)
CREATE INDEX IF NOT EXISTS idx_training_sessions_date_type ON public.training_sessions(date DESC, type);