-- Inserisci profilo atleta di default se non esiste
INSERT INTO athlete_profile (name, birth_date, current_weight_kg, height_cm, sport_specialization)
SELECT 
  'Atleta',
  '2000-01-01'::date,
  70.0,
  175,
  'Atletica Leggera'
WHERE NOT EXISTS (
  SELECT 1 FROM athlete_profile LIMIT 1
);

-- Mostra il profilo corrente
SELECT id, name, birth_date, current_weight_kg, height_cm, sport_specialization 
FROM athlete_profile 
LIMIT 1;
