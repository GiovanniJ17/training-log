# Cloudflare Pages Deployment Guide

## Prerequisites

- GitHub account with the `training-log` repository
- Cloudflare account (https://dash.cloudflare.com)
- Your credentials ready:
  - Supabase URL and Anon Key
  - Cloudflare Account ID and API Token

## Deployment Steps

### 1. Connect GitHub Repository to Cloudflare Pages

1. Go to **Cloudflare Dashboard** → **Pages**
2. Click **"Connect to Git"**
3. Select **GitHub** and authorize Cloudflare
4. Search for and select **`training-log`** repository
5. Click **Begin Setup**

### 2. Configure Build Settings

Fill in the deployment settings:

| Field | Value |
|-------|-------|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (leave empty) |

### 3. Set Environment Variables

Click **"Save and Deploy"** first, then go to **Project Settings** → **Environment Variables** and add:

#### Production Environment Variables

| Variable | Value | Example |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://nusfjbqxu...supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | `sb_publishable_...` |
| `VITE_AI_PROVIDER` | `cloudflare` (or openai/anthropic) | `cloudflare` |
| `VITE_CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID | `9071c4f96e81...` |
| `VITE_CLOUDFLARE_API_TOKEN` | Your Cloudflare API Token | `dUiDk-gOl7Nv...` |

**Getting your Cloudflare Account ID & API Token:**
1. Go to **Cloudflare Dashboard** → **Account Home**
2. Copy **Account ID** from the right sidebar
3. Go to **API Tokens** (https://dash.cloudflare.com/profile/api-tokens)
4. Click **"Create Token"** → Use **"Edit Cloudflare Workers"** template
5. Customize to allow Workers AI access and copy the token

### 4. Complete Initial Deployment

After setting environment variables, Cloudflare will automatically:
- ✓ Build your React app (`npm run build`)
- ✓ Generate optimized production bundle in `dist/`
- ✓ Deploy to Cloudflare's global edge network
- ✓ Provide a preview URL and production domain

### 5. Custom Domain (Optional)

In **Project Settings** → **Domains**, add your custom domain:
- Get a domain from Namecheap, GoDaddy, etc.
- Add nameservers pointing to Cloudflare
- Create a CNAME record: `training-log.yourdomain.com` → Cloudflare Pages URL

## First Access

Once deployed, your app will be available at:
- **Preview**: `https://[branch-name].[project-name].pages.dev`
- **Production**: `https://[project-name].pages.dev`

Example: `https://training-log.pages.dev`

## Accessing the AI Parser

The app will:
1. ✅ Parse your natural language workout descriptions
2. ✅ Use Cloudflare Workers AI (free tier) for inference
3. ✅ Store data in your Supabase database
4. ✅ Display statistics on the Dashboard tab

## Automatic Deployments

Every time you push to the `main` branch:
- Cloudflare automatically triggers a new build
- Your app updates within 2-3 minutes
- No manual deployment needed!

## Troubleshooting

### Build fails with "missing dependencies"
- Ensure `package.json` is in the root directory
- Check that Node.js version is compatible (Cloudflare Pages uses Node 18+)

### Environment variables not loading
- Verify variables are set in **Project Settings** → **Environment Variables**
- Restart deployment after adding new variables
- Environment variables must have the `VITE_` prefix to be accessible in frontend

### AI parser returning empty responses
- Check that `VITE_CLOUDFLARE_ACCOUNT_ID` and `VITE_CLOUDFLARE_API_TOKEN` are correctly set
- Verify your Cloudflare account has Workers AI access
- Test locally first with `npm run proxy` and `npm run dev`

### Database connection errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase RLS policies allow anonymous access
- Test connection with `npm run check-env`

## Rollback

If a deployment has issues:
1. Go to **Deployments** tab
2. Find the previous working deployment
3. Click **"Rollback"** to restore previous version

## View Deployment Logs

Click on any deployment in the **Deployments** tab to see:
- Build logs
- Runtime errors
- Deployment status

## Local Development vs Production

| Aspect | Local | Production |
|--------|-------|-----------|
| Port | `localhost:3000` | `https://training-log.pages.dev` |
| AI Provider | Express proxy on `:5000` | Cloudflare Workers AI |
| Database | Supabase (same) | Supabase (same) |
| Build | `npm run dev` | Automatic on push |
| Logs | Terminal output | Cloudflare Dashboard |

## Performance Tips

- ✅ Already optimized: 121KB gzipped JS bundle
- ✅ React 19 with Vite = fast initial load
- ✅ Cloudflare edge caching = global CDN
- ✅ Workers AI = low latency ML inference

## Support

For Cloudflare Pages issues: https://support.cloudflare.com/
For Supabase issues: https://supabase.com/support
For this project: Check GitHub Issues
