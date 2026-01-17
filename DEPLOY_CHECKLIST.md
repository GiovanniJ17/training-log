## Checklist Pre-Deploy

Prima di fare il deploy in produzione, assicurati di aver completato:

### ✅ Database Setup
- [ ] Creato progetto Supabase
- [ ] Eseguito `supabase-schema.sql` nel SQL Editor
- [ ] (Opzionale) Eseguito `supabase-seed.sql` per dati di test
- [ ] Verificato che le tabelle siano create correttamente
- [ ] Copiato URL e anon key da Settings > API

### ✅ API AI Setup
- [ ] Creato account OpenAI o Anthropic
- [ ] Generato API key
- [ ] Verificato che la chiave funzioni (test locale)
- [ ] Controllato limiti e crediti disponibili

### ✅ Configurazione Locale
- [ ] File `.env` creato e configurato
- [ ] Tutte le variabili d'ambiente impostate
- [ ] `npm install` eseguito con successo
- [ ] `npm run dev` funziona localmente
- [ ] Test inserimento sessione funziona
- [ ] Dashboard mostra dati correttamente

### ✅ GitHub Setup
- [ ] Repository creato su GitHub
- [ ] Codice pushato su `main`
- [ ] `.gitignore` configurato (no `.env` committato!)
- [ ] README.md compilato
- [ ] (Opzionale) GitHub Actions secrets configurati

### ✅ Cloudflare Pages Setup
- [ ] Account Cloudflare creato
- [ ] Repository GitHub collegato
- [ ] Build command: `npm run build`
- [ ] Build output: `dist`
- [ ] Environment variables configurate:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] VITE_AI_API_KEY
  - [ ] VITE_AI_PROVIDER

### ✅ Test Production
- [ ] Build completata con successo
- [ ] Sito accessibile su URL Cloudflare
- [ ] Test inserimento sessione in production
- [ ] Dashboard carica correttamente
- [ ] Verificato dati salvati su Supabase
- [ ] Test su mobile

### ✅ Sicurezza
- [ ] Nessuna API key hardcoded nel codice
- [ ] File `.env` non committato
- [ ] RLS policies attive su Supabase
- [ ] HTTPS attivo su Cloudflare
- [ ] (Futuro) Autenticazione utente implementata

### ✅ Monitoraggio
- [ ] Controllato logs Cloudflare
- [ ] Verificato usage API AI
- [ ] Monitorato database Supabase
- [ ] Configurato budget alerts (se disponibile)

---

## 🚀 Quando Tutto è ✅

```bash
# 1. Commit finale
git add .
git commit -m "Ready for production"
git push origin main

# 2. Cloudflare Pages farà il deploy automaticamente

# 3. Verifica su:
https://training-log.pages.dev

# 4. (Opzionale) Configura dominio custom
```

## 📝 Note Importanti

1. **API Costs**: OpenAI GPT-4 può costare. Monitora l'uso!
2. **Supabase Free Tier**: 500MB storage, 2GB bandwidth/mese
3. **Cloudflare Pages**: 500 build/mese nel piano gratuito
4. **Backup**: Esporta regolarmente i dati da Supabase

## 🆘 Problemi Comuni

- **Build fallisce**: Verifica environment variables su Cloudflare
- **AI non risponde**: Controlla API key e crediti
- **Database errore**: Verifica RLS policies su Supabase
- **Sito bianco**: Apri console browser per errori JS

Buon deploy! 🎉
