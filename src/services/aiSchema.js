/**
 * JSON Schema per Gemini Structured Output
 * Definisce lo schema rigoroso della risposta AI
 * Elimina il 99% degli errori di parsing JSON
 */

export const TRAINING_SESSION_SCHEMA = {
  type: 'object',
  properties: {
    session: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Data sessione formato YYYY-MM-DD'
        },
        title: {
          type: 'string',
          description: 'Titolo conciso della sessione (4-8 parole)'
        },
        type: {
          type: 'string',
          enum: ['pista', 'palestra', 'strada', 'gara', 'test', 'scarico', 'recupero', 'altro'],
          description: 'Tipo di sessione'
        },
        location: {
          type: ['string', 'null'],
          description: 'Luogo allenamento'
        },
        rpe: {
          type: ['integer', 'null'],
          description: 'RPE 0-10',
          minimum: 0,
          maximum: 10
        },
        feeling: {
          type: ['string', 'null'],
          description: 'Come si è sentito atleta'
        },
        notes: {
          type: ['string', 'null'],
          description: 'Note generali (1-2 frasi)'
        }
      },
      required: ['date', 'title', 'type']
    },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nome del gruppo (es: Riscaldamento, Lavoro Principale, Palestra)'
          },
          order_index: {
            type: 'integer',
            description: 'Ordine del gruppo (0, 1, 2...)'
          },
          notes: {
            type: ['string', 'null'],
            description: 'Note specifiche del gruppo'
          },
          sets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exercise_name: {
                  type: 'string',
                  description: 'Nome esercizio (es: Sprint 100m, Squat)'
                },
                category: {
                  type: 'string',
                  enum: ['sprint', 'jump', 'lift', 'endurance', 'mobility', 'drill', 'other'],
                  description: 'Categoria esercizio'
                },
                sets: {
                  type: 'integer',
                  description: 'Numero di serie',
                  minimum: 1
                },
                reps: {
                  type: 'integer',
                  description: 'Ripetizioni per serie',
                  minimum: 1
                },
                weight_kg: {
                  type: ['number', 'null'],
                  description: 'Peso in kg (solo esercizi forza)'
                },
                distance_m: {
                  type: ['number', 'null'],
                  description: 'Distanza in metri (solo corsa/sprint)'
                },
                time_s: {
                  type: ['number', 'null'],
                  description: 'Tempo in secondi (convertito: 1:30 -> 90, 6.70 -> 6.7)'
                },
                recovery_s: {
                  type: ['integer', 'null'],
                  description: 'Recupero in secondi (convertito: 3min -> 180)'
                },
                notes: {
                  type: ['string', 'null'],
                  description: 'Note specifiche esercizio'
                },
                details: {
                  type: 'object',
                  description: 'Dettagli aggiuntivi (intensity, is_test, etc)',
                  properties: {
                    intensity: {
                      type: ['integer', 'null'],
                      minimum: 0,
                      maximum: 10
                    },
                    is_test: {
                      type: ['boolean', 'null']
                    },
                    is_pb_candidate: {
                      type: ['boolean', 'null']
                    }
                  }
                }
              },
              required: ['exercise_name', 'category', 'sets', 'reps']
            }
          }
        },
        required: ['name', 'order_index', 'sets']
      }
    },
    questions_for_user: {
      type: ['array', 'null'],
      description: 'Domande per chiarire ambiguità (human-in-the-loop)',
      items: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Campo ambiguo (es: recovery_s, time_s)'
          },
          question: {
            type: 'string',
            description: 'Domanda da fare all\'utente'
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Opzioni tra cui scegliere'
          }
        },
        required: ['field', 'question']
      }
    },
    warnings: {
      type: ['array', 'null'],
      description: 'Warning su dati sospetti (anomaly detection)',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['impossible_time', 'unusual_load', 'missing_data', 'ambiguous']
          },
          message: {
            type: 'string',
            description: 'Messaggio di warning'
          },
          field: {
            type: 'string',
            description: 'Campo problematico'
          }
        },
        required: ['type', 'message']
      }
    }
  },
  required: ['session', 'groups']
};

/**
 * Helper per costruire la request con schema
 */
export function buildSchemaRequest(provider, messages, schema = TRAINING_SESSION_SCHEMA) {
  return {
    provider,
    messages,
    model: 'gemini-2.5-flash',
    responseSchema: schema
  };
}
