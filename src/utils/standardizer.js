/**
 * Exercise Normalization & Standardization
 * Maps Italian/English exercise names to standard format
 * Ensures data consistency for statistics
 */

// Complete exercise mapping (IT → Standard Name)
const EXERCISE_MAPPING = {
  // SPRINT & SPEED
  'sprint': 'Sprint',
  'corsa veloce': 'Sprint',
  'scatto': 'Sprint',
  'volata': 'Sprint',
  '60m': 'Sprint 60m',
  '100m': 'Sprint 100m',
  '150m': 'Sprint 150m',
  '200m': 'Sprint 200m',
  '300m': 'Sprint 300m',
  '400m': 'Sprint 400m',
  
  // ENDURANCE
  'corsa': 'Corsa',
  'corsa lenta': 'Corsa lenta',
  'corsa aerobica': 'Corsa aerobica',
  'fondo': 'Fondo',
  '1km': 'Corsa 1km',
  '2km': 'Corsa 2km',
  '5km': 'Corsa 5km',
  '10km': 'Corsa 10km',
  
  // JUMP & PLYOMETRIC
  'salto': 'Salto',
  'balzi': 'Balzi',
  'skip': 'Skip',
  'pliometria': 'Pliometria',
  'box jump': 'Box jump',
  'salto in lungo': 'Salto in lungo',
  'salto in alto': 'Salto in alto',
  
  // DUMBBELL & WEIGHT TRAINING
  'petto manubri': 'Dumbbell bench press',
  'dumbbell bench press': 'Dumbbell bench press',
  'petto': 'Chest press',
  'chest': 'Chest press',
  'petto con manubri': 'Dumbbell bench press',
  
  // SQUAT VARIATIONS
  'squat': 'Squat',
  'squats': 'Squat',
  'squat veloci': 'Jump squat',
  'back squat': 'Back squat',
  'front squat': 'Front squat',
  'goblet squat': 'Goblet squat',
  'half squat': 'Half squat',
  'mezzo squat': 'Half squat',
  'pistol squat': 'Pistol squat',
  'jump squat': 'Jump squat',
  'squat dinamico': 'Jump squat',
  'squat jumps': 'Jump squat',
  
  // DEADLIFT VARIATIONS
  'stacco': 'Deadlift',
  'deadlift': 'Deadlift',
  'stacco da terra': 'Deadlift',
  'stacchi rumeni': 'Romanian deadlift',
  'rdl': 'Romanian deadlift',
  'stacco sumo': 'Sumo deadlift',
  'trap bar deadlift': 'Trap bar deadlift',
  
  // BENCH PRESS VARIATIONS
  'panca': 'Bench press',
  'bench': 'Bench press',
  'bench press': 'Bench press',
  'panca piana': 'Bench press',
  'panca inclinata': 'Incline bench press',
  'incline bench': 'Incline bench press',
  'panca declinata': 'Decline bench press',
  'decline bench': 'Decline bench press',
  
  // PULL VARIATIONS
  'trazioni': 'Pull-ups',
  'pull-ups': 'Pull-ups',
  'pull ups': 'Pull-ups',
  'trazioni alla sbarra': 'Pull-ups',
  'trazioni zavorrate': 'Weighted pull-ups',
  'weighted pull-ups': 'Weighted pull-ups',
  'chin-ups': 'Chin-ups',
  'lat pulldown': 'Lat pulldown',
  'tirate': 'Lat pulldown',
  'rematore': 'Row',
  'row': 'Row',
  'rematore manubrio': 'Dumbbell row',
  'rematore bilanciere': 'Barbell row',
  
  // CLEAN VARIATIONS
  'strappo': 'Snatch',
  'snatch': 'Snatch',
  'girata': 'Power clean',
  'power clean': 'Power clean',
  'clean': 'Clean',
  'clean & jerk': 'Clean & jerk',
  'clean e strappo': 'Clean & jerk',
  'push press': 'Push press',
  'spinta presa stretta': 'Push press',
  
  // LUNGE VARIATIONS
  'affondo': 'Lunge',
  'lunge': 'Lunge',
  'affondo frontale': 'Front lunge',
  'affondo posteriore': 'Reverse lunge',
  'affondo laterale': 'Lateral lunge',
  'bulgaro': 'Bulgarian squat',
  'affondo bulgaro': 'Bulgarian squat',
  
  // CORE
  'plank': 'Plank',
  'core': 'Core work',
  'addominali': 'Core work',
  'crunch': 'Crunch',
  'sit-up': 'Sit-up',
  'cable crunch': 'Cable crunch',
  'ab wheel': 'Ab wheel',
  'rotazione': 'Core rotation',
  
  // MOBILITY & FLEXIBILITY
  'stretching': 'Stretching',
  'mobilità': 'Mobility',
  'yoga': 'Yoga',
  'foam roll': 'Foam rolling',
  'lacrosse ball': 'Lacrosse ball work',
  
  // DRILLS
  'drill': 'Technical drill',
  'drill tecnica': 'Technical drill',
  'esercitazione tecnica': 'Technical drill',
  'A-skip': 'A-skip',
  'b-skip': 'B-skip',
  'high knee': 'High knee',
  'ginocchia alte': 'High knee',
};

