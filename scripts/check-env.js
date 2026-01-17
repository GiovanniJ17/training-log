#!/usr/bin/env node

/**
 * Script per verificare che tutte le variabili d'ambiente siano configurate
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifica Environment Variables\n');

// Carica .env
const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ File .env non trovato!');
  console.log('💡 Esegui: npm run setup\n');
  process.exit(1);
}

// Leggi .env
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

const envVars = {};
envLines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=');
    if (key) {
      envVars[key.trim()] = value.trim();
    }
  }
});

// Variabili richieste
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_AI_API_KEY',
  'VITE_AI_PROVIDER'
];

let allConfigured = true;

console.log('Variabili richieste:\n');

required.forEach(key => {
  const value = envVars[key];
  const isConfigured = value && value !== 'your_supabase_project_url' && 
                       value !== 'your_supabase_anon_key' && 
                       value !== 'your_ai_api_key';
  
  if (isConfigured) {
    console.log(`✅ ${key}: Configurato`);
  } else {
    console.log(`❌ ${key}: NON configurato`);
    allConfigured = false;
  }
});

console.log('');

if (allConfigured) {
  console.log('🎉 Tutte le variabili sono configurate correttamente!');
  console.log('🚀 Puoi avviare il progetto con: npm run dev\n');
  process.exit(0);
} else {
  console.log('⚠️  Alcune variabili mancano!');
  console.log('📝 Modifica il file .env con i tuoi valori');
  console.log('📚 Vedi SETUP.md per istruzioni dettagliate\n');
  process.exit(1);
}
