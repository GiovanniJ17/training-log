import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function seedAthleteProfile() {
  console.log('🏃 Controllo profilo atleta...\n');
  
  // Verifica se esiste già un profilo
  const { data: existing, error: checkError } = await supabase
    .from('athlete_profile')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (checkError) {
    console.error('❌ Errore nel controllo profilo:', checkError.message);
    process.exit(1);
  }

  if (existing) {
    console.log('✅ Profilo atleta già presente:');
    console.log(`   Nome: ${existing.name}`);
    console.log(`   Data di nascita: ${existing.birth_date}`);
    console.log(`   Peso: ${existing.current_weight_kg} kg`);
    console.log(`   Altezza: ${existing.height_cm} cm`);
    console.log(`   Specializzazione: ${existing.sport_specialization || 'N/A'}`);
    return;
  }

  // Inserisci profilo di default
  console.log('📝 Creazione profilo atleta di default...\n');
  
  const { data: newProfile, error: insertError } = await supabase
    .from('athlete_profile')
    .insert([{
      name: 'Atleta',
      birth_date: '2000-01-01',
      current_weight_kg: 70.0,
      height_cm: 175,
      sport_specialization: 'Atletica Leggera'
    }])
    .select()
    .single();

  if (insertError) {
    console.error('❌ Errore nella creazione profilo:', insertError.message);
    process.exit(1);
  }

  console.log('✅ Profilo atleta creato con successo!');
  console.log(`   ID: ${newProfile.id}`);
  console.log(`   Nome: ${newProfile.name}`);
  console.log('\n💡 Puoi modificare il profilo dalla sezione "Profilo" dell\'app\n');
}

seedAthleteProfile();
