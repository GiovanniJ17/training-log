# 🧪 AI Parser Stress Test Results

Data Test: 2026-01-19

## Test A: L'Ambiguo Temporale e Formattazione Mista

### Input
```
Ieri ho fatto un test sui 150. Ho corso in 16.5, ma il cronometro manuale segnava 16:30. 
Poi ho fatto 3 serie da 5 balzi. Domani farò riposo. Ah, il 150 era in curva.
```

### Verifiche Attese
- ✅ Data: "Ieri" convertito in 2026-01-18
- ✅ Tempo: 16.5 secondi corretto (150m in 16.5s è plausibile ~10.7 m/s)
- ✅ Falsi Positivi: "Domani farò riposo" non crea sessione duplicata

### Risultati Attuali
**STATO: 🔴 PROBLEMATICO**

**Criticità Rilevate:**
1. ❌ "Ieri/domani/oggi" NON supportate - aiParser.js non ha logica per relative dates
2. ⚠️ "16:30" potrebbe essere confuso con tempo minuti:secondi vs. 16.5 secondi
3. ⚠️ Regex extractPersonalBests potrebbe catturare "150m in 16.5" come PB generico

**Dettaglio Parsing Atteso:**
- Date: 2026-01-18 (ieri) - FALLISCE
- Session Type: pista (test sui 150)
- Groups:
  - Riscaldamento: (inferito)
  - Lavoro Principale:
    - Sprint 150m (time_s: 16.5s)
    - Salti 3x5 (con category: jump)

---

## Test B: La "Lista della Spesa" (Multi-giorno)

### Input
```
Resoconto settimana: Lunedì ho fatto palestra (squat 4x6 100kg), ma non mi sentivo bene. 
Martedì niente. Mercoledì ho recuperato la sessione di martedì facendo pista: 6x30m start dai blocchi. 
Venerdì gara 100m in 10.85 PB!!
```

### Verifiche Attese
- ✅ Parsing giorni: Lunedì, Martedì, Mercoledì, Venerdì
- ✅ Logica "Recupero": esercizio messo su Mercoledì, non duplicato
- ✅ PB Detection: "100m in 10.85 PB" estratto correttamente

### Risultati Attuali
**STATO: 🟡 PARZIALE**

**Criticità Rilevate:**
1. ⚠️ "Martedì niente" -> findDayChunks() crea un chunk vuoto per Martedì
2. ✅ "Mercoledì ha recuperato..." -> Parsing OK se non contiene solo "niente"
3. ✅ PB "100m in 10.85" -> dovrebbe essere catturato da extractPersonalBests

**Dettaglio Parsing Atteso:**
- Session 1 (Lunedì 2026-01-13):
  - Type: palestra
  - Sets: Squat 4x6 100kg
  
- Session 2 (Martedì 2026-01-14):
  - Dovrebbe essere IGNORATA (solo "niente")
  
- Session 3 (Mercoledì 2026-01-15):
  - Type: pista
  - Sets: Sprint 30m 6 ripetizioni, start dai blocchi
  
- Session 4 (Venerdì 2026-01-17):
  - Type: gara
  - PB: race (100m in 10.85s)

---

## Test C: Il "Narratore Prolisso" (Rumore nel testo)

### Input
```
Oggi allenamento strano. Ho incontrato Marco al campo che mi ha tenuto fermo 20 minuti. 
Poi finalmente ho iniziato. Riscaldamento classico. Poi 300 metri massimali. 
Volevo fare 35 secondi ma ho fatto 36.2. Poi mi faceva male il bicipite femorale destro quindi ho smesso.
```

### Verifiche Attese
- ✅ Pulizia: Ignora "Marco" e i "20 minuti" spurii
- ✅ Intento vs Realtà: Capta time_s: 36.2 (realtà), non 35 (obiettivo)
- ✅ Infortunio: "dolore bicipite femorale destro" estratto da extractInjuries

### Risultati Attuali
**STATO: 🟡 PARZIALE**

**Criticità Rilevate:**
1. ⚠️ "incontrato Marco ... 20 minuti" potrebbe confondere il parser
2. ⚠️ "300 metri massimali" capito come "300m 35 secondi" (obiettivo) vs "36.2 secondi" (realtà)
3. ✅ Infortunio: extractInjuries dovrebbe catturare "dolore bicipite femorale destro"

