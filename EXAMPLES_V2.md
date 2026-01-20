# 📚 V2.0 Usage Examples

## Context-Aware AI Parser

### Example 1: PB Detection

**Before (v1.0):**
```javascript
// Input
"100m in 10.5"

// AI Output (blind)
{
  "session": { "title": "Sprint 100m" },
  "groups": [{
    "sets": [{ "distance_m": 100, "time_s": 10.5 }]
  }]
}
// ❌ Non sa se è PB o no
```

**After (v2.0):**
```javascript
// Input
"100m in 10.5"

// Context injected automatically:
// "Current PB: 100m in 10.8s"

// AI Output (context-aware)
{
  "session": { 
    "title": "Sprint 100m - Nuovo PB!",
    "notes": "Miglioramento di 0.3s rispetto al PB precedente (10.8s)"
  },
  "groups": [{
    "sets": [{ 
      "distance_m": 100, 
      "time_s": 10.5,
      "details": { 
        "is_pb_candidate": true,
        "is_test": true 
      }
    }]
  }]
}
// ✅ AI capisce che è un PB!
```

---

## Interactive Parsing

### Example 2: Ambiguous Recovery

**Input:**
```
"4x100m rec 3"
```

**AI Response:**
```json
{
  "session": { "title": "Sprint 4x100m" },
  "groups": [{
    "sets": [
      { "distance_m": 100, "recovery_s": null }
    ]
  }],
  "questions_for_user": [
    {
      "field": "recovery_s",
      "question": "Il recupero di 3 era in minuti o secondi?",
      "options": ["3 secondi", "180 secondi (3 minuti)"]
    }
  ]
}
```

**UI Flow:**
1. Modal appare con domanda
2. Utente seleziona "180 secondi (3 minuti)"
3. `recovery_s` viene aggiornato a `180`
4. Sessione viene salvata

**Code:**
```jsx
const [parsedData, setParsedData] = useState(null);
const [questions, setQuestions] = useState(null);

const handleParse = async (text) => {
  const result = await parseTrainingText(text);
  
  if (result.questions_for_user?.length > 0) {
    setQuestions(result.questions_for_user);
    setParsedData(result);
  } else {
    saveToDB(result);
  }
};

const handleResolveAmbiguity = (answers) => {
  // Applica risposte
  parsedData.groups.forEach(group => {
    group.sets.forEach(set => {
      if (answers.recovery_s) {
        set.recovery_s = parseInt(answers.recovery_s);
      }
    });
  });
  
  saveToDB(parsedData);
  setQuestions(null);
};
```

---

## Proactive Coach Alerts

### Example 3: Volume Spike Detection

**Scenario:**
- Settimana 1: 2000m
- Settimana 2: 2800m (+40%)

**Alert Generated:**
```json
{
  "type": "volume_spike",
  "severity": "high",
  "title": "⚠️ Aumento volume eccessivo",
  "message": "Il volume di questa settimana è aumentato del 40% rispetto alla scorsa (2800m vs 2000m). Rischio infortunio elevato.",
  "recommendation": "Considera di ridurre il volume del 10-15% nei prossimi 2-3 giorni o inserire una sessione di scarico.",
  "data": {
    "currentWeek": { "totalVolume": 2800 },
    "lastWeek": { "totalVolume": 2000 },
    "increase": 40
  }
}
```

**UI Display:**
```jsx
<CoachAlerts />
// Renders:
// [⚠️ Aumento volume eccessivo]
// Il volume è aumentato del 40%...
// 💡 Consiglio: Riduci volume 10-15%
```

---

### Example 4: Injury Risk Alert

**Scenario:**
- Infortunio attivo: Ginocchio (tendinite)
- Sessione: Squat 120kg 5x5

**Alert Generated:**
```json
{
  "type": "injury_risk",
  "severity": "high",
  "title": "🚨 Carico su zona infortunata",
  "message": "Hai eseguito 1 esercizio ad alto carico con un infortunio attivo (Ginocchio).",
  "recommendation": "Evita carichi pesanti su Ginocchio fino a guarigione completa. Considera esercizi a basso impatto.",
  "data": {
    "riskyExercises": [
      { "exercise": "Squat", "injury": "Ginocchio", "severity": "moderate" }
    ]
  }
}
```

---

## Volume Separation

### Example 5: Mixed Session (Track + Gym)

**Input:**
```
"Pista: 4x100m
Palestra: Squat 100kg 5x5, Bench 80kg 4x8"
```

**Statistics Output:**

**Before (v1.0):**
```json
{
  "volume": {
    "distance_m": 400,
    "tonnage_kg": 5060  // Mixed!
  }
}
```

