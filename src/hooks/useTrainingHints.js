/**
 * Hook personalizzato per suggerimenti in tempo reale
 * durante la digitazione dell'allenamento
 */
import { useState, useEffect } from 'react';

export function useTrainingHints(text) {
  const [hints, setHints] = useState([]);

  useEffect(() => {
    const newHints = [];

    // Rileva menzioni di distanze
    if (/\d+\s*(km|m|metri|metri)/i.test(text)) {
      newHints.push({
        type: 'distance',
        icon: '📏',
        message: 'Distanza rilevata'
      });
    }

    // Rileva menzioni di pesi
    if (/\d+\s*(kg|chili)/i.test(text)) {
      newHints.push({
        type: 'weight',
        icon: '🏋️',
        message: 'Peso rilevato'
      });
    }

    // Rileva menzioni di serie e ripetizioni
    if (/\d+\s*x\s*\d+/i.test(text)) {
      newHints.push({
        type: 'sets',
        icon: '🔄',
        message: 'Serie e ripetizioni rilevate'
      });
    }

    // Rileva menzioni di RPE
    if (/(rpe|intensità)\s*\d+/i.test(text)) {
      newHints.push({
        type: 'rpe',
        icon: '💪',
        message: 'RPE rilevato'
      });
    }

    // Rileva menzioni di tempi
    if (/\d+\s*(sec|secondi|min|minuti)/i.test(text)) {
      newHints.push({
        type: 'time',
        icon: '⏱️',
        message: 'Tempo rilevato'
      });
    }

    // Suggerisci tipi di sessione
    const sessionTypes = {
      pista: ['pista', 'track', 'sprint', '200m', '400m'],
      palestra: ['palestra', 'gym', 'squat', 'panca', 'stacco'],
      strada: ['strada', 'road', 'corsa lunga', 'fondo'],
      gara: ['gara', 'race', 'competizione'],
    };

    for (const [type, keywords] of Object.entries(sessionTypes)) {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        newHints.push({
          type: 'session-type',
          icon: '🎯',
          message: `Tipo sessione: ${type}`
        });
        break;
      }
    }

    setHints(newHints);
  }, [text]);

  return hints;
}

/**
 * Estrae metriche rapide dal testo per preview
 */
export function extractQuickMetrics(text) {
  const metrics = {
    exercises: 0,
    distance: 0,
    sets: 0,
  };

  // Conta esercizi (approssimativo)
  const exercisePatterns = [
    /\d+\s*x\s*\d+/g, // serie x reps
    /\d+\s*(km|m)\b/g, // distanze
    /\w+\s*\d+\s*kg/g, // pesi
  ];

  exercisePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) metrics.exercises += matches.length;
  });

  // Somma distanze totali
  const distanceMatches = text.match(/(\d+(?:\.\d+)?)\s*(km|m)/gi);
  if (distanceMatches) {
    distanceMatches.forEach(match => {
      const [, num, unit] = match.match(/(\d+(?:\.\d+)?)\s*(km|m)/i);
      const meters = unit.toLowerCase() === 'km' ? parseFloat(num) * 1000 : parseFloat(num);
      metrics.distance += meters;
    });
  }

  // Conta serie totali
  const setsMatches = text.match(/(\d+)\s*x\s*\d+/g);
  if (setsMatches) {
    setsMatches.forEach(match => {
      const [, sets] = match.match(/(\d+)\s*x\s*\d+/);
      metrics.sets += parseInt(sets);
    });
  }

  return metrics;
}
