# Logging Debug Guide - AI Parser Flow

## Summary
Comprehensive logging has been added throughout the AI parsing pipeline to debug why the "Interpreta con AI" button fails silently.

## Logging Points Added

### 1. **Cloudflare Worker** (`worker.js`)
Logs incoming requests and responses:
- `[Worker] Incoming request:` - Shows method, origin, URL, headers
- `[Worker] Parsing worker URL...` - Request parsing
- `[Worker] Sending to Gemini API...` - Before Gemini call
- `[Worker] Gemini response:` - Response status and error details

**To view:** Open DevTools → Network tab → Click the Worker request → Look for Worker console logs

---

### 2. **Frontend Component** (`src/components/AITrainingInput.jsx`)
Logs button clicks and parsing flow:
- `[AITrainingInput] Starting parse with text: [preview]` - User input captured
- `[AITrainingInput] Parse result: [result]` - Success response
- `[AITrainingInput] ❌ Parse error: [error]` - Error caught

**To view:** Open DevTools → Console tab → Look for logs starting with `[AITrainingInput]`

---

### 3. **AI Parser Service** (`src/services/aiParser.js`)
Most detailed logs - traces the entire parsing pipeline:

#### Start of parsing:
```
[parseSingleDay] Starting parse for date: [date] text length: [N]
[Parser] About to fetch from: [URL]
[Parser] Request body size: [bytes]
[Parser] Sending fetch request...
```

#### Response handling:
```
[Parser] Fetch response received, status: [200/500/etc]
[Parser] Response data received, keys: [choices, error, etc]
[Parser] Extracted content from choices[0].message.content, length: [N]
```

#### JSON parsing:
```
[Parser] JSON string after trim, length: [N] first 100 chars: [preview]
[Parser] After sanitization, length: [N]
[Parser] JSON parsing successful, parsed keys: [session, groups, etc]
```

#### Final validation:
```
[Parser] Session structured: { date, title, groups: N, questions: N, warnings: N }
[Parser] After validation, groups: [N]
```

#### Errors:
```
[Parser] ❌ Timeout error - request took too long (>15s)
[Parser] ❌ Final error for date [date]: [error message]
[Parser] Error stack: [stack trace]
```

**To view:** Open DevTools → Console tab → Look for logs starting with `[Parser]` or `[parseSingleDay]`

---

## How to Debug

### Step 1: Clear Cache & Reload
```
1. Open DevTools (F12)
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Clear Console (circle X button)
```

### Step 2: Reproduce the Issue
1. Type training description (Italian): `"Lunedì pista 4x50m 5-6 secondi rec 3 minuti"`
2. Click "Interpreta con AI"
3. **Watch the Console for logs**

### Step 3: Check the Logs in Order
Look for this sequence:
```
[AITrainingInput] Starting parse with text: "Lunedì pista..."  ✓
    ↓
[Parser] About to fetch from: https://training-log-ai-proxy...  ✓
    ↓
[Parser] Sending fetch request...  ✓
    ↓
[Parser] Fetch response received, status: 200  ✓
    ↓
[Parser] Response data received, keys: [choices]  ✓
    ↓
[Parser] Extracted content from choices[0].message.content  ✓
    ↓
[Parser] JSON parsing successful  ✓
    ↓
[AITrainingInput] Parse result: {...}  ✓
```

### Step 4: Identify Where It Stops
- **If logs stop after "Starting parse"** → Frontend issue
- **If logs stop after "Sending fetch request"** → Network issue
- **If "Fetch response received" shows status 500** → Worker error
- **If "Response data" shows error field** → Gemini API error
- **If "JSON parsing failed"** → Response format issue

---

## Common Issues & Fixes

### Issue 1: Network Error / CORS
**Symptom:** No `[Parser] Fetch response` log appears
**Check:** Network tab → Find Worker request → See if it fails

**Fix:** 
- Verify Worker URL is correct: `https://training-log-ai-proxy.giovanni-jecha.workers.dev`
- Check CORS headers in Worker response

---

### Issue 2: Worker Returns 500 Error
**Symptom:** `[Parser] Fetch response received, status: 500`
**Check:** Look for `[Worker]` logs in browser console

**Fix:**
- Verify Gemini API key is set in `wrangler.toml`
- Check Worker logs: `wrangler tail -f`

---

### Issue 3: JSON Parsing Fails
**Symptom:** `[Parser] Direct JSON parsing failed` + fallback message
**Check:** Log shows first 100 chars of response, identify the format issue

**Fix:**
- Check if response has markdown code blocks
- Verify JSON structure matches schema

---

### Issue 4: Timeout Error
**Symptom:** `[Parser] ❌ Timeout error - request took too long (>15s)`
**Check:** Network tab to see actual request time

**Fix:**
- Increase timeout in `aiParser.js` line ~507 (currently 15000ms)
- Or optimize Worker response time

---

## Deployment Status

✅ **Frontend deployed** → Cloudflare Pages  
✅ **Worker deployed** → training-log-ai-proxy.giovanni-jecha.workers.dev  
✅ **All logging added** → Ready for debugging  

---

## Next Steps

1. **Test the flow** with Italian input
2. **Watch the console logs** - they will reveal exact failure point
3. **Share the console output** showing which log line appears last
4. **Fix** based on where the logs stop

### Quick Test Commands
```javascript
// In browser console, manually test the Worker:
fetch('https://training-log-ai-proxy.giovanni-jecha.workers.dev', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{role: 'user', content: 'Test message'}],
    model: 'gemini-2.5-flash'
  })
}).then(r => r.json()).then(d => console.log(d))
```

---

## Log Format Reference
All logs follow this pattern:
- `[Module] Clear message` ✓
- `[Module] ❌ Error` ✗
- Logs are timestamped automatically by browser

---

## File Changes Summary
- ✅ `src/services/aiParser.js` - Added 15+ logging points
- ✅ `src/components/AITrainingInput.jsx` - Added parse flow logs
- ✅ `worker.js` - Added request/response logs
- ✅ Frontend rebuilt and deployed
