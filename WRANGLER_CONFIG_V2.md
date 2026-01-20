# Wrangler.toml Configuration Example for V2.0

# IMPORTANT: Add this section to your existing wrangler.toml

## KV Namespace for Rate Limiting

# 1. Create KV namespace (run in terminal):
#    wrangler kv:namespace create "RATE_LIMIT_KV"
#
# 2. Copy the ID from the output and paste below

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_KV_NAMESPACE_ID_HERE"  # Replace with actual ID from step 1

# Example output from wrangler kv:namespace create:
# ⛅️ wrangler 3.x.x
# -------------------------------------------------------
# 🌀  Creating namespace with title "worker-RATE_LIMIT_KV"
# ✨  Success!
# Add the following to your configuration file:
# [[kv_namespaces]]
# binding = "RATE_LIMIT_KV"
# id = "abc123def456ghi789"  # <-- USE THIS ID

## Environment Variables (Secrets)

# DO NOT add API keys directly in wrangler.toml!
# Use wrangler secrets instead:

# Set Gemini API Key:
# wrangler secret put GEMINI_API_KEY
# (Paste your key when prompted)

# Verify secrets:
# wrangler secret list

## Example Complete wrangler.toml

```toml
name = "training-log-ai-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"

# KV Namespace for rate limiting
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_KV_ID_HERE"  # ⚠️ CHANGE THIS

# Optional: Environment-specific configs
[env.production]
name = "training-log-ai-proxy-prod"
route = "https://your-domain.com/api/*"

[env.development]
name = "training-log-ai-proxy-dev"
```

## Deployment Commands

# Development
wrangler dev  # Test locally

# Production
wrangler deploy  # Deploy to Cloudflare

# Check logs
wrangler tail  # Real-time logs

# Manage secrets
wrangler secret put GEMINI_API_KEY
wrangler secret list
wrangler secret delete GEMINI_API_KEY

## Testing Rate Limiting

# After deployment, test with:
curl -X POST https://your-worker.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"provider":"gemini","messages":[{"role":"user","content":"test"}]}'

# Repeat 105 times to trigger rate limit (should get 429 on request 101+)

## CORS Testing

# Valid origin (should work)
curl -X POST https://your-worker.workers.dev \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"provider":"gemini","messages":[]}'

# Invalid origin (should fail with CORS error when accessed from browser)
curl -X POST https://your-worker.workers.dev \
  -H "Origin: https://evil-site.com" \
  -H "Content-Type: application/json" \
  -d '{"provider":"gemini","messages":[]}'

## Troubleshooting

# Error: "RATE_LIMIT_KV is not defined"
# Solution: Make sure you created KV namespace and added it to wrangler.toml

# Error: "GEMINI_API_KEY is not defined"  
# Solution: Run `wrangler secret put GEMINI_API_KEY`

# Error: "429 Too Many Requests on first request"
# Solution: Clear KV namespace: wrangler kv:key delete "ratelimit:YOUR_IP" --namespace-id=YOUR_KV_ID

## Cost Estimation (Cloudflare Free Tier)

# Workers: 100,000 requests/day (FREE)
# KV: 100,000 reads/day, 1,000 writes/day (FREE)
# Rate limiting uses ~2 KV operations per request (1 read + 1 write)
# 
# Max sustainable traffic: ~50,000 API calls/day on free tier
# Above that, upgrade to Workers Paid ($5/month for 10M requests)

## Security Checklist

- [ ] KV namespace created and bound
- [ ] GEMINI_API_KEY set as secret (not in code)
- [ ] CORS origins updated in worker.js (remove wildcard)
- [ ] Rate limiting tested (429 after 100 requests)
- [ ] Worker deployed to production URL
- [ ] VITE_WORKER_URL updated in frontend .env

## Monitoring

# Check worker analytics:
# https://dash.cloudflare.com/YOUR_ACCOUNT_ID/workers/analytics

# Key metrics to monitor:
# - Requests/day (should be < 100k on free tier)
# - Error rate (should be < 1%)
# - P95 latency (should be < 500ms)
# - 429 responses (should be low unless under attack)
