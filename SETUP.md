# Setup Completo - Training Log

## 📋 Prerequisiti

1. **Node.js** (v18 o superiore)
2. **Account Supabase** (gratuito)
3. **Account Cloudflare** (gratuito)
4. **API Key OpenAI o Anthropic**

---

## 🚀 Setup Passo per Passo

### 1. Setup Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto
2. Nel dashboard, vai su **SQL Editor**
3. Copia e incolla il contenuto di `supabase-schema.sql`
4. Esegui lo script per creare tutte le tabelle
5. Vai su **Settings > API** e copia:
   - `Project URL` (VITE_SUPABASE_URL)
   - `anon public` key (VITE_SUPABASE_ANON_KEY)

### 2. Setup API AI

**Opzione A - OpenAI:**
1. Vai su [platform.openai.com](https://platform.openai.com)
2. Crea una API key
3. Copia la chiave (VITE_AI_API_KEY)
4. Usa `VITE_AI_PROVIDER=openai`

**Opzione B - Anthropic (Claude):**
1. Vai su [console.anthropic.com](https://console.anthropic.com)
2. Crea una API key
3. Copia la chiave (VITE_AI_API_KEY)
4. Usa `VITE_AI_PROVIDER=anthropic`

### 3. Configurazione Locale

```bash
# 1. Installa dipendenze
npm install

# 2. Crea file .env
cp .env.example .env

# 3. Modifica .env con i tuoi valori
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhb...
# VITE_AI_API_KEY=sk-...
# VITE_AI_PROVIDER=openai

# 4. Avvia il server di sviluppo
npm run dev
```

Il sito sarà disponibile su `http://localhost:3000`

### 4. Test Locale

1. Apri il browser su `http://localhost:3000`
2. Vai su "Nuovo Allenamento"
3. Inserisci una descrizione tipo:
   ```
   Pista oggi: riscaldamento 2km, poi 6x200m recupero 3 minuti.
   Palestra: squat 3x8 80kg. RPE 8/10, mi sentivo bene!
   ```
4. Clicca "Interpreta con AI"
5. Verifica l'anteprima e salva

---

## 🌐 Deploy su Cloudflare Pages

### Metodo 1: Dashboard Cloudflare (Raccomandato)

1. **Connetti GitHub:**
   - Push il codice su GitHub
   - Vai su [dash.cloudflare.com](https://dash.cloudflare.com)
   - Pages > Create a project > Connect to Git
   - Seleziona il repository `training-log`

2. **Configura Build:**
   ```
   Build command: npm run build
   Build output directory: dist
   ```

3. **Aggiungi Environment Variables:**
   Vai su Settings > Environment variables e aggiungi:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhb...
   VITE_AI_API_KEY=sk-...
   VITE_AI_PROVIDER=openai
   ```

4. **Deploy:**
   - Salva e fai il primo deploy
   - Ad ogni push su GitHub, verrà fatto un deploy automatico
   - Il sito sarà su `https://training-log.pages.dev`

### Metodo 2: Wrangler CLI

```bash
# 1. Installa Wrangler
npm install -g wrangler

# 2. Login
wrangler login

# 3. Build
npm run build

# 4. Deploy
wrangler pages deploy dist --project-name=training-log

# 5. Configura variabili d'ambiente (dopo primo deploy)
# Vai su Cloudflare Dashboard > Pages > training-log > Settings
```

---

## 📊 Verifica Funzionamento

1. **Test inserimento sessione:**
   - Descrivi un allenamento in linguaggio naturale
   - L'AI dovrebbe interpretarlo correttamente
   - I dati dovrebbero apparire nella dashboard

2. **Test database:**
   - Vai su Supabase > Table Editor
   - Verifica che le sessioni siano salvate

3. **Test statistiche:**
   - Inserisci 3-4 sessioni diverse
   - Vai sulla Dashboard
   - Verifica che le statistiche siano corrette

---

## 🔧 Risoluzione Problemi

**Errore: "Missing Supabase environment variables"**
- Verifica che il file .env contenga tutte le variabili
- Riavvia il dev server dopo aver modificato .env

**Errore: "Errore API OpenAI"**
- Verifica che la API key sia valida
- Controlla di avere crediti disponibili su OpenAI
- Verifica che VITE_AI_PROVIDER sia impostato correttamente

**Errore: "Failed to fetch" su Supabase**
- Verifica che l'URL di Supabase sia corretto
- Controlla che lo schema SQL sia stato eseguito
- Verifica le policy RLS nel dashboard Supabase

**Il deploy su Cloudflare fallisce:**
- Verifica che le variabili d'ambiente siano configurate
- Controlla i build logs nel dashboard Cloudflare
- Assicurati che `dist` sia la directory di output

---

## 📱 Utilizzo

### Inserimento Sessione

Scrivi liberamente il tuo allenamento, l'AI capisce:
- **Distanze**: "200m", "2km", "400 metri"
- **Tempi**: "25 secondi", "1:30", "90sec"
- **Serie e ripetizioni**: "3x8", "6 serie da 10"
- **Pesi**: "80kg", "100 chili"
- **Recuperi**: "3 minuti", "90 secondi recupero"
- **RPE**: "RPE 8", "intensità 7/10"
- **Sensazioni**: "mi sentivo bene", "gambe pesanti"

### Esempi Pratici

**Esempio 1 - Pista velocità:**
```
Pista stamattina:
- Riscaldamento: 2km + 10min drill
- Lavoro: 8x200m con recupero 4 minuti, tempi tra 24-25 secondi
- Defaticamento: 1km corsa lenta
RPE 9/10, ottima sessione
```

**Esempio 2 - Palestra forza:**
```
Palestra:
Squat 4x5 100kg
Stacchi rumeni 3x8 90kg
Panca 3x8 75kg
Core: plank 3x60sec
RPE 7/10
```

**Esempio 3 - Doppio allenamento:**
```
Mattina pista: 6x300m rec 5min, media 42sec
Pomeriggio palestra gambe: squat 3x6 95kg, affondi bulgari 3x10 
RPE complessivo 8/10, un po' stanco al pomeriggio
```

---

## 🎯 Prossimi Sviluppi Suggeriti

1. **Autenticazione utente** (Supabase Auth)
2. **Grafici avanzati** (Chart.js / Recharts)
3. **Export dati** (CSV, PDF)
4. **Mobile app** (React Native)
5. **Analisi AI delle performance** (trend, suggerimenti)
6. **Integrazione wearables** (Garmin, Polar, ecc.)

Buon allenamento! 🏃‍♂️💪
