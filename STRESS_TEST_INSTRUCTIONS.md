# 🧪 AI Parser - Stress Test Pratico

Usa questo file per testare direttamente i 3 stress test nel tuo AITrainingInput component.

---

## Test A: L'Ambiguo Temporale e Formattazione Mista

**Obiettivo:** Verificare supporto "ieri", disambiguazione tempo vs distanza, falsi positivi su "domani riposo"

**Testo da Copiare:**
```
Ieri ho fatto un test sui 150. Ho corso in 16.5, ma il cronometro manuale segnava 16:30. Poi ho fatto 3 serie da 5 balzi. Domani farò riposo. Ah, il 150 era in curva.
```

**Verifiche Attese:**
- ✅ Data: **2026-01-18** (ieri rispetto a 2026-01-19)
- ✅ Esercizio 1: Sprint 150m, time_s: **16.5** (non 16:30 che è ambiguo)
- ✅ Esercizio 2: Salti 3x5 (category: jump)
- ✅ Session Type: **pista**
- ✅ Session.title: ~"Test 150m + Salti" (4-8 parole)
- ❌ NON deve creare sessione per "Domani farò riposo"

**Come Testare:**
1. Apri il form "Inserimento Intelligente" nell'app
2. Copia-incolla il testo sopra
3. Clicca "Analizza con AI"
4. Verifica il JSON parsato che appare:
   - Deve avere **1 sessione** (2026-01-18)
   - NON deve avere sessione per domani
   - `groups` deve avere almeno 1 esercizio (Sprint 150m)

