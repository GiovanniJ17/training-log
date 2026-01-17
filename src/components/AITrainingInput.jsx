import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseTrainingWithAI, validateParsedData } from '../services/aiParser';
import { saveTrainingSession } from '../services/trainingService';

export default function AITrainingInput() {
  const [trainingText, setTrainingText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleParse = async () => {
    if (!trainingText.trim()) {
      setError('Inserisci una descrizione dell\'allenamento');
      return;
    }

    setLoading(true);
    setError(null);
    setParsedData(null);
    setSuccess(false);

    try {
      const parsed = await parseTrainingWithAI(trainingText, new Date(date));
      
      // Valida i dati
      const validation = validateParsedData(parsed);
      if (!validation.valid) {
        setError(`Errori di validazione: ${validation.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      setParsedData(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;

    setLoading(true);
    setError(null);

    try {
      const result = await saveTrainingSession(parsedData);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setTrainingText('');
          setParsedData(null);
          setSuccess(false);
        }, 2000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">Inserimento Intelligente</h2>
              <p className="text-primary-100 text-sm">
                Descrivi il tuo allenamento in linguaggio naturale
              </p>
            </div>
          </div>
        </div>

        {/* Input principale */}
        <div className="p-6 space-y-4">
          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Data Allenamento
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrizione Allenamento
            </label>
            <textarea
              value={trainingText}
              onChange={(e) => setTrainingText(e.target.value)}
              placeholder="Es: Oggi pista, riscaldamento 2km + drill. Poi 6x200m recupero 3min, tempi 25-26sec. Palestra: squat 3x8 80kg, affondi 3x10. RPE 8/10, mi sentivo bene!"
              rows={8}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
            <p className="mt-2 text-xs text-gray-400">
              Scrivi liberamente: distanze, tempi, serie, recuperi, sensazioni...
            </p>
          </div>

          {/* Bottone Parse */}
          {!parsedData && (
            <button
              onClick={handleParse}
              disabled={loading || !trainingText.trim()}
              className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Interpretazione AI in corso...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Interpreta con AI
                </>
              )}
            </button>
          )}

          {/* Errori */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-200">{error}</div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <div className="text-sm text-green-200">
                Sessione salvata con successo!
              </div>
            </div>
          )}

          {/* Anteprima dati parsati */}
          {parsedData && !success && (
            <div className="space-y-4">
              <div className="border-t border-slate-600 pt-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  Anteprima Interpretazione
                </h3>

                {/* Sessione */}
                <div className="bg-slate-700/50 rounded-lg p-4 mb-3">
                  <h4 className="font-medium text-white mb-2">{parsedData.session.title || 'Sessione'}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-400">Tipo:</div>
                    <div className="text-white capitalize">{parsedData.session.type}</div>
                    {parsedData.session.rpe && (
                      <>
                        <div className="text-gray-400">RPE:</div>
                        <div className="text-white">{parsedData.session.rpe}/10</div>
                      </>
                    )}
                    {parsedData.session.feeling && (
                      <>
                        <div className="text-gray-400">Sensazione:</div>
                        <div className="text-white">{parsedData.session.feeling}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Gruppi ed esercizi */}
                {parsedData.groups.map((group, idx) => (
                  <div key={idx} className="bg-slate-700/30 rounded-lg p-4 mb-3">
                    <h5 className="font-medium text-primary-300 mb-2">{group.name}</h5>
                    <div className="space-y-2">
                      {group.sets.map((set, setIdx) => (
                        <div key={setIdx} className="text-sm text-gray-300 pl-3 border-l-2 border-primary-500">
                          <span className="font-medium">{set.exercise_name}</span>
                          {set.sets > 1 && <span> • {set.sets} serie</span>}
                          {set.reps > 1 && <span> • {set.reps} reps</span>}
                          {set.distance_m && <span> • {set.distance_m}m</span>}
                          {set.weight_kg && <span> • {set.weight_kg}kg</span>}
                          {set.time_s && <span> • {set.time_s}s</span>}
                          {set.recovery_s && <span> • rec {set.recovery_s}s</span>}
                          <span className="text-xs text-gray-500 ml-2">({set.category})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottoni azione */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Salva nel Database
                    </>
                  )}
                </button>
                <button
                  onClick={() => setParsedData(null)}
                  disabled={loading}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Modifica
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Esempi */}
      <div className="mt-8 bg-slate-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">💡 Esempi di Input</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <div className="bg-slate-700/30 p-3 rounded">
            <strong className="text-primary-300">Pista:</strong> "Riscaldamento 2km + drill. 8x300m recupero 4min, media 42sec. Defaticamento 1km. RPE 9/10"
          </div>
          <div className="bg-slate-700/30 p-3 rounded">
            <strong className="text-primary-300">Palestra:</strong> "Squat 4x6 90kg, stacchi 3x8 100kg, panca 3x10 70kg, plank 3x60sec"
          </div>
          <div className="bg-slate-700/30 p-3 rounded">
            <strong className="text-primary-300">Misto:</strong> "Pista mattina: 6x200m rec 3min. Pomeriggio palestra: gambe, squat 3x8 85kg, affondi 3x10"
          </div>
        </div>
      </div>
    </div>
  );
}
