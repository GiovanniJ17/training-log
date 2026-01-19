/**
 * Test script to validate extraction patterns
 * Run with: node scripts/test-extraction.js
 */

// Simula le funzioni di estrazione dal aiParser
function extractPersonalBests(text) {
  const pbs = [];
  
  // Pattern per PB gara ESPLICITO: "100m 10.5sec PB", "200m in 20.3sec PB"
  const racePattern = /(\d+)\s*m(?:etri?)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?\s+(?:PB|personal\s+best|nuovo\s+record|miglior\s+tempo)/gi;
  let match;
  
  while ((match = racePattern.exec(text)) !== null) {
    pbs.push({
      type: 'race',
      distance_m: parseInt(match[1]),
      time_s: parseFloat(match[2].replace(',', '.')),
      is_personal_best: true
    });
  }
  
  // Pattern per PB IMPLICITO: in contesto "gara" o "pista", distanza+tempo senza keyword
  // Esempi: "gara 60m 7.18", "pista 100m 10.5"
  if (text.match(/\bgara\b|\bpista\b|\bcompetizione\b|\bgare\b/i)) {
    const implicitRacePattern = /(?:gara|pista|competizione)\s*:?\s*(\d+)\s*m(?:etri?)?\s+(?:in\s+)?(\d+[.,]\d+|\d+)\s*(?:sec|s)?(?!\s+(?:x|serie|set|\d+x))/gi;
    
    while ((match = implicitRacePattern.exec(text)) !== null) {
      const distance = parseInt(match[1]);
      const time = parseFloat(match[2].replace(',', '.'));
      
      // Evita duplicati
      const isDuplicate = pbs.some(pb => 
        pb.type === 'race' && pb.distance_m === distance && Math.abs(pb.time_s - time) < 0.1
      );
      
      if (!isDuplicate) {
        pbs.push({
          type: 'race',
          distance_m: distance,
          time_s: time,
          is_personal_best: true,
          implicit: true
        });
      }
    }
  }
  
  // Pattern per massimali ESPLICITI: "Squat 100kg PB", "Deadlift 150kg nuovo massimale"
  const strengthPattern = /(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?)\s+(\d+[.,]\d+|\d+)\s*kg\s+(?:PB|personal\s+best|massimale|nuovo\s+massimale)/gi;
  
  while ((match = strengthPattern.exec(text)) !== null) {
    const exerciseName = match[1];
    const categoryMap = {
      'squat': 'squat',
      'bench': 'bench',
      'panca': 'bench',
      'deadlift': 'deadlift',
      'stacco': 'deadlift',
      'clean': 'clean',
      'jerk': 'jerk',
      'press': 'press',
      'military press': 'press',
      'military': 'press',
      'trazioni': 'pull',
      'trazione': 'pull'
    };
    
    const category = categoryMap[exerciseName.toLowerCase()] || 'other';
    
    pbs.push({
      type: 'strength',
      exercise_name: exerciseName,
      category: category,
      weight_kg: parseFloat(match[2].replace(',', '.')),
      reps: 1,
      is_personal_best: true
    });
  }
  
  // Pattern per massimali IMPLICITI: in contesto palestra, un esercizio + peso alto può essere un massimale
  if (text.match(/\bpalestra\b|\bpeso massimale\b|\bmassimali\b/i)) {
    const implicitStrengthPattern = /(?:palestra|forza)\s*:?\s*(squat|bench|deadlift|stacco|clean|jerk|press|military\s+press|panca|trazioni?)\s+(\d+[.,]\d+|\d+)\s*kg(?!\s+(?:x|reps|set))/gi;
    
    while ((match = implicitStrengthPattern.exec(text)) !== null) {
      const exerciseName = match[1];
      const weight = parseFloat(match[2].replace(',', '.'));
      
      const categoryMap = {
        'squat': 'squat',
        'bench': 'bench',
        'panca': 'bench',
        'deadlift': 'deadlift',
        'stacco': 'deadlift',
        'clean': 'clean',
        'jerk': 'jerk',
        'press': 'press',
        'military press': 'press',
        'military': 'press',
        'trazioni': 'pull',
        'trazione': 'pull'
      };
      
      const category = categoryMap[exerciseName.toLowerCase()] || 'other';
      
      // Evita duplicati
      const isDuplicate = pbs.some(pb => 
        pb.type === 'strength' && pb.category === category && Math.abs(pb.weight_kg - weight) < 0.5
      );
      
      if (!isDuplicate) {
        pbs.push({
          type: 'strength',
          exercise_name: exerciseName,
          category: category,
          weight_kg: weight,
          reps: 1,
          is_personal_best: true,
          implicit: true
        });
      }
    }
  }
  
  return pbs;
}

