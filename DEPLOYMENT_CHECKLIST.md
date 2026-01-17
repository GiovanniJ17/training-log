# 🚀 Training Log - Cloudflare Pages Deployment Steps

## Step 1: Navigate to Cloudflare Pages

1. Go to https://dash.cloudflare.com/
2. Click **"Pages"** in the sidebar (under "Workers & Pages")
3. Click **"Create application"** button
4. Choose **"Connect to Git"**

## Step 2: Authorize GitHub and Select Repository

1. Click **"GitHub"** and authorize Cloudflare to access your GitHub account
2. Search for **"training-log"** repository
3. Select **GiovanniJ17/training-log**
4. Click **"Begin Setup"**

## Step 3: Configure Build Settings

You'll see the deployment configuration form. Fill in:

```
Project name: training-log
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: (leave empty)
```

Click **"Save and Deploy"**

## Step 4: Add Environment Variables

After the first build completes, go to:
**Settings** → **Environment Variables** → **Production**

Add these variables:

### Required for Supabase
```
Name: VITE_SUPABASE_URL
Value: <YOUR_SUPABASE_URL>

Name: VITE_SUPABASE_ANON_KEY
Value: <YOUR_SUPABASE_ANON_KEY>
```

### Required for Cloudflare Workers AI
```
Name: VITE_AI_PROVIDER
Value: cloudflare

Name: VITE_CLOUDFLARE_ACCOUNT_ID
Value: <YOUR_CLOUDFLARE_ACCOUNT_ID>

Name: VITE_CLOUDFLARE_API_TOKEN
Value: <YOUR_CLOUDFLARE_API_TOKEN>  
Note: Non committare mai token reali nel repository. Genera il token in Cloudflare (scope minimo necessario) e inseriscilo solo come environment variable su Pages/Workers.
```

Click **"Save"** after each variable.

## Step 5: Trigger New Deployment

Once environment variables are saved:
1. Go to the **"Deployments"** tab
2. Click the three dots (...) on the latest deployment
3. Select **"Retry deployment"**

Wait for the deployment to complete (2-3 minutes).

## Step 6: Access Your App

Once deployment is successful:
- Your app will be live at: **https://training-log.pages.dev**
- You should see the Training Log interface
- Click "Nuovo Allenamento" to test the AI parser

## Step 7: Enable Automatic Deployments

By default, Cloudflare will automatically redeploy whenever you:
1. Push to the `main` branch on GitHub
2. Changes are detected and built automatically
3. Live within 2-3 minutes

## Verification

Test your deployment:

1. **Open the app**: https://training-log.pages.dev
2. **Test AI Parser**:
   - Click "Nuovo Allenamento"
   - Paste this test text:
   ```
   Sessione in pista. ho fatto 4x100m con tempi 16.50, 16.40, 16.30, 16.20. Recovery 3 minuti tra le serie. Intensità 8.
   ```
   - Click "Interpreta con AI"
   - Should see parsed data with RPE=8, exercises parsed correctly
3. **Test Database**:
   - Click "Salva nel Database"
   - Should save successfully
   - Go to Dashboard to verify data appears

## Troubleshooting

### Deployment Fails During Build
- Check build logs in the **Deployments** tab
- Ensure `npm run build` works locally first
- Verify all files were pushed to GitHub

### App Shows Blank Page
- Open browser DevTools (F12) → Console
- Look for error messages
- Most common: Missing environment variables
- Solution: Verify all 5 variables are set in Pages Settings

### "Failed to fetch from AI" Error
- Verify `VITE_CLOUDFLARE_ACCOUNT_ID` and `VITE_CLOUDFLARE_API_TOKEN` are correct
- Test with `npm run proxy` and `npm run dev` locally first
- Check Cloudflare account has Workers AI enabled

### Database Connection Error
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exactly correct
- Check Supabase RLS policies: should allow anonymous select/insert
- Verify Supabase database is active

## What's Running Where

```
┌─────────────────────────────────────────┐
│     Training Log App (React)            │
│  https://training-log.pages.dev         │
│                                         │
│  - Input component (Nuovo Allenamento)  │
│  - Dashboard (Statistics)               │
│  - Real-time updates                    │
└────────────┬────────────────────────────┘
             │
    ┌────────┴─────────┬──────────────┐
    │                  │              │
    ▼                  ▼              ▼
┌────────────┐  ┌───────────┐  ┌──────────┐
│ Supabase   │  │ Cloudflare│  │ Mistral  │
│ Database   │  │ Workers   │  │  7B AI   │
│            │  │ API       │  │          │
└────────────┘  └───────────┘  └──────────┘
   (Storage)      (Proxy)      (Parser)
```

## Next Steps After Deployment

1. ✅ Add more training entries to build your dataset
2. ✅ Refine the AI prompt if needed (edit `src/services/aiParser.js`)
3. ✅ Customize the dashboard statistics
4. ✅ Add notifications or email alerts (advanced)
5. ✅ Share the domain with coaches/team

## Support

- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Supabase: https://supabase.com/docs
- GitHub Issues: https://github.com/GiovanniJ17/training-log/issues
