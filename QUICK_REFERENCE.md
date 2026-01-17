# ⚡ Quick Reference Guide

## 🚀 10-Minute Quick Start

### 1. Clone & Install (2 min)
```bash
git clone https://github.com/yourusername/training-log
cd training-log
npm install
npm run setup
```

### 2. Configure (3 min)
```bash
# Edit .env with your credentials
nano .env

VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
VITE_AI_API_KEY=sk-...
VITE_AI_PROVIDER=openai
```

### 3. Create Database (3 min)
- Go to supabase.com
- New project
- SQL Editor
- Copy & paste `supabase-schema.sql`
- Run

### 4. Test (2 min)
```bash
npm run dev
# Visit http://localhost:3000
```

---

## 🎯 Essential Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Build for production
npm run preview          # Preview production build
npm run setup            # Initial setup wizard
npm run check-env        # Verify environment variables
```

---

## 📝 Key Files by Task

### I Want to...

**...modify the AI parser**
→ `src/services/aiParser.js`

**...change the database schema**
→ `supabase-schema.sql`

**...update the dashboard**
→ `src/components/TrainingDashboard.jsx`

**...customize the input form**
→ `src/components/AITrainingInput.jsx`

**...change colors/styling**
→ `tailwind.config.js` or `src/index.css`

**...add new features**
→ Create new file in `src/components/` or `src/services/`

**...configure deployment**
→ `wrangler.toml` (Cloudflare Pages)

---

## 🔑 Environment Variables Explained

| Variable | Source | Example |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Supabase Dashboard > Settings > API | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API | `eyJhbGc...` |
| `VITE_AI_API_KEY` | OpenAI or Anthropic Console | `sk-...` |
| `VITE_AI_PROVIDER` | Choose one | `openai` or `anthropic` |

---

## 🧠 How It Works (Simplified)

```
User writes: "6x200m recupero 3 minuti"
        ↓
AI Parser reads (openai-api)
        ↓
Returns: {sets: 6, distance: 200, recovery: 180}
        ↓
Save to Supabase
        ↓
Show in Dashboard
```

---

## 🚨 Common Issues & Fixes

### Issue: "VITE_SUPABASE_URL is missing"
**Fix:** Check `.env` file exists and has the variable

### Issue: "OpenAI API error"
**Fix:** Check API key is valid at platform.openai.com

### Issue: "Database connection failed"
**Fix:** Verify schema.sql was executed in Supabase SQL editor

### Issue: "npm run dev fails"
**Fix:** Run `npm install` again, then `npm run dev`

### Issue: "Cloudflare build fails"
**Fix:** Check environment variables in Cloudflare dashboard

---

## 📊 Database Tables Quick Reference

### training_sessions
```sql
id (UUID)
date (DATE)
title (TEXT)
type (pista|palestra|strada|gara|test|scarico|recupero|altro)
rpe (0-10)
feeling (TEXT)
notes (TEXT)
```

### workout_groups
```sql
id (UUID)
session_id (FK → training_sessions)
order_index (INT)
name (TEXT)
notes (TEXT)
```

### workout_sets
```sql
id (UUID)
group_id (FK → workout_groups)
exercise_name (TEXT)
category (sprint|jump|lift|endurance|mobility|drill|other)
sets (INT)
reps (INT)
weight_kg (NUMERIC)
distance_m (NUMERIC)
time_s (NUMERIC)
recovery_s (INT)
notes (TEXT)
```

---

## 🎨 Component Tree

```
App.jsx
├── Header
├── Tabs Navigation
└── Content Area
    ├── AITrainingInput (When tab="input")
    │   ├── DatePicker
    │   ├── Textarea
    │   ├── ParseButton
    │   ├── PreviewArea
    │   │   ├── SessionInfo
    │   │   └── GroupsList
    │   └── SaveButton
    │
    └── TrainingDashboard (When tab="dashboard")
        ├── TimeRangeFilter
        ├── StatsCards
        ├── DistributionChart
        └── SessionsList
```

---

## 🔄 Common Workflows

### Add New Training Type
1. Edit `aiParser.js` → Update SYSTEM_PROMPT
2. Edit database → Add to type CHECK constraint
3. Edit `formatters.js` → Add color mapping

### Change AI Provider
1. Edit `.env` → Set `VITE_AI_PROVIDER=anthropic`
2. Edit `aiParser.js` → Function already supports both

### Add Dashboard Chart
1. Install: `npm install recharts`
2. Create new component in `src/components/`
3. Import in `TrainingDashboard.jsx`

### Deploy to Production
1. Commit all changes: `git add . && git commit -m "message"`
2. Push to GitHub: `git push origin main`
3. Cloudflare auto-deploys

---

## 📱 Responsive Breakpoints (Tailwind)

- `sm:` - 640px (tablets)
- `md:` - 768px (tablets/small desktop)
- `lg:` - 1024px (desktop)
- `xl:` - 1280px (large desktop)

---

## 🎯 Performance Tips

1. **Reduce AI calls:** Cache responses where possible
2. **Database:** Add indexes for frequently queried columns
3. **Bundle:** Vite automatically optimizes, use tree-shaking
4. **API:** Batch requests to OpenAI when possible
5. **UI:** Use React.memo() for expensive components

---

## 🔒 Security Checklist

- [ ] `.env` in `.gitignore`
- [ ] No API keys in code
- [ ] HTTPS enabled (Cloudflare)
- [ ] RLS enabled on Supabase
- [ ] Input validation in place
- [ ] Error messages don't leak info

---

## 📞 Quick Help

| Need Help With | Where to Look |
|---|---|
| Setup | SETUP.md |
| Using the app | USER_GUIDE.md |
| File locations | FILE_STRUCTURE.md |
| Deployment | DEPLOY_CHECKLIST.md |
| Errors | SETUP.md → Troubleshooting |
| Links & resources | RESOURCES.md |
| Code documentation | PROJECT_SUMMARY.md |

---

## 🚀 Next Steps After Setup

1. ✅ Local testing complete
2. ✅ Data looks good
3. ✅ Time to deploy!
   - [ ] Push to GitHub
   - [ ] Connect Cloudflare Pages
   - [ ] Add env vars on Cloudflare
   - [ ] First deploy
   - [ ] Test production version
   - [ ] Share with friends!

---

## 💡 Pro Tips

- 💾 Always commit frequently
- 📝 Comment your changes
- 🧪 Test before deploying
- 📊 Monitor Supabase usage
- 💰 Watch OpenAI billing
- 📱 Test on mobile
- 🌙 Use dark mode (easier on eyes)
- ⚡ Use Vite dev mode for hot reload

---

**Save this file for quick reference!**

Last updated: January 17, 2026
