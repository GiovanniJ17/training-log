# 🚀 Setup & Deployment Guide

Guida completa per configurare localmente e deployare su Firebase Hosting.

## 📋 Prerequisiti

- **Node.js** v18+
- **GitHub** account con repository creato
- **Firebase** project con Firestore e Hosting abilitati

---

## 🔧 Setup Locale

### 1. Installazione & Configurazione

```bash
# Installa dipendenze
npm install

# Crea file .env da esempio
cp .env.example .env

# Modifica .env con i tuoi valori Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_DATABASE_ID=...
VITE_GEMINI_API_KEY=...
```

### 2. Avvia Localmente

```bash
npm run dev
# Apri http://localhost:3000
```

### 3. Test Base

1. Vai a "Nuovo Allenamento"
2. Scrivi: `Pista 4x200m con recupero 3 minuti. RPE 8.`
3. Clicca "Interpreta con AI"
4. Verifica preview e salva nel database

---

## 🌐 Deploy su Firebase Hosting

### Step 1: Prepara Repository GitHub

```bash
git add .
git commit -m "Release"
git push origin main
```

**⚠️ Verifica che .env NON sia committato** (controllare `.gitignore`)

### Step 2: Deploy

```bash
npm run build
firebase deploy --only hosting
```

---

## ✅ Verifica Deploy

1. **Apri l'app**: https://tracker-velocista.web.app
2. **Testa AI Parser**:
   - Nuovo Allenamento → scrivi una sessione → Interpreta con AI
3. **Testa Database**:
   - Salva nel Database → verifica in Firestore
4. **Testa statistiche**:
   - Aggiungi 3+ sessioni e controlla che le metriche siano corrette

---

## 🆘 Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Build fallisce | Verifica variabili d'ambiente e dipendenze |
| Pagina bianca | Apri Console (F12) e cerca errori JavaScript |
| AI non risponde | Verifica che `VITE_GEMINI_API_KEY` sia valido |
| Database non salva | Verifica regole Firestore e configurazione Firebase |
| Variabili non caricate | Hard refresh (Ctrl+Shift+R) |

---

## 📝 Prossimi Passi

- Aggiungi più sessioni di allenamento
- Personalizza il prompt AI in `src/services/aiParser.js` se necessario
- Aggiungi grafici/metriche alla Dashboard
- Condividi il link con team/coaches

---

## 📚 Documentazione

- [Firebase Docs](https://firebase.google.com/docs)
- [Vite Docs](https://vitejs.dev/)
