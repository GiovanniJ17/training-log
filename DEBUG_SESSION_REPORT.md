# 🔍 Debug Session - Worker 500 Error Analysis

## Issue Found
**Worker returns 500 Internal Server Error** when processing AI requests.

## Root Cause
The Worker's `callGemini` function is failing silently with a 500 error. The exact reason is unknown but could be:
1. Gemini API key not properly configured in Worker env
2. Invalid request format sent to Gemini API
3. Gemini API returning an error we're not handling
4. Timeout or network issue with Gemini API

## Fixes Applied

### 1. **Parser Timeout Fix** (`aiParser.js`)
Fixed `timeoutId is not defined` error by calling `clearTimeout(timeoutId)` immediately when response is not OK, before throwing the error.

```javascript
if (!response.ok) {
  clearTimeout(timeoutId); // Clear timeout immediately on error
  const error = await response.json().catch(() => ({}));
  throw new Error(...);
}
```

### 2. **Enhanced Worker Logging** (`worker.js`)
Added comprehensive logging throughout `callGemini` function:
- Logs when function starts with model and schema info
- Logs prompt length before sending
- Logs request details (URL, body size, schema presence)
- Logs Gemini response status and keys
- Logs extracted text length and preview
- Logs any errors from Gemini API

### 3. **Deployed Changes**
- ✅ Frontend rebuilt and deployed to Cloudflare Pages
- ✅ Worker redeployed with new logging to `training-log-ai-proxy.giovanni-jecha.workers.dev`

---

## How to Debug Now

### Step 1: Hard Refresh
```
Ctrl+Shift+R (or Cmd+Shift+R on Mac)
```

### Step 2: Reproduce the Issue
In the app, try parsing this Italian text:
```
Lunedì: Pista - 4x50m tempi 5.5-6-6.2-6.3 secondi rec 3 minuti
```

### Step 3: Watch the Console Logs
Open DevTools → Console and look for these log sequences:

**Expected sequence when working:**
```
[AITrainingInput] Starting parse with text: "Lunedì: Pista..."
[parseSingleDay] Starting parse for date: 2026-01-12 text length: 100
[Parser] About to fetch from: https://training-log-ai-proxy...
[Parser] Request body size: 9884 bytes
[Parser] Sending fetch request...
[Parser] Fetch response received, status: 200  ← Look for this!
[Parser] Response data received, keys: choices
[Parser] Extracted content from choices[0].message.content, length: XXX
[Parser] JSON parsing successful, parsed keys: session, groups...
[Parser] Session structured: { ... }
[AITrainingInput] Parse result: {...}  ← Success!
```

**Current failing sequence:**
```
[AITrainingInput] Starting parse with text: "Lunedì: Pista..."
[parseSingleDay] Starting parse for date: 2026-01-12 text length: 100
[Parser] About to fetch from: https://training-log-ai-proxy...
[Parser] Request body size: 9884 bytes
[Parser] Sending fetch request...
[Parser] Fetch response received, status: 500  ← Problem here!
[Parser] Worker error response: {error: {...}}
[AITrainingInput] ❌ Parse error: ReferenceError: timeoutId is not defined  ← Old error, should be fixed now
```

---

## Next Steps

1. **Test with new deployment** - Hard refresh and try the parsing again
2. **Look for new log lines** - Worker now logs internally, check Browser Console
3. **If still 500** - Look for these new Worker logs:
   - `[Worker] callGemini started`
   - `[Worker] Full prompt length`
   - `[Worker] Sending request to Gemini`
   - `[Worker] Gemini response status`
   - `[Worker] Gemini response data keys`

4. **Report the exact log output** - Share all console logs starting from "Starting parse" to "error"

---

## Hypothesis: Gemini API Key Issue

The most likely culprit is that the Gemini API key is not correctly set in the Worker environment.

**Check**: 
- Is `GEMINI_API_KEY` environment variable set in `wrangler-ai-proxy.toml`?
- Can you verify it's a valid Gemini API key?
- Try testing the Worker directly with curl/postman?

---

## Deployment Versions

| Component | Status | URL | Version |
|-----------|--------|-----|---------|
| Frontend | ✅ | https://3b97d95e.training-log-aek.pages.dev | Latest |
| Worker | ✅ | https://training-log-ai-proxy.giovanni-jecha.workers.dev | 030e1b59 |

---

## Files Modified

1. `src/services/aiParser.js` - Fixed timeoutId issue + enhanced logging
2. `worker.js` - Added detailed logging in callGemini function
3. Both files recompiled and deployed

**Ready for testing!** 🚀
