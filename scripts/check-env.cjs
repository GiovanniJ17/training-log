#!/usr/bin/env node

/**
 * Script per verificare che tutte le variabili d'ambiente siano configurate
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Verifica Environment Variables\n')

// Carica .env
const envPath = path.join(process.cwd(), '.env')

if (!fs.existsSync(envPath)) {
  console.error('❌ File .env non trovato!')
  console.log('💡 Esegui: npm run setup\n')
  process.exit(1)
}

// Leggi .env
const envContent = fs.readFileSync(envPath, 'utf-8')
const envLines = envContent.split('\n')

const envVars = {}
envLines.forEach((line) => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=')
    const value = valueParts.join('=')
    if (key) {
      envVars[key.trim()] = value.trim()
    }
  }
})

// Variabili richieste
const required = [
  'VITE_GEMINI_API_KEY',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_DATABASE_ID'
]

let allConfigured = true

console.log('Variabili richieste:\n')

required.forEach((key) => {
  const value = envVars[key]
  const isConfigured = value && !value.includes('your_')

  if (isConfigured) {
    console.log(`✅ ${key}: Configurato`)
  } else {
    console.log(`❌ ${key}: NON configurato`)
    allConfigured = false
  }
})

console.log('')

if (allConfigured) {
  console.log('🎉 Tutte le variabili sono configurate correttamente!')
  console.log('🚀 Puoi avviare il progetto con: npm run dev\n')
  process.exit(0)
} else {
  console.log('⚠️  Alcune variabili mancano!')
  console.log('📝 Modifica il file .env con i tuoi valori')
  console.log('📚 Vedi SETUP.md per istruzioni dettagliate\n')
  process.exit(1)
}
