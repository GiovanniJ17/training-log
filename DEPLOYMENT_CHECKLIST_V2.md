# ✅ V2.0 Deployment Checklist

**Date:** ________  
**Deployer:** ________  
**Environment:** □ Development  □ Production

---

## 📋 PRE-DEPLOYMENT

### Backup
- [ ] Export database SQL (Supabase Dashboard > Database > Backups)
- [ ] Git commit all local changes
- [ ] Tag current version: `git tag v1.0-stable`
- [ ] Create rollback branch: `git checkout -b rollback-v1`

### Prerequisites
- [ ] Node.js v18+ installed
- [ ] Wrangler CLI installed (`npm i -g wrangler`)
- [ ] Supabase account with database
- [ ] Cloudflare account (free tier OK)
- [ ] Gemini API key ready

---

## 🗄️ DATABASE MIGRATION

### Step 1: Review SQL Script
- [ ] Open `db-refactor-views.sql`
- [ ] Read migration steps (understand what it does)
- [ ] Identify reversible vs irreversible changes

### Step 2: Test on Development DB (if available)
- [ ] Create dev database snapshot
- [ ] Run migration on dev
- [ ] Test queries: `SELECT * FROM view_race_records LIMIT 5;`
- [ ] Verify no data loss

### Step 3: Production Migration
- [ ] Open Supabase Dashboard > SQL Editor
- [ ] Execute STEP 1 (ALTER TABLE - adds columns)
  ```sql
  ALTER TABLE workout_sets ADD COLUMN is_personal_best...
  ```
- [ ] Verify: `\d workout_sets` shows new columns
- [ ] Execute STEP 2 (UPDATE - migrates data)
  ```sql
  UPDATE workout_sets SET is_race = true...
  ```
- [ ] Verify: `SELECT COUNT(*) FROM workout_sets WHERE is_race = true;`
- [ ] Execute STEP 3 (CREATE VIEW - race records)
- [ ] Execute STEP 3 (CREATE VIEW - strength records)
- [ ] Execute STEP 3 (CREATE VIEW - training records)
- [ ] Verify: `SELECT * FROM view_race_records LIMIT 5;`
- [ ] Execute STEP 4 (GRANT permissions)
- [ ] Execute STEP 5 (RENAME old tables - OPTIONAL)
  - [ ] `ALTER TABLE race_records RENAME TO _deprecated_race_records;`
  - [ ] Note: Skip this if you want to keep old tables
- [ ] Execute STEP 6 (CREATE TRIGGER - auto PB detection)
- [ ] Test trigger: Insert dummy workout_set, check is_personal_best

### Step 4: Verify Migration
- [ ] Query views return data
- [ ] No errors in Supabase logs
- [ ] Old frontend still works (backward compatible)

**Time Estimate:** 10-15 minutes  
**Rollback Available:** Yes (see DEPLOYMENT_V2.md)

---

## ☁️ WORKER DEPLOYMENT

### Step 1: Create KV Namespace
```bash
wrangler login
wrangler kv:namespace create "RATE_LIMIT_KV"
```
- [ ] Copy namespace ID (e.g., `abc123...`)
- [ ] Note: ID = ___________________________

### Step 2: Update wrangler.toml
- [ ] Add KV namespace binding:
  ```toml
  [[kv_namespaces]]
  binding = "RATE_LIMIT_KV"
  id = "YOUR_ID_HERE"
  ```
- [ ] Verify file syntax (no trailing commas)

### Step 3: Set Secrets
```bash
wrangler secret put GEMINI_API_KEY
# Paste key when prompted
```
- [ ] Secret set successfully
- [ ] Verify: `wrangler secret list` shows GEMINI_API_KEY

### Step 4: Configure CORS
- [ ] Edit `worker.js`
- [ ] Replace `ALLOWED_ORIGINS`:
  ```javascript
  const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'https://YOUR-PRODUCTION-DOMAIN.vercel.app'  // ⚠️ CHANGE
  ];
  ```
