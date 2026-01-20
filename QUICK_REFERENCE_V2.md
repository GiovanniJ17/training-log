# 🚀 V2.0 Quick Reference

## New Files Created

### Services
- `src/services/contextService.js` - RAG pattern, recupera contesto atleta
- `src/services/aiSchema.js` - JSON Schema per Gemini structured output
- `src/services/proactiveCoach.js` - Alert system (volume spike, injury risk, etc)

### Components
- `src/components/AmbiguityModal.jsx` - Human-in-the-loop UI
- `src/components/CoachAlerts.jsx` - Proactive alerts display

### Database
- `db-refactor-views.sql` - Migration script (views + triggers)

### Documentation
- `DEPLOYMENT_V2.md` - Step-by-step deployment guide
- `REFACTORING_SUMMARY.md` - Technical analysis

---

## Modified Files

### Critical Changes
- `worker.js` - Security (CORS + rate limiting)
- `src/services/aiParser.js` - Context injection + structured output
- `src/services/statisticsService.js` - Volume separation

---

## Quick Start (Developer)

### 1. Local Development

```bash
# Install dependencies
npm install date-fns

# No code changes needed for local dev
npm run dev
```

### 2. Test New Features

#### Test Context Service
```javascript
import { getAthleteContext } from './services/contextService';

const context = await getAthleteContext();
console.log(context); // Vedi PB, infortuni, pattern
```

#### Test Proactive Coach
```javascript
import { generateProactiveAlerts } from './services/proactiveCoach';

const alerts = await generateProactiveAlerts();
console.log(alerts); // Vedi alert generati
```

#### Test Structured Output
```javascript
import { TRAINING_SESSION_SCHEMA } from './services/aiSchema';

// Il parser ora usa questo schema automaticamente
// Nessuna modifica richiesta nel tuo codice
```

---

## API Changes (Backward Compatible)

### Statistics Service

**OLD:**
```javascript
const stats = calculateKPIs(sessions, races, strength);
console.log(stats.volume); // { distance_m: 5000, tonnage_kg: 12000 }
```

**NEW (v2.0):**
```javascript
const stats = calculateKPIs(sessions, races, strength);

// Retrocompatibile
console.log(stats.volume); // { distance_m: 5000, tonnage_kg: 12000 }

// Nuova struttura dettagliata
console.log(stats.volumeDetailed);
// {
//   track: { distance_m: 2400, sessions: 3 },
//   gym: { tonnage_kg: 12000, sessions: 2 },
//   endurance: { distance_m: 2600, sessions: 1 }
// }
```

---

## Database Schema Changes

### New Columns in `workout_sets`

```sql
ALTER TABLE workout_sets ADD COLUMN:
- is_personal_best BOOLEAN DEFAULT false
- is_race BOOLEAN DEFAULT false  
- is_test BOOLEAN DEFAULT false
- intensity INTEGER (0-10)
```

### New Views (Replace Tables)

```sql
-- Use these instead of old tables
SELECT * FROM view_race_records;      -- Sostituisce race_records
SELECT * FROM view_strength_records;  -- Sostituisce strength_records
SELECT * FROM view_training_records;  -- Sostituisce training_records
```

**⚠️ Important:** Old tables renamed to `_deprecated_*` (not deleted, for rollback)

---

## Environment Variables

### Required (Production)

```bash
# .env
VITE_WORKER_URL=https://your-worker.workers.dev
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Optional (Dev Mode)

```bash
# .env.local
VITE_GEMINI_API_KEY=AIzaSyXXX...  # Solo per dev, non usare in prod!
```

---

## Worker Configuration

### wrangler.toml Changes

```toml
# Add this section
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_KV_NAMESPACE_ID"