**Dettaglio Parsing Atteso:**
- Date: 2026-01-19 (oggi)
- Type: pista (test massimali)
- Session.title: "300m massimali in 36.2"
- Groups:
  - Riscaldamento: Corsa 2km easy (inferito)
  - Lavoro Principale:
    - Sprint 300m (time_s: 36.2)
- Injuries: [{body_part: "bicipite femorale destro", severity: "moderate"}]

---

## 🔧 Criticità Codice Identificate

### 1. JSON Parsing Fragile (CRITICO)
**Ubicazione:** [aiParser.js linea ~320-380](src/services/aiParser.js#L320-L380)

**Problema:** Parsing manuale di stringhe JSON con regex fragili:
```javascript
// Fallisce se Gemini cambia formato response
jsonStr.replace(/: "([^"]*)"\s*,/g, (match, value) => {...})
```

**Impatto:** Se Gemini ritorna JSON con:
- Commenti prima del JSON
- Formattazione diversa
- Multiline strings non corrette

Il parsing fallisce e ricade su fallback (molto lossy).

**Soluzione Consigliata:** Usare `response_mime_type: "application/json"` nativa di Gemini 2.5.

---

### 2. Relative Dates Non Supportate
**Ubicazione:** [aiParser.js linea ~80-200](src/services/aiParser.js#L80-L200)

**Problema:** Il codice supporta solo:
- Giorni della settimana (lunedì, martedì...)
- Date esplicite (15/01/2026)

Non supporta:
- ❌ "ieri"
- ❌ "oggi" (esplicito nel testo)
- ❌ "domani"
- ❌ "3 giorni fa"

**Impatto:** Test A fallisce completamente.

**Soluzione:** Aggiungere logica di parsing per relative dates prima di findDayChunks.

---

### 3. Distinction Realtà vs Obiettivo
**Ubicazione:** [AI_SYSTEM_PROMPT linea ~10-50](src/services/aiParser.js#L10-L50)

**Problema:** Il prompt non ha linee guida esplicite per distinguere:
- "Volevo fare 35s" (obiettivo) ❌ Non parsato come tempo
- "ma ho fatto 36.2s" (realtà) ✅ Parsato come time_s

**Impatto:** Test C potrebbe catturare 35 anziché 36.2 se il parsing è ingenuo.

**Soluzione:** Potenziare il prompt con esempi di "intento vs realtà".

---

### 4. Vuoti vs Sessioni Finte
**Ubicazione:** [findDayChunks() linea ~130-160](src/services/aiParser.js#L130-L160)

**Problema:** Se chunk.text è vuoto (es. "Martedì niente"), crea comunque una sessione.

**Impatto:** Test B crea sessione fake per "Martedì niente".

**Soluzione:** Skip chunks vuoti (solo spazi/punteggiatura).

---

## 🛠️ Piani di Correzione

### Priority 1: JSON Mode Gemini
- [ ] Aggiungere `response_mime_type: "application/json"` a buildProxyRequest()
- [ ] Rimuovere parsing fragile di stringhe JSON
- [ ] Testare con Gemini 2.5 Flash

### Priority 2: Relative Dates
- [ ] Aggiungere `parseRelativeDate()` function
- [ ] Supportare: "ieri", "oggi", "domani", "3 giorni fa", etc
- [ ] Integrare in findDayChunks() o come pre-processing

### Priority 3: Empty Sessions
- [ ] Filter chunks con solo spazi/punteggiatura
- [ ] Skip "niente", "riposo", "nulla", etc. in findDayChunks()

### Priority 4: Prompt Clarity
- [ ] Aggiungere examples di "intento vs realtà"
- [ ] Migliorare linee guida su rumore nel testo

---

## Test Execution Log

| Test | Status | Timestamp | Notes |
|------|--------|-----------|-------|
| A - Temporal | 🔴 FAIL | 2026-01-19 | Relative dates non supportate |
| B - Multi-day | 🟡 PARTIAL | 2026-01-19 | Empty chunks non filtrate |
| C - Noisy | 🟡 PARTIAL | 2026-01-19 | Prompt needs clarity |