- [ ] Remove wildcard (`*`) origins

### Step 5: Deploy Worker
```bash
wrangler deploy
```
- [ ] Deployment successful
- [ ] Worker URL: _________________________________
- [ ] Test endpoint:
  ```bash
  curl -X POST https://your-worker.workers.dev
  ```
  Expected: Method not allowed or CORS error (good!)

### Step 6: Test Security
- [ ] CORS test (valid origin):
  ```bash
  curl -X POST YOUR_WORKER_URL \
    -H "Origin: http://localhost:5173" \
    -H "Content-Type: application/json" \
    -d '{"provider":"gemini","messages":[]}'
  ```
  Expected: Success or Gemini error (not CORS error)
  
- [ ] Rate limit test (100+ requests):
  ```bash
  for i in {1..105}; do curl -X POST YOUR_WORKER_URL; done
  ```
  Expected: Requests 101-105 return 429

**Time Estimate:** 10 minutes  
**Rollback Available:** Yes (redeploy previous version)

---

## 🎨 FRONTEND UPDATE

### Step 1: Install Dependencies
```bash
cd training-log
npm install date-fns
```
- [ ] Dependencies installed
- [ ] No errors

### Step 2: Update Environment Variables
- [ ] Edit `.env` (production):
  ```
  VITE_WORKER_URL=https://your-worker.workers.dev
  ```
- [ ] Edit `.env.local` (development - optional):
  ```
  VITE_GEMINI_API_KEY=your-dev-key  # Only for local dev
  ```
- [ ] **Remove** `VITE_GEMINI_API_KEY` from `.env` (production)
  - ⚠️ API key should NEVER be in production frontend!

### Step 3: Integrate Components (Manual)

#### Add CoachAlerts to Dashboard
- [ ] Edit `src/components/TrainingDashboard.jsx`
- [ ] Add import: `import CoachAlerts from './CoachAlerts';`
- [ ] Add component in render:
  ```jsx
  return (
    <div>
      <CoachAlerts />  {/* Add this */}
      {/* ...rest of dashboard */}
    </div>
  );
  ```

#### Add AmbiguityModal to AI Input
- [ ] Edit `src/components/AITrainingInput.jsx`
- [ ] Add import: `import AmbiguityModal from './AmbiguityModal';`
- [ ] Add state: `const [questions, setQuestions] = useState(null);`
- [ ] Add modal in render (see EXAMPLES_V2.md for full code)
- [ ] Handle questions from AI response

### Step 4: Build
```bash
npm run build
```
- [ ] Build successful
- [ ] No errors (warnings OK)
- [ ] Check `dist/` folder exists

### Step 5: Deploy Frontend
**Vercel:**
```bash
vercel deploy --prod
```

**Netlify:**
```bash
netlify deploy --prod
```

**Manual:**
```bash
# Upload dist/ to your hosting provider
```

- [ ] Deployment successful
- [ ] Production URL: _________________________________

### Step 6: Verify Deployment
- [ ] Visit production URL
- [ ] No console errors
- [ ] CoachAlerts visible (may be empty if no alerts)
- [ ] Test AI input parsing
- [ ] Check Network tab: requests go to worker, not direct to Gemini

**Time Estimate:** 15-20 minutes  
**Rollback Available:** Yes (redeploy previous build)

---

## 🧪 POST-DEPLOYMENT TESTING

### Functional Tests

#### AI Parser with Context
- [ ] Input: "100m in 10.5" (where your PB is 10.8)
- [ ] Expected: AI mentions it's close to PB or is a new PB
- [ ] Result: ___________

#### Interactive Parsing
- [ ] Input: "4x100m rec 3"
- [ ] Expected: Modal asks "3 seconds or 3 minutes?"
- [ ] Result: ___________

