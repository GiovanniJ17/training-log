# 🏋️ Training Log - Sistema Completo di Gestione Atleta

## 📋 Stato del Sistema

**Data**: 25 Gennaio 2026  
**Versione**: 1.0 - Fully Automated  
**Status**: ✅ Completo e Testato

---

## 🎯 Obiettivi Raggiunti

### ✅ 1. Statistiche Avanzate
- Calcolo corretto di sessioni totali (8)
- Streak di giorni consecutivi (7)
- Distribuzione per tipo (pista, palestra, gara, strada, recupero)
- Volume totale km e tonellate sollevate

### ✅ 2. Profilo Atleta Dedicato
- 5 tabelle Supabase con RLS enabled
- 5 tab di visualizzazione (Overview, PB Gara, PB Allenamento, Massimali, Infortuni)
- Caricamento dati persistenti dal database

### ✅ 3. Estrazione Automatica da Testo
- Parser AI in linguaggio naturale italiano
- Estrazione automatica di:
  - PB gara (es. "100m 10.5sec PB")
  - Massimali (es. "Squat 100kg massimale")
  - Infortuni (es. "dolore spalla lieve")
- Salvataggio automatico nel profilo senza modali manuali
- 100% success rate nei test (7/7 test cases)

---

## 🏗️ Architettura Tecnica

### Frontend Stack
```
React 18+
├─ AITrainingInput.jsx (Parse + Save)
├─ TrainingDashboard.jsx (Statistics)
├─ AthleteProfile.jsx (5 tabs visualization)
├─ SessionHistory/ (Calendar, Detail, Editor)
└─ Services/
    ├─ aiParser.js (NLP extraction)
    ├─ trainingService.js (DB operations)
    ├─ athleteService.js (Profile CRUD)
    └─ formatters.js (Date/Volume formatting)
```

### Backend Stack
```
Supabase PostgreSQL
├─ training_sessions (8 records)
├─ training_groups (workout blocks)
├─ workout_sets (individual exercises)
├─ athlete_profile (Giovanni's profile)
├─ race_records (PB gara)
├─ training_records (PB allenamento)
├─ strength_records (Massimali)
└─ injury_history (Infortuni)

+ RLS Policies (permissive for monoutente)
+ Cascade relationships (ON DELETE CASCADE)
```

### AI Integration
```
Google Gemini API
    ↓
Cloudflare Worker Proxy (api-proxy-server.js)
    ↓
React Frontend (parseTrainingWithAI)
    ↓
Regex Pattern Matching (extractPersonalBests, extractInjuries)
```

---

## 📊 Database Schema

### athlete_profile
```sql
id, name, birth_date, current_weight_kg, height_cm, sport_specialization
-- Giovanni: DOB 2005-12-17, 65kg, 173cm
```

### race_records
```sql
id, athlete_id (null - monoutente), session_id FK
distance_m, time_s, location, competition_name, is_personal_best
```

### strength_records
```sql
id, athlete_id (null), session_id FK
exercise_name, category, weight_kg, reps, is_personal_best, notes
```

### training_records
```sql
id, athlete_id (null), session_id FK
exercise_name, exercise_type, performance_value, performance_unit
```

### injury_history
```sql
id, athlete_id (null), cause_session_id FK
injury_type, body_part, start_date, end_date, severity, notes
```

---

