// FILE: src/aiLogic.ts
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// --- FUNZIONE 1: ANALISI TESTO ---
export async function analyzeWorkout(text: string) {
  if (!apiKey) throw new Error("Chiave API mancante.");

  try {
    const modelName = await getBestModel();
    const today = new Date();
    const todayString = today.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Prompt ottimizzato per il parsing
    const prompt = `
      Sei un coach di atletica esperto. Analizza il testo e estrai UNA O PIÙ sessioni di allenamento.
      
      CONTESTO TEMPORALE:
      Oggi è: ${todayString}.
      Se l'utente scrive un giorno (es. "Lunedì"), calcola la data di QUESTA settimana.
      
      TESTO UTENTE: "${text}"

      REGOLE FONDAMENTALI:
      1. Restituisci JSON con array "workouts".
      2. GESTIONE RECUPERI: NON creare mai un esercizio "Recupero". Inserisci il tempo in "recovery_s" dell'esercizio PRECEDENTE.
      3. GESTIONE PESI: Se c'è un peso (es. 100kg), mettilo in "weight_kg" come NUMERO (es. 100).
      
      STRUTTURA JSON:
      {
        "workouts": [
          {
            "session": { 
              "date": "YYYY-MM-DD", 
              "type": "pista|palestra|strada|gara|altro", 
              "title": "...", 
              "notes": "...",
              "rpe": 7
            },
            "groups": [
              {
                "name": "Nome Blocco",
                "order_index": 1,
                "sets": [
                  { 
                    "exercise_name": "...", 
                    "sets": 1, "reps": 1, "weight_kg": null, "distance_m": null, "time_s": null, "recovery_s": null, "notes": "..." 
                  }
                ]
              }
            ]
          }
        ]
      }
    `;

    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error("Errore AI response");
    const data = await response.json();
    return cleanAndParseJSON(data.candidates?.[0]?.content?.parts?.[0]?.text);

  } catch (error: any) {
    console.error("❌ Errore AI:", error);
    throw error;
  }
}

// --- FUNZIONE 2: COACH INTELLIGENCE (Questa mancava!) ---
export async function getCoachAdvice(stats: any) {
  if (!apiKey) return "Chiave API mancante.";
  try {
    const modelName = await getBestModel();
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `
      Sei un Allenatore di Atletica Leggera di livello Olimpico.
      Analizza questi dati del tuo atleta e dai un feedback breve e tecnico.
      
      DATI ATLETA:
      - Sessioni totali: ${stats.totalSessions}
      - RPE Medio: ${stats.avgRpe}/10
      - Distribuzione: ${JSON.stringify(stats.typeBreakdown)}
      - Metri corsi totali: ${stats.totalDistance}m
      - Volume sollevato: ${stats.totalVolume}kg
      
      RICHIESTA:
      Scrivi un report di max 80 parole.
      1. Analizza lo stato di forma.
      2. Dai un consiglio mirato per la prossima settimana.
      3. Usa un tono motivante ma tecnico.
    `;

    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Il coach sta riposando...";

  } catch (error) {
    return "Impossibile contattare il coach al momento.";
  }
}

// Helpers
async function getBestModel() {
  return "gemini-1.5-flash"; 
}

function cleanAndParseJSON(text: string) {
  try {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    return JSON.parse(text);
  } catch (e) { throw new Error("JSON non valido."); }
}