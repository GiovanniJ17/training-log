# 📋 Piano Schema Database - Profilo Atleta & Statistiche

## Tabelle Nuove Necessarie

### 1. **athlete_profile** (Profilo Atleta Base)
```sql
athlete_profile {
  id: UUID PRIMARY KEY
  user_id: UUID FOREIGN KEY
  name: VARCHAR
  birth_date: DATE
  current_weight_kg: DECIMAL
  height_cm: INT
  sport_specialization: VARCHAR (es: "100m sprint", "mezzofondo", ecc)
  profile_picture_url: VARCHAR
  bio: TEXT
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### 2. **strength_records** (Massimali Palestra)
```sql
strength_records {
  id: UUID PRIMARY KEY
  session_id: UUID FOREIGN KEY (training_sessions)
  exercise_name: VARCHAR
  category: VARCHAR (es: "Squat", "Bench", "Deadlift", ecc)
  weight_kg: DECIMAL
  reps: INT
  notes: TEXT
  percentage_of_bodyweight: DECIMAL (calcolato: peso / peso_atleta * 100)
  date: DATE
  created_at: TIMESTAMP
}
```

### 3. **injury_history** (Storico Infortuni)
```sql
injury_history {
  id: UUID PRIMARY KEY
  user_id: UUID FOREIGN KEY
  injury_type: VARCHAR (es: "strappo muscolare", "infiammazione", ecc)
  body_part: VARCHAR (es: "spalla", "ginocchio", "caviglia")
  start_date: DATE
  end_date: DATE (NULL se ancora presente)
  severity: VARCHAR (minor, moderate, severe)
  notes: TEXT
  recovery_session_count: INT (quanti giorni di recupero)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### 4. **race_records** (PB in Gara)
```sql
race_records {
  id: UUID PRIMARY KEY
  session_id: UUID FOREIGN KEY (training_sessions)
  distance_m: INT
  time_s: DECIMAL
  rpe: INT
  location: VARCHAR
  competition_name: VARCHAR
  notes: TEXT
  is_personal_best: BOOLEAN
  created_at: TIMESTAMP
}
```

### 5. **weight_history** (Peso Corporeo nel Tempo)
```sql
weight_history {
  id: UUID PRIMARY KEY
  user_id: UUID FOREIGN KEY
  weight_kg: DECIMAL
  date: DATE
  notes: TEXT
  created_at: TIMESTAMP
}
```

## Modifiche a Tabelle Esistenti

### workout_sets
Aggiungere campo opzionale:
```sql
ALTER TABLE workout_sets ADD COLUMN is_strength_record BOOLEAN DEFAULT FALSE;
```

## Relazioni

```
athlete_profile (1) ──→ (N) injury_history
                   ──→ (N) weight_history
                   
training_sessions (1) ──→ (N) strength_records
                      ──→ (N) race_records
```

## UI Components Necessari

### Pagina Profilo Atleta
- **Header**: Nome, foto, specialità
- **Card Dati**: Peso attuale, altezza, BMI
- **Sezione PB Gara**: Tabella con distanze e tempi
- **Sezione Massimali**: Tabella con esercizi e % peso corporeo
- **Sezione Infortuni**: Timeline storico infortuni
- **Sezione Peso**: Grafico peso nel tempo

### Pagina Statistiche Avanzate
- **Filtri**: Date range, tipo sessione, esercizio specifico
- **Grafici**: 
  - Trend RPE (linea)
  - Volume settimanale (barre)
  - Distribuzione tipo sessioni (pie chart)
  - Trend peso (linea)
- **Tabelle**:
  - Sessioni dettagliate con export
  - Best performances per esercizio

## Priorità Implementazione

1. **PRIMA**: athlete_profile + componente base
2. **SECONDA**: strength_records + race_records
3. **TERZA**: injury_history + weight_history
4. **QUARTA**: Grafici e filtri avanzati