## 🔄 Flusso Completo (End-to-End)

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Input                                              │
│  Utente scrive descrizione di allenamento                   │
│  Es. "Pista 100m 10.5 PB, infortunio spalla lieve"         │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Parsing (AI)                                       │
│  parseTrainingWithAI()                                      │
│  ├─ Gemini API struttura il testo in JSON session          │
│  ├─ extractPersonalBests() trova "100m 10.5 PB"           │
│  └─ extractInjuries() trova "infortunio spalla lieve"      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Validazione                                        │
│  validateParsedData()                                       │
│  └─ Verifica campi richiesti della sessione                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Preview                                            │
│  AITrainingInput mostra preview modificabile               │
│  Utente rivede ed eventualmente modifica                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Salvataggio Triplo                                │
│  saveTrainingSessions(parsedData)                           │
│  ├─ insertTrainingSession() → training_sessions            │
│  └─ saveExtractedRecords() { auto-salva:                  │
│     ├─ addRaceRecord() → race_records (se PB gara)        │
│     ├─ addStrengthRecord() → strength_records (se mass.)  │
│     └─ addInjury() → injury_history (se infortunio)       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Feedback                                           │
│  ✅ Sessione salvata!                                       │
│  • 1 PB aggiunto(i) automaticamente                         │
│  • 1 infortunio(i) registrato(i)                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Visualizzazione                                    │
│  AthleteProfile.jsx ricarica dati                           │
│  ├─ Overview → mostra il nuovo PB                          │
│  ├─ PB Gara → tabella con 100m 10.5s                      │
│  └─ Infortuni → timeline spalla (lieve)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Test Suite

### Test Extraction Patterns
**File**: `scripts/test-extraction.js`

```
✅ 7/7 test cases passed (100%)

✅ PB gara singolo
✅ PB gara con variazione
✅ Massimali multipli
✅ Infortunio singolo
✅ Infortunio grave
✅ Combo completo
✅ PB con formati variati
```

**Esecuzione**:
```bash
cd c:\Users\giova\training-log
node scripts/test-extraction.js
```

---

## 📋 Estrazione Pattern Supportati

### 1. Race Records (PB Gara)
```regex
(\d+)\s*m\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?\s+(?:PB|personal\s+best|nuovo\s+record|miglior\s+tempo)
```

**Esempi**:
- "100m 10.5sec PB" ✅
- "200m in 20.3 sec nuovo record" ✅
- "400m 50,3 personal best" ✅

### 2. Strength Records (Massimali)
```regex
(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?)\s+(\d+[.,]\d+|\d+)\s*kg\s+(?:PB|personal\s+best|massimale|nuovo\s+massimale)
```

**Esempi**:
- "Squat 100kg PB" ✅
- "Panca 75kg massimale" ✅
- "Deadlift 150kg nuovo massimale" ✅

### 3. Injury History (Infortuni)
```regex
(infortunio|dolore|lesione|strappo|contusione|distorsione|tendinite|infiammazione)\s+(?:alla\s+|al\s+)?([a-z\s]+?)(?:\.|,|;|$|\s+(?:grave|moderato|lieve))
```

**Esempi**:
- "Dolore spalla lieve" ✅
- "Infortunio caviglia grave" ✅
- "Lesione ginocchio sinistro" ✅

---

## 📈 Statistiche Sistema

### Database Size
```
- training_sessions: 8 record (dal 14-25 gennaio 2026)
- Total km: ~19km
- Total weight lifted: 5405kg
- Streak: 7 giorni consecutivi (19-25 gennaio)
- Session types: pista(2), palestra(2), strada(2), gara(1), recupero(1)
```

### Extraction Accuracy
```
Pattern matching: 100% (7/7 test cases)
Race records extraction: 100% (5 test cases)
Strength records extraction: 100% (3 test cases)
Injury records extraction: 100% (3 test cases)
```

---

## 🚀 Come Usare

### Per l'Utente
1. Clicca su "Inserimento Intelligente"
2. Scrivi la tua sessione con PB/infortuni:
   ```
   Pista: 100m 10.5sec PB + 200m 20.3 sec
   Infortunio spalla minore
   Squat 100kg massimale in palestra
   ```
3. Clicca "Parse"
4. Verifica il preview
5. Clicca "Salva"
6. Vedi il messaggio di successo con conteggi auto-estratti
7. Accedi al Profilo Atleta per visualizzare i nuovi record

### Per lo Sviluppatore
```javascript
// Aggiungere nuovi pattern
const newPattern = /your regex here/gi;

// In extractPersonalBests() o extractInjuries()
while ((match = newPattern.exec(text)) !== null) {
  // Process match[1], match[2], etc.
}

// Lanciare i test
node scripts/test-extraction.js
```

---

## ⚙️ Configurazione Supabase

### RLS Policies (Tutte le tabelle)
```sql
-- Monoutente: tutto è permesso
CREATE POLICY "Allow all operations" ON table_name
  USING (true)
  WITH CHECK (true);
```

### Relationships
```sql
-- race_records → training_sessions
FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE

-- strength_records → training_sessions
FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE

-- injury_history → training_sessions
FOREIGN KEY (cause_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE
```

---

## 📚 Documentazione Correlata

- [EXTRACTION_GUIDE.md](./EXTRACTION_GUIDE.md) - Guida completa ai formati di input
- [Athlete Profile Schema](../docs/ATHLETE_PROFILE_SCHEMA.md) - Schema database dettagliato
- [Training Service](../src/services/trainingService.js) - Implementazione salvataggio
- [AI Parser](../src/services/aiParser.js) - Implementazione estrazione
- [Athlete Service](../src/services/athleteService.js) - CRUD profilo atleta

---

## 🎓 Learnings Chiave

1. **Regex Pattern Matching** è efficace per l'estrazione di dati strutturati da testo italiano
2. **Automatic saving** senza interruzione è cruciale (error handling graceful)
3. **Test suite** per pattern matching garantisce affidabilità
4. **Cascade relationships** nel DB mantengono l'integrità dei dati
5. **Monoutente architecture** semplifica RLS policies

---

## 🔮 Possibili Miglioramenti Futuri

- [ ] AI-powered confidence scores per estratti
- [ ] Extraction di RPE da testo ("intensità 8/10")
- [ ] Auto-complete esercizi da history
- [ ] Bulk import da CSV/Strava
- [ ] Analytics e progressione PB nel tempo
- [ ] Export statistiche mensili
- [ ] Mobile app with offline extraction

---

**Sviluppo Completato**: 25 Gennaio 2026  
**Ultimo Test**: ✅ Pass 100%  
**Stato Produzione**: 🚀 Ready