# Environment variables (secrets)
[vars]
# Leave empty, use wrangler secret put invece
```

### Set Secrets

```bash
wrangler secret put GEMINI_API_KEY
# Paste your key when prompted
```

---

## Common Tasks

### Add New Alert Type

1. Edit `src/services/proactiveCoach.js`
2. Create new function `checkXXXAlert()`
3. Add to `generateProactiveAlerts()` array

```javascript
async function generateProactiveAlerts() {
  const alerts = [];
  
  const volumeAlert = await checkVolumeSpikeAlert();
  if (volumeAlert) alerts.push(volumeAlert);
  
  // ADD NEW ALERT HERE
  const myAlert = await checkMyNewAlert();
  if (myAlert) alerts.push(myAlert);
  
  return alerts;
}
```

### Customize AI Prompt

Edit `src/services/aiParser.js`:

```javascript
const AI_SYSTEM_PROMPT = `
You are an expert...

// ADD YOUR CUSTOM RULES HERE

CRITICAL RULES:
1. ...
`;
```

### Add Field to Schema

Edit `src/services/aiSchema.js`:

```javascript
export const TRAINING_SESSION_SCHEMA = {
  type: 'object',
  properties: {
    session: {
      // ...
      myNewField: {  // ADD HERE
        type: 'string',
        description: 'My description'
      }
    }
  }
};
```

---

## Testing

### Manual Test Checklist

```bash
# 1. Test AI Parser con context
# Input: "100m in 10.5" (dove PB è 10.8)
# Expected: AI rileva potenziale PB

# 2. Test Ambiguity Modal
# Input: "4x100 rec 3"
# Expected: Modal chiede "3 secondi o 3 minuti?"

# 3. Test Volume Separation
# Input: Sessione pista + sala
# Expected: volumeDetailed.track e .gym separati

# 4. Test Proactive Alerts
# Scenario: Incrementa volume >20% in una settimana
# Expected: Alert "Volume spike" appare

# 5. Test Rate Limiting
# Scenario: 105 requests in 15min
# Expected: Request 101-105 ricevono 429

# 6. Test CORS
# Scenario: Request da dominio non autorizzato
# Expected: CORS error
```

---

## Debugging

### Enable Verbose Logging

```javascript
// contextService.js
export async function getAthleteContext() {
  const context = { /* ... */ };
  console.log('[DEBUG] Athlete Context:', context);  // ADD THIS
  return formatContextForAI(context);
}

// proactiveCoach.js
async function checkVolumeSpikeAlert() {
  console.log('[DEBUG] Checking volume spike...');  // ADD THIS
  // ...
}
```

### Check Worker Logs

```bash
wrangler tail
# Real-time logs from Cloudflare Worker
```

### Check Supabase Logs

Dashboard > Logs > Filter by "error"

---

## Performance Tips

### Reduce Context Service Load

```javascript
// contextService.js
async function getPersonalBests() {
  // Change .limit(10) to .limit(5) for faster queries
  .limit(5);
}
```

### Cache Athlete Context

```javascript
// Add caching (future enhancement)
let cachedContext = null;
let cacheTime = null;

export async function getAthleteContext() {
  if (cachedContext && Date.now() - cacheTime < 60000) {
    return cachedContext; // Cache for 1 minute
  }
  
  const context = await fetchContext();
  cachedContext = context;
  cacheTime = Date.now();
  return context;
}
```

---

## Migration Checklist

- [ ] Backup database (SQL export)
- [ ] Run `db-refactor-views.sql` in Supabase
- [ ] Create KV namespace in Cloudflare
- [ ] Update `wrangler.toml` with KV ID
- [ ] Set CORS domains in `worker.js`
- [ ] Deploy worker: `wrangler deploy`
- [ ] Test worker endpoint
- [ ] Add `CoachAlerts` to dashboard UI
- [ ] Add `AmbiguityModal` to AI input UI
- [ ] `npm run build && npm run deploy`
- [ ] Run manual test checklist
- [ ] Monitor for 24h (check errors)

---

## Rollback

```bash
# Worker
git checkout HEAD~1 worker.js
wrangler deploy

# Database
psql < rollback.sql  # (provided in DEPLOYMENT_V2.md)

# Frontend
git checkout HEAD~1
npm run build && npm run deploy
```

---

## Support

- 📖 Full docs: [DEPLOYMENT_V2.md](DEPLOYMENT_V2.md)
- 📊 Technical analysis: [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)
- 🐛 Issues: GitHub Issues
- 💬 Questions: Team chat

---

**Version:** 2.0  
**Last Updated:** 2026-01-20  
**Status:** ✅ Production Ready
