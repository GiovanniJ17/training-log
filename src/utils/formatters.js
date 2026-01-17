/**
 * Utilità per formattare e visualizzare dati allenamenti
 */

/**
 * Formatta la distanza in modo leggibile
 */
export function formatDistance(meters) {
  if (!meters) return '-';
  
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters} m`;
}

/**
 * Formatta il tempo in modo leggibile
 */
export function formatTime(seconds) {
  if (!seconds) return '-';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
}

/**
 * Formatta il peso
 */
export function formatWeight(kg) {
  if (!kg) return '-';
  return `${kg} kg`;
}

/**
 * Ottieni colore badge per tipo sessione
 */
export function getSessionTypeColor(type) {
  const colors = {
    pista: 'bg-blue-500 text-white',
    palestra: 'bg-purple-500 text-white',
    strada: 'bg-green-500 text-white',
    gara: 'bg-red-500 text-white',
    test: 'bg-yellow-500 text-black',
    scarico: 'bg-cyan-500 text-white',
    recupero: 'bg-teal-500 text-white',
    altro: 'bg-gray-500 text-white',
  };
  return colors[type] || colors.altro;
}

/**
 * Ottieni emoji per categoria esercizio
 */
export function getCategoryEmoji(category) {
  const emojis = {
    sprint: '⚡',
    jump: '🦘',
    lift: '🏋️',
    endurance: '🏃',
    mobility: '🧘',
    drill: '🎯',
    other: '📝',
  };
  return emojis[category] || emojis.other;
}

/**
 * Ottieni colore per RPE
 */
export function getRPEColor(rpe) {
  if (rpe <= 3) return 'text-green-400';
  if (rpe <= 6) return 'text-yellow-400';
  if (rpe <= 8) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Calcola volume totale per esercizio
 */
export function calculateVolume(set) {
  if (set.weight_kg && set.sets && set.reps) {
    return set.weight_kg * set.sets * set.reps;
  }
  return null;
}

/**
 * Suggerimenti di standardizzazione nomi esercizi
 */
export const EXERCISE_STANDARDS = {
  // Pista
  'sprint 100m': ['100m', '100 metri', 'cento metri'],
  'sprint 200m': ['200m', '200 metri', 'duecento metri'],
  'sprint 400m': ['400m', '400 metri', 'quattrocento metri'],
  
  // Palestra gambe
  'squat': ['squat', 'back squat', 'squat bilanciere'],
  'stacco': ['stacco', 'deadlift', 'stacco da terra'],
  'affondi': ['affondi', 'lunge', 'affondo'],
  'leg press': ['leg press', 'pressa gambe'],
  
  // Palestra upper
  'panca piana': ['panca', 'bench press', 'panca piana'],
  'trazioni': ['trazioni', 'pull up', 'pullup'],
  'military press': ['military', 'military press', 'shoulder press'],
  
  // Core
  'plank': ['plank', 'plancia', 'plank frontale'],
  'crunch': ['crunch', 'addominali crunch'],
  
  // Drill
  'skip': ['skip', 'skipping'],
  'calciata': ['calciata', 'calciata dietro'],
};

/**
 * Standardizza nome esercizio
 */
export function standardizeExerciseName(name) {
  const lowerName = name.toLowerCase().trim();
  
  for (const [standard, variants] of Object.entries(EXERCISE_STANDARDS)) {
    if (variants.some(v => lowerName.includes(v))) {
      return standard;
    }
  }
  
  // Se non trova match, capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
