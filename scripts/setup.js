#!/usr/bin/env node

/**
 * Script di setup iniziale del progetto
 * Verifica che tutto sia configurato correttamente
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Training Log - Setup Wizard\n');

// Controlla se .env esiste
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('⚠️  File .env non trovato!');
  console.log('📝 Copiando .env.example a .env...\n');
  
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ File .env creato con successo!');
    console.log('⚡ PROSSIMO PASSO: Modifica .env con le tue credenziali:\n');
    console.log('   1. VITE_SUPABASE_URL - da supabase.com');
    console.log('   2. VITE_SUPABASE_ANON_KEY - da supabase.com');
    console.log('   3. VITE_AI_API_KEY - da OpenAI o Anthropic');
    console.log('   4. VITE_AI_PROVIDER - "openai" o "anthropic"\n');
  } catch (err) {
    console.error('❌ Errore nella copia del file:', err.message);
    process.exit(1);
  }
} else {
  console.log('✅ File .env già presente\n');
}

// Controlla le dipendenze
console.log('📦 Verificando dipendenze...');
const nodeModulesPath = path.join(process.cwd(), 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('⚠️  Dipendenze non installate!');
  console.log('📝 Esegui: npm install\n');
} else {
  console.log('✅ Dipendenze installate\n');
}

// Verifica struttura directory
console.log('📁 Verificando struttura progetto...');
const requiredDirs = [
  'src',
  'src/components',
  'src/services',
  'src/lib',
  'src/hooks',
  'src/utils'
];

const missingDirs = requiredDirs.filter(dir => 
  !fs.existsSync(path.join(process.cwd(), dir))
);

if (missingDirs.length > 0) {
  console.log('⚠️  Directory mancanti:', missingDirs.join(', '));
} else {
  console.log('✅ Struttura progetto corretta\n');
}

// Mostra prossimi passi
console.log('📋 PROSSIMI PASSI:\n');
console.log('1. Configura .env con le tue credenziali');
console.log('2. Setup database Supabase:');
console.log('   - Crea progetto su supabase.com');
console.log('   - Esegui supabase-schema.sql nel SQL Editor');
console.log('3. Ottieni API key AI (OpenAI o Anthropic)');
console.log('4. Testa localmente: npm run dev');
console.log('5. Deploy su Cloudflare Pages\n');

console.log('📚 Documentazione completa: SETUP.md');
console.log('✅ Setup wizard completato!\n');