**After (v2.0):**
```json
{
  "volume": {
    "distance_m": 400,
    "tonnage_kg": 5060
  },
  "volumeDetailed": {
    "track": {
      "distance_m": 400,
      "sessions": 1
    },
    "gym": {
      "tonnage_kg": 5060,  // 100*5*5 + 80*4*8
      "sessions": 1
    },
    "endurance": {
      "distance_m": 0,
      "sessions": 0
    }
  }
}
```

**UI Usage:**
```jsx
// Grafico separato per pista e sala
<Chart
  data={[
    { week: 'W1', track: 2400, gym: 12000 },
    { week: 'W2', track: 2800, gym: 10500 }
  ]}
>
  <Line dataKey="track" stroke="blue" name="Pista (m)" />
  <Line dataKey="gym" stroke="red" name="Sala (kg)" />
</Chart>
```

---

## AI Exercise Mapping

### Example 6: Exercise Normalization

**Input Variations:**
```
"Panca piana 80kg 4x8"
"Bench press 80kg 4x8"  
"Distensioni su panca 80kg 4x8"
"Bench 80kg 4x8"
```

**AI Output (all normalized):**
```json
{
  "sets": [{
    "exercise_name": "Bench Press",  // ✅ Standardized
    "category": "lift",
    "weight_kg": 80,
    "sets": 4,
    "reps": 8
  }]
}
```

**Before (v1.0):** Required manual dictionary
**After (v2.0):** AI does it automatically

---

## Database Views

### Example 7: Query Personal Bests

**Before (v1.0):**
```sql
-- Dati ridondanti in race_records
SELECT * FROM race_records 
WHERE is_personal_best = true;
```

**After (v2.0):**
```sql
-- View automatica da workout_sets
SELECT * FROM view_race_records 
WHERE is_personal_best = true;

-- Equivalente a:
SELECT 
  ws.id,
  ts.date,
  ws.distance_m,
  ws.time_s,
  ws.is_personal_best
FROM workout_sets ws
JOIN workout_groups wg ON ws.group_id = wg.id
JOIN training_sessions ts ON wg.session_id = ts.id
WHERE ws.category = 'sprint'
  AND ws.is_personal_best = true
  AND ws.distance_m IS NOT NULL
  AND ws.time_s IS NOT NULL;
```

**Benefit:** No duplication, always in sync!

---

### Example 8: Auto-PB Detection (Trigger)

**Scenario:** Insert new 100m time

**Before (v1.0):**
```javascript
// Manual PB check in application code
const { data: existing } = await supabase
  .from('race_records')
  .select('time_s')
  .eq('distance_m', 100)
  .order('time_s', { ascending: true })
  .limit(1);

const isPB = !existing || newTime < existing[0].time_s;

// Insert in BOTH tables
await supabase.from('workout_sets').insert({ ... });
await supabase.from('race_records').insert({ 
  ..., 
  is_personal_best: isPB 
});
```

**After (v2.0):**
```javascript
// Just insert, trigger handles PB detection
await supabase.from('workout_sets').insert({
  distance_m: 100,
  time_s: 10.5,
  category: 'sprint',
  is_test: true
});

// Trigger automatically:
// 1. Checks if 10.5 < previous best
// 2. Sets is_personal_best = true
// 3. Removes flag from old PB
// ✅ Single write, auto-sync!
```

---

## Anomaly Detection

### Example 9: Impossible Time Warning

**Input:**
```
"100m in 9 secondi"
```

**AI Response:**
```json
{
  "session": { "title": "Sprint 100m" },
  "groups": [{
    "sets": [{ "distance_m": 100, "time_s": 9 }]
  }],
  "warnings": [
    {
      "type": "impossible_time",
      "field": "time_s",
      "message": "100m in 9s sembra impossibile. Record mondiale ~9.58s. Intendevi 60m o 10.9s?"
    }
  ]
}
```

**UI Flow:**
1. Warning badge appare
2. Utente può correggere o confermare
3. Se conferma, salva con nota "verified_unusual"

---

## Security Examples

### Example 10: Rate Limiting

**Test:**
```bash
# Simulate 105 requests in 5 seconds
for i in {1..105}; do
  curl -X POST https://your-worker.workers.dev \
    -H "Content-Type: application/json" \
    -d '{"provider":"gemini","messages":[]}' &
done
wait

# Expected:
# Requests 1-100: ✅ 200 OK
# Requests 101-105: ❌ 429 Too Many Requests
# {
#   "error": {
#     "message": "Troppe richieste. Riprova tra qualche minuto."
#   }
# }
```

**Production Monitoring:**
```javascript
// Cloudflare Worker analytics
// Check: Workers > Analytics > Status codes
// Alert if 429 count > 50/day (possible attack)
```