#### Volume Separation
- [ ] Input: Mixed session (track + gym)
- [ ] Check statistics page
- [ ] Expected: `volumeDetailed.track` and `.gym` separated
- [ ] Result: ___________

#### Proactive Alerts
- [ ] Scenario: Increase volume >20% from last week
- [ ] Expected: Alert appears in dashboard
- [ ] Result: ___________
- [ ] Alternative: Check after 1 week of real usage

#### Database Views
- [ ] Run query: `SELECT * FROM view_race_records WHERE is_personal_best = true;`
- [ ] Expected: Returns your PBs
- [ ] Result: ___________

### Security Tests

#### CORS Protection
- [ ] Open browser DevTools
- [ ] Try fetching worker from different domain:
  ```javascript
  fetch('https://your-worker.workers.dev', {
    method: 'POST',
    headers: { 'Origin': 'https://google.com' }
  })
  ```
- [ ] Expected: CORS error
- [ ] Result: ___________

#### Rate Limiting
- [ ] Use rate limit test script (see WRANGLER_CONFIG_V2.md)
- [ ] Expected: 429 after 100 requests in 15 min
- [ ] Result: ___________

#### API Key Security
- [ ] View page source (Ctrl+U)
- [ ] Search for "AIza" or "GEMINI"
- [ ] Expected: No API key visible
- [ ] Result: ___________

### Performance Tests

#### AI Response Time
- [ ] Parse a typical session
- [ ] Measure time (Network tab)
- [ ] Expected: < 3 seconds
- [ ] Actual: _______ seconds

#### Statistics Load Time
- [ ] Open statistics page
- [ ] Check load time
- [ ] Expected: < 2 seconds
- [ ] Actual: _______ seconds

#### View Query Performance
- [ ] Run: `EXPLAIN ANALYZE SELECT * FROM view_race_records;`
- [ ] Check execution time
- [ ] Expected: < 100ms
- [ ] Actual: _______ ms

---

## 📊 MONITORING SETUP

### Cloudflare Analytics
- [ ] Open Cloudflare Dashboard > Workers > Analytics
- [ ] Bookmark URL for daily checks
- [ ] Set up alert: Email if error rate > 5%

### Supabase Logs
- [ ] Open Supabase Dashboard > Logs
- [ ] Filter by "error"
- [ ] Check no trigger errors

### Frontend Monitoring (Optional)
- [ ] Set up Sentry / LogRocket (optional)
- [ ] Add error boundary components

---

## 📝 DOCUMENTATION

- [ ] Update README.md with v2.0 changes
- [ ] Add link to DEPLOYMENT_V2.md
- [ ] Document any custom changes made during deployment
- [ ] Update team wiki / docs with new features

---

## ✅ SIGN-OFF

### Deployment Complete
- [ ] All tests passing
- [ ] No critical errors
- [ ] Rollback plan documented
- [ ] Team notified

**Deployed By:** ____________________  
**Date:** _____ / _____ / _____  
**Time:** _____ : _____  
**Version:** v2.0  

### Post-Deployment Monitoring (24h)
- [ ] +1 hour: Check for errors
- [ ] +6 hours: Review analytics
- [ ] +24 hours: Full health check

**Notes:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

## 🆘 ROLLBACK (If Needed)

### Database Rollback
```sql
-- See DEPLOYMENT_V2.md section "ROLLBACK"
DROP VIEW view_race_records;
ALTER TABLE _deprecated_race_records RENAME TO race_records;
-- ... (full script in deployment guide)
```

### Worker Rollback
```bash
git checkout rollback-v1 worker.js
wrangler deploy
```

### Frontend Rollback
```bash
git checkout v1.0-stable
npm run build
vercel deploy --prod  # or your deploy command
```

**Rollback Initiated:** _____ (time) by _____ (name)  
**Reason:** ________________________________________________

---

**🎉 DEPLOYMENT SUCCESSFUL!**

Next: Monitor for 48h, then celebrate! 🚀