**Output Atteso (JSON):**
```json
{
  "sessions": [
    {
      "session": {
        "date": "2026-01-18",
        "title": "Test 150m + Salti",
        "type": "pista",
        "rpe": null,
        "feeling": null,
        "notes": "Test sui 150m in curva, 16.5 secondi, seguito da 3 serie da 5 balzi"
      },
      "groups": [
        {
          "name": "Riscaldamento",
          "order_index": 0,
          "sets": [...]
        },
        {
          "name": "Lavoro Principale",
          "order_index": 1,
          "sets": [
            {
              "exercise_name": "Sprint 150m",
              "category": "sprint",
              "distance_m": 150,
              "time_s": 16.5,
              "recovery_s": null
            },
            {
              "exercise_name": "Salti",
              "category": "jump",
              "sets": 3,
              "reps": 5
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Test B: La "Lista della Spesa" (Multi-giorno complesso)

**Obiettivo:** Verificare parsing multi-giorno, empty sessions (Martedì niente), logica "recupero", PB detection

**Testo da Copiare:**
```
Resoconto settimana: Lunedì ho fatto palestra (squat 4x6 100kg), ma non mi sentivo bene. Martedì niente. Mercoledì ho recuperato la sessione di martedì facendo pista: 6x30m start dai blocchi. Venerdì gara 100m in 10.85 PB!!
```

**Verifiche Attese:**
- ✅ **3 sessioni create** (Lunedì, Mercoledì, Venerdì)
- ❌ **Martedì NON deve avere sessione** (skip vuota)
- ✅ Lunedì (2026-01-13): palestra, Squat 4x6 100kg
- ✅ Mercoledì (2026-01-15): pista, Sprint 30m 6 ripetizioni
- ✅ Venerdì (2026-01-17): gara, 100m in 10.85s
- ✅ PB Detection: `personalBests` deve contenere `{type: "race", distance_m: 100, time_s: 10.85}`

**Come Testare:**
1. Apri il form "Inserimento Intelligente"
2. Copia-incolla il testo sopra
3. Clicca "Analizza con AI"
4. Verifica:
   - **Numero sessioni:** Deve essere esattamente **3** (non 4!)
   - **Data sessioni:** 2026-01-13 (Lunedì), 2026-01-15 (Mercoledì), 2026-01-17 (Venerdì)
   - **personalBests array:** Deve contenere 1 elemento per "100m in 10.85 PB"

**Output Atteso (Structure):**
```
sessions: [
  { session.date: "2026-01-13", session.type: "palestra", groups[0].sets[0].exercise_name: "Squat" },
  { session.date: "2026-01-15", session.type: "pista", groups[?].sets[?].exercise_name: "Sprint 30m" },
  { session.date: "2026-01-17", session.type: "gara", groups[?].sets[?].distance_m: 100, time_s: 10.85 }
]
personalBests: [{ type: "race", distance_m: 100, time_s: 10.85, is_personal_best: true }]
```

---

## Test C: Il "Narratore Prolisso" (Rumore nel testo)

**Obiettivo:** Verificare pulizia rumore (nomi persone, durate spurie), intento vs realtà, injury extraction

**Testo da Copiare:**
```
Oggi allenamento strano. Ho incontrato Marco al campo che mi ha tenuto fermo 20 minuti. Poi finalmente ho iniziato. Riscaldamento classico. Poi 300 metri massimali. Volevo fare 35 secondi ma ho fatto 36.2. Poi mi faceva male il bicipite femorale destro quindi ho smesso.
```

**Verifiche Attese:**
- ✅ Date: **2026-01-19** (oggi)
- ✅ Session Type: **pista** (300m massimali)
- ✅ Esercizio: Sprint 300m, time_s: **36.2** (realtà, NON 35 goal)
- ❌ Ignora "Marco" e "20 minuti" (non è training time)
- ❌ Ignora "Volevo fare 35" come noise/goal
- ✅ Injuries: `{body_part: "bicipite femorale destro", injury_type: "dolore"}`

**Come Testare:**
1. Apri il form "Inserimento Intelligente"
2. Copia-incolla il testo sopra
3. Clicca "Analizza con AI"
4. Verifica:
   - **Date:** 2026-01-19
   - **Session.title:** Deve contenere "300m" e "36.2" (non "35")
   - **Groups:** Sprint 300m con `time_s: 36.2`
   - **Injuries:** Array deve avere 1 infortunio con `body_part: "bicipite femorale destro"`

**Output Atteso (JSON):**
```json
{
  "sessions": [
    {
      "session": {
        "date": "2026-01-19",
        "title": "Sprint 300m massimali 36.2",
        "type": "pista",
        "notes": "Allenamento con sprint 300m massimali in 36.2 secondi"
      },
      "groups": [
        {
          "name": "Riscaldamento",
          "sets": [{ "exercise_name": "Corsa", ... }]
        },
        {
          "name": "Lavoro Principale",
          "sets": [
            {
              "exercise_name": "Sprint 300m",
              "category": "sprint",
              "distance_m": 300,
              "time_s": 36.2
            }
          ]
        }
      ]
    }
  ],
  "injuries": [
    {
      "injury_type": "dolore",
      "body_part": "bicipite femorale destro",
      "start_date": "2026-01-19",
      "severity": "moderate"
    }
  ]
}
```

---

## 🔍 Debugging Tips

Se i test falliscono:

1. **Apri le Dev Tools** (F12 → Console)
   - Cerca log `[parseSingleDay]` per vedere il flusso
   - Cerca log `[findDayChunks]` per sessioni multi-giorno
   - Cerca log `[Gemini]` per API calls

2. **Controlla il JSON parsato**
   - Clicca "Analizza con AI"
   - Nella UI dovrebbe comparire il JSON espanso
   - Se vedi "errore di validazione", il JSON non è valido

3. **Gemini JSON Mode Status**
   - Se fallisce il parsing, controlla che:
     - Backend (api-proxy-server.js) abiliti `responseMimeType: 'application/json'`
     - Gemini API key sia valida
     - Modello sia `gemini-2.5-flash`

4. **Relative Dates**
   - Testa con: "Ieri ho fatto...", "Oggi...", "3 giorni fa ho..."
   - Console dovrebbe loggare: `[parseRelativeDate] ieri → 2026-01-18`

5. **Empty Sessions**
   - Testa con: "Lunedì allenamento. Martedì niente. Mercoledì ancora."
   - Console dovrebbe loggare: `[findDayChunks] Skipping empty session on martedì`

---

## 📊 Expected Results Summary

| Test | Sessioni | PB/Injuries | Key Assertion |
|------|----------|-------------|----------------|
| **A** | 1 (2026-01-18) | 0 | Time: 16.5s (not 16:30), No session for "domani" |
| **B** | 3 (L,Me,V) | 1 PB (100m) | Martedì skipped, "recupero" on Mercoledì |
| **C** | 1 (2026-01-19) | 1 injury | Time: 36.2 (reality, not 35 goal), no "Marco" |

---

## 🚀 Post-Test Checklist

- [ ] Test A passa (date relativa, filtro "domani")
- [ ] Test B passa (multi-giorno, empty skip, PB detect)
- [ ] Test C passa (noise filter, intento vs realtà, infortunio)
- [ ] Console logs sono puliti (niente errori rossi)
- [ ] JSON Mode Gemini funziona (niente fallback lossy)
- [ ] Pronto per production test!

