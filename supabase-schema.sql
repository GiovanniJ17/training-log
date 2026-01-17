# Schema SQL per Supabase
# Esegui questo script nel SQL Editor di Supabase

-- Abilita l'estensione per UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella sessioni di allenamento
CREATE TABLE IF NOT EXISTS public.training_sessions (
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

-- Tabella gruppi di esercizi
CREATE TABLE IF NOT EXISTS public.workout_groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  order_index integer DEFAULT 0,
  name text,
  notes text,
  CONSTRAINT workout_groups_pkey PRIMARY KEY (id),
  CONSTRAINT workout_groups_session_id_fkey FOREIGN KEY (session_id) 
    REFERENCES public.training_sessions(id) ON DELETE CASCADE
);

-- Tabella set di esercizi
CREATE TABLE IF NOT EXISTS public.workout_sets (
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
  CONSTRAINT workout_sets_group_id_fkey FOREIGN KEY (group_id) 
    REFERENCES public.workout_groups(id) ON DELETE CASCADE
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON public.training_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_groups_session_id ON public.workout_groups(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_group_id ON public.workout_sets(group_id);

-- Abilita Row Level Security (RLS)
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

-- Policy per permettere tutto (da modificare con autenticazione in futuro)
CREATE POLICY "Allow all operations on training_sessions" ON public.training_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on workout_groups" ON public.workout_groups
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on workout_sets" ON public.workout_sets
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.training_sessions TO anon, authenticated;
GRANT ALL ON public.workout_groups TO anon, authenticated;
GRANT ALL ON public.workout_sets TO anon, authenticated;
