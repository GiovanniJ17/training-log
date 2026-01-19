# Sistema di Estrazione Automatica Profilo Atleta

## 🎯 Panoramica

Il sistema estrae automaticamente i seguenti dati dalle descrizioni di allenamento:
- **PB Gara** (personal best su distanze specifiche)
- **Massimali** (record di forza in esercizi)
- **Infortuni** (lesioni e dolori con gravità)

Tutti i dati estratti vengono salvati automaticamente nel **Profilo Atleta** senza necessità di compilare modali aggiuntivi.

---

## ✨ Flusso Workflow

```
1. Utente scrive descrizione allenamento
   ↓
2. Clicca "Parse" (AI Parser)
   ↓
3. Sistema estrae:
   - Dati sessione di allenamento
   - PB gara
   - Massimali
   - Infortuni
   ↓
4. Utente verifica preview dei dati
   ↓
5. Clicca "Salva"
   ↓
6. Sistema salva:
   - Sessione in training_sessions ✓
   - PB gara in race_records ✓
   - Massimali in strength_records ✓
   - Infortuni in injury_history ✓
   ↓
7. Messaggio di successo con conteggio auto-estratti
```

---

## 📝 Formati di Input Supportati

### 1️⃣ PB Gara (Race Records)

**Pattern**: `{distanza}m {tempo} {keyword PB}`

Keyword accettati: `PB`, `personal best`, `nuovo record`, `miglior tempo`

**Esempi validi:**
```
- "100m 10.5sec PB"
- "100m in 10.5s PB"
- "200m 20.3 sec nuovo record"
- "400m 50,3 personal best"
- "800m 105.6 miglior tempo"
```

**Note:**
- La virgola `,` viene convertita automaticamente a punto `.`
- `10.5sec` = 10.5 secondi
- `1:30` = 90 secondi (1 minuto 30)

**Output nel database:**
```
race_records {
  distance_m: 100,
  time_s: 10.5,
  is_personal_best: true
}
```

---

### 2️⃣ Massimali (Strength Records)

**Pattern**: `{esercizio} {peso}kg {keyword massimale}`

Esercizi riconosciuti:
- `squat`
- `bench` / `panca`
- `deadlift` / `stacco`
- `clean`
- `jerk`
- `press` / `military press`
- `trazioni` / `trazione`

Keyword accettati: `PB`, `personal best`, `massimale`, `nuovo massimale`

**Esempi validi:**
```
- "Squat 100kg PB"
- "Panca 75kg massimale"
- "Deadlift 150kg nuovo massimale"
- "Clean 80kg personal best"
- "Military press 50kg PB"
```

**Note:**
- I pesi supportano virgola: `100,5kg` → `100.5`
- Ogni esercizio diventa 1 rep (per semplificare la registrazione di singoli PB)
- La categoria viene assegnata automaticamente

**Output nel database:**
```
strength_records {
  exercise_name: "Squat",
  category: "squat",
  weight_kg: 100,
  reps: 1,
  is_personal_best: true
}
```

---

### 3️⃣ Infortuni (Injury History)

**Pattern**: `{tipo infortunio} {parte corpo} {keyword gravità opzionale}`

Tipi di infortunio:
- `infortunio`
- `dolore`
- `lesione`
- `strappo muscolare`
- `contusione`
- `distorsione`
- `tendinite`
- `infiammazione`

Parti del corpo riconosciute:
- `spalla` / `spalla sinistra` / `spalla destra`
- `gomito`
- `polso`
- `schiena` / `bassa schiena` / `alta schiena`
- `fianco` / `anca`
- `coscia`
- `ginocchio` / `ginocchio sinistro` / `ginocchio destro`
- `caviglia`
- `piede`
- `gamba`
- `petto`
- `addominale`

Keyword gravità:
- `lieve` / `leggero` / `minore` → `minor` severity
- `moderato` → `moderate` severity (default)
- `grave` / `serio` / `importante` / `maggiore` → `severe`

**Esempi validi:**
```
- "Dolore spalla lieve"
- "Infortunio caviglia grave"
- "Lesione ginocchio sinistro moderata"
- "Strappo muscolare bassa schiena"
- "Infiammazione tendinite caviglia"
```

**Output nel database:**
```
injury_history {
  injury_type: "dolore",
  body_part: "spalla",
  severity: "minor",
  start_date: "2026-01-25",
  cause_session_id: 42  // auto-popolato
}
```

---

## 🎨 Esempi di Input Completi

### Esempio 1: Solo sessione di allenamento
```
Pista: 5x100m 11.5-11.3-11.2-11.4-11.1sec
Recupero 3 minuti tra le serie
Intensità 8/10
```
**Risultato**: Sessione salvata (NO PB auto-estratti)

---

### Esempio 2: Con singolo PB gara
```
Pista: 100m 10.5sec PB
Sprint 60m velocità
Riscaldamento 1km
```
**Risultato**: Sessione + 1 race_record (100m 10.5s)

---

### Esempio 3: Con massimali
```
Palestra:
Squat 100kg PB
Bench press 75kg massimale
Deadlift 140kg nuovo massimale
5x5 ogni esercizio
```
**Risultato**: Sessione + 3 strength_records

---

### Esempio 4: Con infortunio
```
Sessione pista ma dolore spalla lieve durante riscaldamento
Comunque completate 3x200m in 23-24sec
Stretching estensivo
```
**Risultato**: Sessione + 1 injury_history (dolore, spalla, minor)