function extractInjuries(text) {
  const injuries = [];
  
  // Pattern per infortuni: "infortunio spalla", "dolore dietro al ginocchio", "strappo muscolare schiena"
  // Supporta anche modificatori di posizione come "dietro", "davanti", "interno", "esterno"
  const injuryPattern = /(infortunio|dolore|lesione|strappo muscolare|contusione|distorsione|tendinite|infiammazione)\s+(?:(?:dietro\s+)?(?:alla\s+|al\s+|di\s+))?([a-z\s]+?)(?:\.|,|;|$|\s+(?:grave|moderato|lieve))/gi;
  let match;
  
  const bodyParts = {
    spalla: 'spalla',
    'spallasinstra': 'spalla sinistra',
    'spalla sinistra': 'spalla sinistra',
    'spalla destra': 'spalla destra',
    gomito: 'gomito',
    polso: 'polso',
    schiena: 'schiena',
    'bassa schiena': 'bassa schiena',
    'alta schiena': 'alta schiena',
    fianco: 'fianco',
    anca: 'anca',
    coscia: 'coscia',
    ginocchio: 'ginocchio',
    'ginocchio sinistro': 'ginocchio sinistro',
    'ginocchio destro': 'ginocchio destro',
    'dietro al ginocchio': 'ginocchio',
    'dietro ginocchio': 'ginocchio',
    caviglia: 'caviglia',
    piede: 'piede',
    gamba: 'gamba',
    petto: 'petto',
    addominale: 'addominale'
  };
  
  while ((match = injuryPattern.exec(text)) !== null) {
    const injuryType = match[1];
    let bodyPartText = match[2]?.trim().toLowerCase() || 'altro';
    
    // Pulisci i prefissi di posizione
    bodyPartText = bodyPartText.replace(/^dietro\s+|^davanti\s+|^interno\s+|^esterno\s+/i, '').trim();
    
    const bodyPart = bodyParts[bodyPartText] || bodyPartText;
    
    // Determina gravità dal contesto
    let severity = 'moderate';
    const context = text.substring(Math.max(0, match.index - 50), match.index + 150);
    if (context.match(/lieve|leggero|minore|piccolo/i)) severity = 'minor';
    if (context.match(/grave|serio|importante|maggiore/i)) severity = 'severe';
    
    injuries.push({
      type: 'injury',
      injury_type: injuryType,
      body_part: bodyPart,
      severity: severity
    });
  }
  
  return injuries;
}

// Test cases
const testCases = [
  {
    name: "PB gara singolo",
    text: "Pista: 100m 10.5sec PB",
    expectedPBs: 1,
    expectedInjuries: 0
  },
  {
    name: "PB gara con variazione",
    text: "Sessione pista: 200m in 20.3 sec nuovo record",
    expectedPBs: 1,
    expectedInjuries: 0
  },
  {
    name: "PB gara IMPLICITO (senza keyword)",
    text: "gara 60m 7.18",
    expectedPBs: 1,
    expectedInjuries: 0
  },
  {
    name: "Massimali multipli",
    text: "Palestra: Squat 100kg PB, Bench 75kg massimale, Deadlift 120kg nuovo massimale",
    expectedPBs: 3,
    expectedInjuries: 0
  },
  {
    name: "Infortunio singolo",
    text: "Sessione ma dolore spalla lieve",
    expectedPBs: 0,
    expectedInjuries: 1
  },
  {
    name: "Infortunio grave",
    text: "Infortunio caviglia grave durante riscaldamento",
    expectedPBs: 0,
    expectedInjuries: 1
  },
  {
    name: "Infortunio con modificatore (dietro)",
    text: "dolore dietro al ginocchio",
    expectedPBs: 0,
    expectedInjuries: 1
  },
  {
    name: "Combo completo",
    text: "Pista: 100m 10.4sec nuovo record. Infortunio caviglia minore durante riscaldamento. Squat 110kg massimale in palestra",
    expectedPBs: 2,
    expectedInjuries: 1
  },
  {
    name: "PB con formati variati",
    text: "400m 50,3 sec PB e 800m 105.6s PB",
    expectedPBs: 2,
    expectedInjuries: 0
  },
  {
    name: "Gara senza keyword PB",
    text: "18/01/2026\ngara 60m 7.18 PB\ndolore dietro al ginocchio",
    expectedPBs: 1,
    expectedInjuries: 1
  }
];

// Esegui test
console.log("🧪 Test di Estrazione Dati\n");
console.log("=".repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const pbs = extractPersonalBests(test.text);
  const injuries = extractInjuries(test.text);
  
  const pbMatch = pbs.length === test.expectedPBs;
  const injMatch = injuries.length === test.expectedInjuries;
  const success = pbMatch && injMatch;
  
  if (success) {
    console.log(`✅ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    failed++;
  }
  
  console.log(`   Input: "${test.text}"`);
  console.log(`   Atteso: ${test.expectedPBs} PB, ${test.expectedInjuries} infortuni`);
  console.log(`   Trovato: ${pbs.length} PB, ${injuries.length} infortuni`);
  
  if (pbs.length > 0) {
    console.log(`   PBs:`);
    pbs.forEach(pb => {
      if (pb.type === 'race') {
        console.log(`     - Race: ${pb.distance_m}m in ${pb.time_s}s`);
      } else {
        console.log(`     - Strength: ${pb.exercise_name} ${pb.weight_kg}kg`);
      }
    });
  }
  
  if (injuries.length > 0) {
    console.log(`   Injuries:`);
    injuries.forEach(inj => {
      console.log(`     - ${inj.injury_type} al/alla ${inj.body_part} (${inj.severity})`);
    });
  }
  
  console.log();
});

console.log("=".repeat(80));
console.log(`\n📊 Risultati: ${passed} passati, ${failed} falliti`);
console.log(`Success rate: ${Math.round((passed / testCases.length) * 100)}%`);
