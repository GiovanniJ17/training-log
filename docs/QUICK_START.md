# ⚡ Quick Reference - Estrazione Automatica Profilo

## 🎯 TL;DR

Scrivi il tuo allenamento con **una o più** di queste keyword:
- **PB gara**: `{distanza}m {tempo} **PB**` → Race record
- **Massimali**: `{esercizio} {peso}kg **massimale**` → Strength record  
- **Infortuni**: `{tipo} {corpo} **lieve/moderato/grave**` → Injury record

Tutto si salva **automaticamente** nel Profilo Atleta! No modali, no compilazione extra.

---

## 📝 Esempi Veloci

### ✅ Funzionano
```
"Pista: 100m 10.5sec PB"
"Squat 100kg massimale"
"Deadlift 150kg PB"
"Dolore spalla lieve"
"Infortunio caviglia"
"Panca 75kg nuovo massimale"
"200m in 20.3 sec nuovo record"
```

### ❌ NON funzionano
```
"Ho fatto 100m in 10.5" (manca PB)
"Squat 100" (manca kg)
"Male alla spalla" (pattern non riconosciuto)
"Corsa veloce" (nessun numero)
```

---

## 🏃 Sessione Tipo

### Input
```
Pista: 100m 10.5sec PB, 4x200m 22-23-24-23sec
Squat 110kg massimale in palestra
Dolore ginocchio lieve alla fine
Intensità 7/10, RPE 8
```

### Auto-estratto
```
✅ Race records
- 100m 10.5s (PB)

✅ Strength records
- Squat 110kg

✅ Injury records
- Dolore al ginocchio (lieve)
```

### Messaggio Output
```
✅ Sessione salvata!
• 1 PB aggiunto(i) automaticamente
• 1 infortunio(i) registrato(i)
```

---

## 🔤 Keyword Accettati

### Race PB (uno di questi)
- `PB`
- `personal best`
- `nuovo record`
- `miglior tempo`

### Strength PB (uno di questi)
- `PB`
- `personal best`
- `massimale`
- `nuovo massimale`

### Injury Type
- `infortunio`
- `dolore`
- `lesione`
- `strappo muscolare`
- `contusione`
- `distorsione`
- `tendinite`
- `infiammazione`

### Injury Severity (opzionale, default=moderato)
- `lieve` / `leggero` / `minore` → Minor
- `grave` / `serio` / `importante` → Severe

---

## 💪 Esercizi Riconosciuti

```
Squat, Bench, Panca, Deadlift, Stacco, Clean, 
Jerk, Press, Military Press, Trazioni, Trazione
```

### Mapping Automatico
- Squat → `squat`
- Bench/Panca → `bench`
- Deadlift/Stacco → `deadlift`
- Clean → `clean`
- Jerk → `jerk`
- Press/Military Press → `press`
- Trazioni/Trazione → `pull`

---

## 🗺️ Parti del Corpo Riconosciute

```
Spalla (sx/dx), Gomito, Polso, Schiena (alta/bassa),
Fianco, Anca, Coscia, Ginocchio (sx/dx), Caviglia,
Piede, Gamba, Petto, Addominale
```

---

## 📊 Test Coverage

```
✅ 100% (7/7 test cases passed)
- PB gara singolo e multipli
- Massimali singoli e multipli
- Infortuni con diverse gravità
- Combo PB + Infortunio + Massimale
```

Run: `node scripts/test-extraction.js`

---

## ⚠️ Gotchas

1. **Virgola vs Punto**: "100,5kg" o "100.5kg" → entrambi OK
2. **Minuscole vs Maiuscole**: "SQUAT", "squat", "Squat" → tutti OK
3. **Spazi**: "100 m" vs "100m" → entrambi OK
4. **Tempo**: "1:30" = 90s, "1'30"" = 90s, "90sec" = 90s
5. **Gravità**: Se non specificata → "moderato" (default)

---

## 🎬 Workflow Completo

```
1. Clicca "Inserimento Intelligente"
   ↓
2. Scrivi descrizione (con PB/infortuni/massimali)
   ↓
3. Clicca "Parse" (AI elabora)
   ↓
4. Verifica preview
   ↓
5. Clicca "Salva"
   ↓
6. ✅ Sessione + Records auto-salvati
   ↓
7. Vai a "Profilo Atleta" per vederli
```

---

## 🔗 Link Utili

- **Estrazione completa**: docs/EXTRACTION_GUIDE.md
- **Sistema completo**: SYSTEM_COMPLETE.md
- **Test patterns**: scripts/test-extraction.js
- **Profilo atleta**: src/components/AthleteProfile.jsx
- **Parser AI**: src/services/aiParser.js

---

## 🐛 Se Non Funziona

1. **Niente estratto**: controlla keyword esatti (PB, massimale, dolore)
2. **Numero non riconosciuto**: assicurati sia nel formato corretto (100m non "100 metro")
3. **Esercizio sconosciuto**: usa uno dei 13 riconosciuti sopra
4. **Parte corpo non riconosciuta**: usa una delle 12 riconosciute
5. **Dubbio**: copia in `scripts/test-extraction.js` e testa!

---

**Ultima aggiornamento**: 25 gennaio 2026  
**Versione**: 1.0 - Ready to Use 🚀
