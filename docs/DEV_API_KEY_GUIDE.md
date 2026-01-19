# 🔑 Guida Rapida - Dev API Key Mode

## ✅ Cosa è stato implementato

Ho implementato la **Soluzione 1 (Dev Mode)** che ti permette di cambiare la chiave API Google Gemini **istantaneamente** senza riavviare il server o modificare file di configurazione.

## 🎯 Come funziona

### 1. Modifiche al Worker (`worker.js`)
- ✅ Aggiunto supporto per header custom `X-Custom-API-Key`
- ✅ Priorità: chiave custom > chiave body > chiave ambiente
- ✅ Header CORS aggiornato per accettare il custom header

### 2. Modifiche al servizio AI (`src/services/aiParser.js`)
- ✅ Aggiunto parametro opzionale `devApiKey` alla funzione `parseTrainingWithAI`
- ✅ Chiave custom inviata tramite header HTTP al worker
- ✅ Supporto per chiavi temporanee senza modificare `.env`

### 3. Modifiche all'interfaccia (`src/components/AITrainingInput.jsx`)
- ✅ Aggiunto pulsante "Modalità Sviluppo - API Key Temporanea"
- ✅ Input campo per inserire la chiave Google Gemini
- ✅ Link diretto a Google AI Studio per generare nuove chiavi
- ✅ Interfaccia nascosta di default per non confondere utenti finali

## 📝 Come usare

### Quando la quota finisce:

1. **Apri l'applicazione** nel browser
2. **Clicca su "Modalità Sviluppo - API Key Temporanea"** (piccolo testo sotto la textarea)
3. **Genera una nuova chiave**:
   - Vai su [Google AI Studio](https://aistudio.google.com/apikey)
   - Crea una nuova API key
   - Copia la chiave (inizia con `AIza...`)
4. **Incolla la chiave** nell'input che appare
5. **Continua a lavorare** normalmente - la nuova chiave sarà usata immediatamente

### Vantaggi:
- ✅ **Zero downtime** - nessun riavvio necessario
- ✅ **Velocissimo** - cambi chiave in 10 secondi
- ✅ **Ideale per sviluppo** - testa più chiavi rapidamente
- ✅ **Non tocca i file** - non serve modificare `.env` o deployare

## 🔧 Dettagli tecnici

### Flusso della chiave API:
```
1. Frontend (AITrainingInput.jsx)
   └─> devApiKey passata a parseTrainingWithAI()
       └─> aiParser.js aggiunge header X-Custom-API-Key
           └─> worker.js legge header e usa quella chiave
               └─> Google Gemini API
```

### Priorità risoluzione chiave (worker.js):
```javascript
const resolvedApiKey = 
  (customKey && customKey.length > 10) ? customKey   // 1. Header custom (dev)
  : (apiKey || env.GEMINI_API_KEY);                  // 2. Body o env
```

## 🚀 Test veloce

1. Avvia il server locale:
   ```bash
   npm run dev
   ```

2. Apri la pagina di inserimento allenamento

3. Clicca su "Modalità Sviluppo"

4. Inserisci una chiave di test

5. Prova a parsare un allenamento

## ⚠️ Note importanti

- La chiave inserita nell'UI **non viene salvata** - è solo in memoria
- Ricaricando la pagina, dovrai reinserirla
- È perfetta per sviluppo, ma per produzione usa le variabili d'ambiente
- La chiave viaggia negli header HTTP (usa HTTPS in produzione)

## 🔒 Sicurezza

Per **produzione**, considera:
- Usare sempre HTTPS
- Mantenere la chiave principale nelle variabili d'ambiente
- Questa feature è pensata per sviluppo/test rapidi

## 📚 Prossimi passi (opzionali)

Se vuoi migliorare ulteriormente:

1. **Salvataggio in localStorage**: Salva la chiave nel browser per non reinserirla a ogni refresh
2. **Rotation automatica**: Implementa la Soluzione 2 con più chiavi e failover
3. **Cache delle richieste**: Implementa la Soluzione 3 per ridurre chiamate durante debug UI

---

**Creato:** 19 Gennaio 2026  
**Implementazione:** Dev API Key Mode (Soluzione 1)
