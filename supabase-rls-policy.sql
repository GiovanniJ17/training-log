-- ============================================
-- ABILITAZIONE RLS (Row Level Security)
-- ============================================

-- 1. Abilita RLS su athlete_profile
ALTER TABLE public.athlete_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to athlete_profile" ON public.athlete_profile
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Abilita RLS su race_records
ALTER TABLE public.race_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to race_records" ON public.race_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Abilita RLS su training_records
ALTER TABLE public.training_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to training_records" ON public.training_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Abilita RLS su strength_records
ALTER TABLE public.strength_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to strength_records" ON public.strength_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Abilita RLS su injury_history
ALTER TABLE public.injury_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to injury_history" ON public.injury_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- NOTA: Queste policy permettono accesso totale
-- Sono appropriate per un'app monoutente/personale
-- Se implementi autenticazione, sostituisci con:
-- USING (auth.uid() = user_id) e WITH CHECK (auth.uid() = user_id)
-- ============================================