---

### Example 11: CORS Protection

**Valid Request:**
```javascript
// From https://your-app.vercel.app
fetch('https://your-worker.workers.dev', {
  method: 'POST',
  headers: { 'Origin': 'https://your-app.vercel.app' }
});
// ✅ Response: Access-Control-Allow-Origin: https://your-app.vercel.app
```

**Invalid Request:**
```javascript
// From https://hacker-site.com
fetch('https://your-worker.workers.dev', {
  method: 'POST',
  headers: { 'Origin': 'https://hacker-site.com' }
});
// ❌ CORS error: Origin not allowed
```

---

## Integration Examples

### Example 12: Dashboard with Alerts

```jsx
// src/components/TrainingDashboard.jsx
import CoachAlerts from './CoachAlerts';
import Statistics from './Statistics';

export default function TrainingDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Alerts always on top */}
      <CoachAlerts />
      
      {/* Rest of dashboard */}
      <Statistics />
      {/* ... */}
    </div>
  );
}
```

---

### Example 13: AI Input with Ambiguity Handling

```jsx
// src/components/AITrainingInput.jsx
import { useState } from 'react';
import AmbiguityModal from './AmbiguityModal';
import { parseTrainingText } from '../services/aiParser';

export default function AITrainingInput() {
  const [input, setInput] = useState('');
  const [questions, setQuestions] = useState(null);
  const [parsedData, setParsedData] = useState(null);

  const handleSubmit = async () => {
    const result = await parseTrainingText(input);
    
    if (result.questions_for_user?.length > 0) {
      setParsedData(result);
      setQuestions(result.questions_for_user);
    } else {
      await saveSession(result);
    }
  };

  const handleResolve = (answers) => {
    // Apply answers to parsed data
    const updated = applyAnswers(parsedData, answers);
    saveSession(updated);
    setQuestions(null);
  };

  return (
    <div>
      <textarea 
        value={input} 
        onChange={(e) => setInput(e.target.value)}
        placeholder="Descrivi il tuo allenamento..."
      />
      <button onClick={handleSubmit}>Parse</button>
      
      {questions && (
        <AmbiguityModal
          questions={questions}
          onResolve={handleResolve}
          onSkip={() => setQuestions(null)}
        />
      )}
    </div>
  );
}
```

---

## Advanced: Custom Alert

### Example 14: Create "Overtraining Alert"

```javascript
// src/services/proactiveCoach.js

async function checkOvertrainingAlert() {
  // Get last 2 weeks RPE
  const twoWeeksAgo = subWeeks(new Date(), 2);
  
  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('rpe, date')
    .gte('date', twoWeeksAgo.toISOString())
    .order('date', { ascending: false });
  
  if (!sessions || sessions.length < 10) return null;
  
  // Check if RPE never dropped below 7 in last 10 sessions
  const highRPESessions = sessions
    .slice(0, 10)
    .filter(s => s.rpe >= 7).length;
  
  if (highRPESessions >= 9) {
    return {
      type: 'overtraining',
      severity: 'high',
      title: '🔥 Rischio sovrallenamento',
      message: `9 delle ultime 10 sessioni hanno avuto RPE ≥ 7. Rischio burnout.`,
      recommendation: 'Inserisci 2-3 giorni di riposo completo o settimana di scarico.',
      data: { highRPESessions, totalSessions: 10 }
    };
  }
  
  return null;
}

// Add to generateProactiveAlerts()
export async function generateProactiveAlerts() {
  const alerts = [];
  
  const volumeAlert = await checkVolumeSpikeAlert();
  if (volumeAlert) alerts.push(volumeAlert);
  
  const overtrainingAlert = await checkOvertrainingAlert();  // ADD
  if (overtrainingAlert) alerts.push(overtrainingAlert);
  
  return alerts;
}
```

---

## Summary

**Key Takeaways:**
1. **Context-Aware:** AI knows athlete's PBs, injuries, history
2. **Interactive:** Modal asks clarification on ambiguous data
3. **Proactive:** Alerts prevent injuries before they happen
4. **Separated:** Track/Gym volumes tracked independently
5. **Secure:** CORS + rate limiting protect your API
6. **Robust:** Views eliminate data duplication
7. **Smart:** AI normalizes exercises automatically

**Next Steps:**
- Deploy following [DEPLOYMENT_V2.md](DEPLOYMENT_V2.md)
- Test with real data
- Monitor alerts for first week
- Customize prompts/alerts to your needs

---

**Questions?** Check [QUICK_REFERENCE_V2.md](QUICK_REFERENCE_V2.md)
