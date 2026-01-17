# Training Log - AI-Powered Workout Tracker

Sistema intelligente di tracciamento allenamenti per atleti di atletica leggera, con inserimento dati tramite intelligenza artificiale.

## 🎯 Il Problema che Risolve

Gli atleti professionisti hanno bisogno di tracciare allenamenti complessi e variegati (pista, palestra, strada). I sistemi tradizionali con form rigidi sono:
- ❌ Troppo lenti da compilare
- ❌ Poco flessibili per allenamenti diversificati
- ❌ Inaccurati nei dati inseriti di fretta
- ❌ Non standardizzano i dati per analisi statistiche

## ✨ La Soluzione: Input AI

Invece di form complicati, l'atleta **scrive liberamente** il suo allenamento:

```
Pista oggi: riscaldamento 2km + drill.
6x200m recupero 3 minuti, tempi 25-26sec.
Palestra: squat 3x8 80kg, affondi 3x10.
RPE 8/10, ottime sensazioni!
```

L'**AI interpreta automaticamente** e crea dati strutturati nel database:
- ✅ Nomi esercizi standardizzati
- ✅ Unità di misura uniformi
- ✅ Categorizzazione intelligente
- ✅ Separazione logica dei gruppi
- ✅ Estrazione automatica RPE e sensazioni

## 🏗️ Architettura

```
┌─────────────────┐
│  Frontend React │  ← Input testuale + Dashboard
└────────┬────────┘
         │
    ┌────▼────┐
    │   AI    │  ← OpenAI GPT-4 / Anthropic Claude
    │ Parser  │     Interpreta testo → JSON strutturato
    └────┬────┘
         │
    ┌────▼────────┐
    │  Supabase   │  ← PostgreSQL Database
    │  PostgreSQL │     3 tabelle: sessions → groups → sets
    └─────────────┘
         │
    ┌────▼──────────┐
    │  Cloudflare   │  ← Edge Hosting
    │    Pages      │     Deploy automatico da GitHub
    └───────────────┘
```

## 📊 Schema Database

```sql
training_sessions          workout_groups           workout_sets
┌────────────────┐        ┌──────────────┐        ┌────────────────┐
│ id             │───┐    │ id           │───┐    │ id             │
│ date           │   └───→│ session_id   │   └───→│ group_id       │
│ title          │        │ order_index  │        │ exercise_name  │
│ type           │        │ name         │        │ category       │
│ rpe            │        │ notes        │        │ sets/reps      │
│ feeling        │        └──────────────┘        │ weight_kg      │
│ notes          │                                │ distance_m     │
└────────────────┘                                │ time_s         │
                                                  │ recovery_s     │
                                                  └────────────────┘
```

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/tuousername/training-log
cd training-log

# 2. Install
npm install

# 3. Configure (see SETUP.md)
cp .env.example .env
# Edit .env with your keys

# 4. Run
npm run dev
```

Visita `http://localhost:3000`

## 📝 Guida Setup Completa

Leggi [SETUP.md](SETUP.md) per istruzioni dettagliate su:
1. Setup Supabase (database)
2. Configurazione API AI (OpenAI/Anthropic)
3. Deploy Cloudflare Pages
4. Troubleshooting

## 💡 Esempi di Input

### Esempio 1: Pista
```
Riscaldamento: 2km corsa + 10min drill
Lavoro: 8x200m rec 4min, media 25sec
Defaticamento: 1km
RPE 9/10, gambe molto reattive
```

### Esempio 2: Palestra
```
Squat 4x6 90kg
Stacchi 3x8 100kg  
Panca 3x10 70kg
Core: plank 3x60sec
RPE 7/10
```

### Esempio 3: Misto
```
Mattina pista: 6x300m rec 5min
Pomeriggio palestra gambe: squat 3x8 85kg, affondi 3x10
Sentivo stanchezza ma ho completato tutto
RPE 8
```

## 🎨 Features

- ✅ **Input AI intelligente** con preview prima del salvataggio
- ✅ **Dashboard statistiche** con metriche chiave
- ✅ **Standardizzazione automatica** per analisi accurate
- ✅ **Responsive design** per mobile e desktop
- ✅ **Deploy automatico** su Cloudflare Pages
- ✅ **Database scalabile** con Supabase

## 🛠️ Tech Stack

| Categoria | Tecnologia |
|-----------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI GPT-4 / Anthropic Claude |
| Hosting | Cloudflare Pages |
| Icons | Lucide React |
| Date | date-fns |

## 📈 Statistiche Generate

Il sistema calcola automaticamente:
- 📊 Sessioni totali per periodo (settimana/mese/anno)
- 💪 RPE medio
- 🎯 Distribuzione tipi allenamento
- 📅 Storico completo sessioni
- 🏋️ Volume totale per esercizio (futuro)
- 📉 Trend performance (futuro)

## 🔐 Sicurezza

- Environment variables per API keys sensibili
- Row Level Security (RLS) su Supabase
- HTTPS su Cloudflare Pages
- Input sanitization e validazione
- No hardcoded credentials

## 📂 Struttura Progetto

```
training-log/
├── src/
│   ├── components/
│   │   ├── AITrainingInput.jsx      # Input AI principale
│   │   └── TrainingDashboard.jsx    # Dashboard statistiche
│   ├── services/
│   │   ├── aiParser.js              # Parsing AI
│   │   └── trainingService.js       # CRUD Supabase
│   ├── hooks/
│   │   └── useTrainingHints.js      # Suggerimenti real-time
│   ├── utils/
│   │   └── formatters.js            # Utility formattazione
│   ├── lib/
│   │   └── supabase.js              # Client Supabase
│   └── App.jsx
├── supabase-schema.sql              # Schema DB
├── supabase-seed.sql                # Dati esempio
├── SETUP.md                          # Guida setup
└── package.json
```

## 🧪 Testing

```bash
# Dati di esempio nel database
# Esegui in Supabase SQL Editor:
# File: supabase-seed.sql

# Test locale
npm run dev

# Build produzione
npm run build
npm run preview
```

## 🌍 Deploy Production

### GitHub + Cloudflare Pages

```bash
# 1. Push su GitHub
git add .
git commit -m "Initial commit"
git push origin main

# 2. Collega a Cloudflare Pages
# Dashboard → Pages → Connect GitHub → Select repo

# 3. Configure build:
Build command: npm run build
Build output: dist

# 4. Add environment variables in Cloudflare
```

## 🗺️ Roadmap

### v1.1 (Next)
- [ ] Autenticazione utente
- [ ] Grafici performance
- [ ] Export CSV/PDF
- [ ] Filtri avanzati

### v1.2
- [ ] PWA/Offline mode
- [ ] Template allenamenti
- [ ] Notifiche
- [ ] Mobile ottimizzato

### v2.0
- [ ] Analisi AI performance
- [ ] Suggerimenti personalizzati
- [ ] Integrazione wearables
- [ ] App mobile nativa

## 🤝 Contribuire

Pull requests benvenute! Per modifiche importanti, apri prima un issue.

## 📄 License

MIT

## 👤 Autore

Creato per atleti professionisti di atletica leggera.

---

**Built with ❤️ for athletes, powered by AI**