/**
 * Normalizes exercise name to standard format
 * Handles both Italian and English names
 */
export function normalizeExerciseName(name) {
  if (!name) return 'Unknown exercise';
  
  // Convert to lowercase for matching
  const lowerName = name.toLowerCase().trim();
  
  // Direct match in mapping
  if (EXERCISE_MAPPING[lowerName]) {
    return EXERCISE_MAPPING[lowerName];
  }
  
  // Partial matching (for compound names like "3x120m")
  for (const [key, value] of Object.entries(EXERCISE_MAPPING)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }
  
  // If no match, return original with first letter capitalized
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Normalizes time format to decimal seconds
 * Handles: 6"70, 6.70, 6,70, 1:30, etc
 */
export function normalizeTime(timeStr) {
  if (!timeStr) return null;
  
  timeStr = String(timeStr).trim();
  
  // Handle MM:SS format (1:30 = 90 seconds)
  if (timeStr.includes(':')) {
    const [minutes, seconds] = timeStr.split(':').map(Number);
    return minutes * 60 + seconds;
  }
  
  // Handle apostrophe format (6"70 = 6.70 seconds)
  if (timeStr.includes('"')) {
    return parseFloat(timeStr.replace('"', '.'));
  }
  
  // Handle comma as decimal separator (6,70 = 6.70)
  timeStr = timeStr.replace(',', '.');
  
  return parseFloat(timeStr) || null;
}

/**
 * Normalizes recovery/rest duration to seconds
 * Handles: 2', 2min, 2 minutes, 120s, 120 seconds, etc
 */
export function normalizeRecovery(recoveryStr) {
  if (!recoveryStr) return null;
  
  recoveryStr = String(recoveryStr).toLowerCase().trim();
  
  // Extract number from string
  const numberMatch = recoveryStr.match(/(\d+\.?\d*)/);
  if (!numberMatch) return null;
  
  const value = parseFloat(numberMatch[1]);
  
  // Check unit and convert to seconds
  if (recoveryStr.includes('hour') || recoveryStr.includes('h')) {
    return value * 3600;
  }
  if (recoveryStr.includes('min') || recoveryStr.includes("'") || recoveryStr.includes('m')) {
    return value * 60;
  }
  // Default to seconds
  return value;
}

/**
 * Standardizes exercise data for database storage
 * Called after AI parsing to ensure consistency
 */
export function standardizeWorkoutSet(set) {
  return {
    ...set,
    exercise_name: normalizeExerciseName(set.exercise_name),
    time_s: set.time_s ? normalizeTime(set.time_s) : null,
    recovery_s: set.recovery_s ? normalizeRecovery(set.recovery_s) : null,
  };
}

/**
 * Standardizes entire training session
 */
export function standardizeTrainingSession(session) {
  return {
    ...session,
    groups: session.groups.map(group => ({
      ...group,
      sets: group.sets.map(set => standardizeWorkoutSet(set))
    }))
  };
}

export default {
  normalizeExerciseName,
  normalizeTime,
  normalizeRecovery,
  standardizeWorkoutSet,
  standardizeTrainingSession,
  EXERCISE_MAPPING
};