---

### Esempio 5: Combo completo
```
Pista: 100m 10.4sec nuovo record.
Infortunio caviglia minore durante riscaldamento.
Squat 110kg massimale in palestra poi.
Deadlift 145kg PB.
Sessione intensa, RPE 8/10.
```
**Risultato**: 
- Sessione salvata
- 1 race_record (100m 10.4s)
- 2 strength_records (Squat 110kg, Deadlift 145kg)
- 1 injury_history (infortunio, caviglia, minor)

---

### Esempio 6: Settimana multi-giorno
```
Lunedì: Pista 100m 10.5sec PB + 200m velocità
Martedì: Palestra Squat 100kg massimale
Mercoledì: Recupero 5km strada
Giovedì: Infortunio spalla grave, sessione annullata
Venerdì: Deadlift 150kg PB, panca 80kg massimale
```
**Risultato**: 
- 4 sessioni (una vuota per giovedì)
- 3 race_records (100m 10.5s, 200m, 5km)
- 3 strength_records (Squat, Deadlift, Bench)
- 1 injury_history (infortunio, spalla, severe)

---

## 🛠️ Funzioni Tecniche

### Estrazione Pattern (aiParser.js)

**extractPersonalBests(text)**
- Regex per race: `/(\d+)\s*m(?:etri?)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?\s+(?:PB|personal\s+best|nuovo\s+record|miglior\s+tempo)/gi`
- Regex per strength: `/(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?)\s+(\d+[.,]\d+|\d+)\s*kg\s+(?:PB|personal\s+best|massimale|nuovo\s+massimale)/gi`

**extractInjuries(text)**
- Regex per infortuni: `/(infortunio|dolore|lesione|strappo muscolare|contusione|distorsione|tendinite|infiammazione)\s+(?:alla\s+|al\s+|di\s+)?([a-z\s]+?)(?:\.|,|;|$|\s+(?:grave|moderato|lieve))/gi`
- Analizza contesto ±50 caratteri per gravità

### Salvataggio Automatico (trainingService.js)

**saveExtractedRecords(sessionId, personalBests, injuries)**
```javascript
// Itera attraverso personalBests
- Se type='race' → addRaceRecord()
- Se type='strength' → addStrengthRecord()

// Itera attraverso injuries
- Chiama addInjury() con start_date = oggi, cause_session_id = sessionId
```

Comportamento errori: Se il salvataggio di un record fallisce, **non interrompe** il salvataggio della sessione. Viene solo loggato un warning.

---

## 📊 Testing

Test suite completo: `scripts/test-extraction.js`

```bash
node scripts/test-extraction.js
```

**Coverage attuale**: 100% (7/7 test cases)
- ✅ PB gara singolo
- ✅ PB gara con variazioni di formato
- ✅ Massimali multipli
- ✅ Infortuni singoli
- ✅ Infortuni gravi
- ✅ Combo completo (PB + Infortunio + Massimale)
- ✅ PB con formati variati (virgola, punto, lettere abbreviate)

---

## ⚠️ Limitazioni Conosciute

1. **Pattern matching case-insensitive**: "SQUAT", "squat", "Squat" vengono riconosciuti (OK)
2. **Priorità gravità**: Se nel testo appaiono sia "lieve" che "grave", prevalse l'ultima occorrenza nel contesto ±50 caratteri
3. **Esercizi compositi**: "Front squat", "high bar squat" potrebbero NON essere riconosciuti come "squat" (richiedono alias)
4. **Distanze implicite**: "50m" senza unità è accettato e interpretato come 50 metri (OK per pista)
5. **Tempi senza unità**: "10.5" senza "sec/s" richiede il keyword PB per essere riconosciuto

---

## 🔄 Flusso di Integrazione

**Nel database:**
```
training_sessions (1 record per sessione)
    ↓ FK cause_session_id
    ├─ race_records (0+ record)
    ├─ strength_records (0+ record)
    └─ injury_history (0+ record)
```

**RLS Policy**: Tutte le tabelle usano `USING(true)` (monoutente app)

---

## 🚀 Per l'Utente

### Come usare il sistema

1. **Scrivi una sessione** con PB/infortuni nel testo:
   ```
   Pista: 100m 10.5sec PB, 200m 20.2sec
   Infortunio spalla lieve
   ```

2. **Clicca "Parse"** per far analizzare il testo dall'AI

3. **Verifica il preview** dei dati estratti

4. **Clicca "Salva"** per salvare tutto automaticamente

5. **Vedi il messaggio di successo**:
   ```
   ✅ Sessione salvata!
   • 1 PB aggiunto(i) automaticamente
   • 1 infortunio(i) registrato(i)
   ```

6. **Accedi al Profilo Atleta** per vedere i nuovi record registrati

### Se qualcosa non viene estratto

- Controlla che usi **esattamente** uno dei keyword (PB, massimale, dolore, ecc.)
- Assicurati che il formato segua il pattern: `[esercizio] [numero] [unità] [keyword]`
- Se serve, riprova con un formato leggermente diverso

---

## 📚 Documentazione Correlata

- [Athlete Profile Schema](../docs/ATHLETE_PROFILE_SCHEMA.md)
- [Database Structure](../DEPLOY.md#database)
- [Test Results](./test-extraction.js)

---

**Ultima modifica**: 25 gennaio 2026  
**Versione**: 1.0 (Fully Automated)
