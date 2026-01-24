import { useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { parseTrainingWithAI, validateParsedData } from '../services/aiParser'
import { saveTrainingSessions } from '../services/trainingService'
import AmbiguityModal from './AmbiguityModal'
import { Card, CardBody } from './ui/Card'
import SectionTitle from './ui/SectionTitle'

function friendlyErrorMessage(message) {
  const text = (message || '').toLowerCase()

  if (text.includes('overload') || text.includes('overloaded')) {
    return 'Server Google Gemini sovraccarico. Riprova tra qualche secondo.'
  }

  if (text.includes('quota') || text.includes('exceeded')) {
    return "Quota Gemini esaurita. Contatta l'amministratore."
  }

  if (text.includes('api key') || text.includes('key was reported as leaked')) {
    return "Errore di autenticazione. Contatta l'amministratore."
  }

  return message || 'Errore sconosciuto'
}

export default function AITrainingInput({ onDataSaved }) {
  const [trainingText, setTrainingText] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [ambiguityQuestions, setAmbiguityQuestions] = useState(null)
  const [warnings, setWarnings] = useState([])

  const handleParse = async () => {
    if (!trainingText.trim()) {
      setError("Inserisci una descrizione dell'allenamento")
      return
    }

    setLoading(true)
    setError(null)
    setParsedData(null)
    setSuccess(false)
    setAmbiguityQuestions(null)
    setWarnings([])

    console.log('[AITrainingInput] Starting parse with text:', trainingText.substring(0, 100))

    try {
      const parsed = await parseTrainingWithAI(trainingText, new Date())
      console.log('[AITrainingInput] Parse result:', parsed)

      // Estrai questions e warnings dall'AI
      const questionsFromAI = parsed.questions_for_user || []
      const warningsFromAI = parsed.warnings || []

      // Se ci sono ambiguità, mostra subito il modal e rimanda la validazione
      if (questionsFromAI.length > 0) {
        setParsedData(parsed)
        setAmbiguityQuestions(questionsFromAI)
        if (warningsFromAI.length > 0) setWarnings(warningsFromAI)
        setLoading(false)
        return
      }

      // Altrimenti valida normalmente
      const validation = validateParsedData(parsed)
      if (!validation.valid) {
        setError(`Errori di validazione: ${validation.errors.join(', ')}`)
        setLoading(false)
        return
      }

      // Mostra i warnings
      if (warningsFromAI.length > 0) {
        setWarnings(warningsFromAI)
      }

      setParsedData(parsed)
    } catch (err) {
      console.error('[AITrainingInput] Parse error:', err)
      setError(friendlyErrorMessage(err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!parsedData) return

    setLoading(true)
    setError(null)

    try {
      const result = await saveTrainingSessions(parsedData)

      if (result.success) {
        setSuccess(true)
        // Segnala al parent di ricaricare i dati del profilo
        if (onDataSaved) onDataSaved()
        setTimeout(() => {
          setTrainingText('')
          setParsedData(null)
          setSuccess(false)
        }, 2000)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(friendlyErrorMessage(err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleResolveAmbiguity = (answers) => {
    // Applica le risposte utente al parsed data
    if (parsedData && answers) {
      const updatedData = { ...parsedData }

      // Aggiorna i campi basato sulle risposte
      Object.entries(answers).forEach(([field, value]) => {
        if (updatedData[field]) {
          updatedData[field] = value
        }
      })

      setParsedData(updatedData)
    }

    setAmbiguityQuestions(null)
  }

  const handleSkipAmbiguity = () => {
    setAmbiguityQuestions(null)
  }

  return (
    <div className="app-shell w-full py-4 space-y-6">
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-6">
        <div className="glass-card overflow-hidden animate-pop">
          {/* Header */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Inserimento Intelligente</h2>
                <p className="text-slate-400 text-sm">Descrivi il tuo allenamento in linguaggio naturale</p>
              </div>
            </div>
          </div>

          {/* Input principale */}
          <div className="p-5 space-y-4">
            {/* Textarea */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Descrizione Allenamento
              </label>
              <textarea
                value={trainingText}
                onChange={(e) => setTrainingText(e.target.value)}
                placeholder="Es: Oggi pista, riscaldamento 2km + drill. Poi 6x200m recupero 3min, tempi 25-26sec. Palestra: squat 3x8 80kg, affondi 3x10. RPE 8/10, mi sentivo bene!"
                rows={7}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
              />
              <p className="mt-2 text-xs text-slate-400">
                Scrivi liberamente: distanze, tempi, serie, recuperi, sensazioni...
              </p>
            </div>

            {/* Parse Button */}
            {!parsedData && (
              <button
                onClick={handleParse}
                disabled={loading || !trainingText.trim()}
                className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div className="text-sm text-green-300">
                  {parsedData?.sessions?.length > 1
                    ? 'Sessioni salvate con successo!'
                    : 'Sessione salvata con successo!'}
                </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="panel-body space-y-2 bg-yellow-900/30 border border-yellow-700 rounded-lg transition-shadow duration-200 hover:shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <h4 className="font-semibold text-yellow-200">Avvisi dall'IA</h4>
              </div>
              <div className="space-y-2">
                {warnings.map((warning, idx) => (
                  <div key={idx} className="text-sm text-yellow-100">
                    <span className="font-medium">{warning.type}:</span> {warning.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anteprima dati parsati */}
          {parsedData && !success && (
            <div className="space-y-4">
              <div className="border-t border-slate-600 pt-4">
                <SectionTitle
                  title="Anteprima Interpretazione"
                  icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
                  className="mb-3"
                />

                {parsedData.sessions.map((sessionWrapper, sessionIdx) => (
                  <Card
                    key={sessionIdx}
                    className="mb-6 bg-slate-700/50 border-slate-600/80 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-xs text-gray-400">Data</p>
                        <p className="text-white font-semibold">{sessionWrapper.session.date}</p>
                      </div>
                      <div className="text-sm text-gray-300">
                        Sessione {sessionIdx + 1} di {parsedData.sessions.length}
                      </div>
                    </div>

                    <h4 className="font-medium text-white mb-2">
                      {sessionWrapper.session.title || 'Sessione'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Tipo:</div>
                      <div className="text-white capitalize">{sessionWrapper.session.type}</div>
                      {sessionWrapper.session.rpe && (
                        <>
                          <div className="text-gray-400">RPE:</div>
                          <div className="text-white">{sessionWrapper.session.rpe}/10</div>
                        </>
                      )}
                      {sessionWrapper.session.feeling && (
                        <>
                          <div className="text-gray-400">Sensazione:</div>
                          <div className="text-white">{sessionWrapper.session.feeling}</div>
                        </>
                      )}
                    </div>

                    {/* Gruppi ed esercizi */}
                    {sessionWrapper.groups.map((group, idx) => (
                      <div key={idx} className="bg-slate-700/30 rounded-lg p-4 mt-3">
                        <h5 className="font-medium text-primary-300 mb-2">{group.name}</h5>
                        <div className="space-y-2">
                          {group.sets.map((set, setIdx) => (
                            <div
                              key={setIdx}
                              className="text-sm text-gray-300 pl-3 border-l-2 border-primary-500"
                            >
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
                  </Card>
                ))}
              </div>

              {/* Debug: Mostra PB e infortuni estratti */}
              {(parsedData.personalBests?.length > 0 || parsedData.injuries?.length > 0) && (
                <div className="border-t border-slate-600 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-primary-300 mb-2">
                    📋 Dati Auto-Estratti:
                  </h3>
                  {parsedData.personalBests?.length > 0 && (
                    <div className="text-xs text-gray-300 mb-2">
                      <strong>PB:</strong>{' '}
                      {parsedData.personalBests
                        .map((pb) => {
                          if (pb.type === 'race') return `${pb.distance_m}m ${pb.time_s}s`
                          if (pb.type === 'training')
                            return `${pb.exercise_name} ${pb.performance_value}${pb.performance_unit === 'seconds' ? 's' : ' ' + pb.performance_unit}`
                          if (pb.type === 'strength') return `${pb.exercise_name} ${pb.weight_kg}kg`
                          return pb.exercise_name || 'PB'
                        })
                        .join(', ')}
                    </div>
                  )}
                  {parsedData.injuries?.length > 0 && (
                    <div className="text-xs text-gray-300">
                      <strong>Infortuni:</strong>{' '}
                      {parsedData.injuries
                        .map((inj) => `${inj.injury_type} ${inj.body_part} (${inj.severity})`)
                        .join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Bottoni azione */}
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 py-3 px-6 btn-success"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Salva {parsedData.sessions.length > 1 ? 'tutte le sessioni' : 'nel Database'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setParsedData(null)}
                  disabled={loading}
                  className="px-6 py-3 btn-ghost link-muted"
                >
                  Modifica
                </button>
              </div>

              {/* Success message */}
              {success && (
                <div className="panel-body mt-4 bg-green-900/30 border border-green-600 rounded-lg text-center transition-shadow duration-200 hover:shadow-md">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-green-300 font-semibold">
                    ✅ Sessione salvata con successo!
                    {parsedData.personalBests && parsedData.personalBests.length > 0 && (
                      <span>
                        {' '}
                        • {parsedData.personalBests.length} PB aggiunto(i) automaticamente
                      </span>
                    )}
                    {parsedData.injuries && parsedData.injuries.length > 0 && (
                      <span> • {parsedData.injuries.length} infortunio(i) registrato(i)</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="widget-card widget-accent-pink widget-shine widget-tint-pink p-5 sm:p-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Focus rapido</h3>
              <span className="widget-chip">AI Ready</span>
            </div>
            <p className="text-sm soft-muted mt-2">
              Più dettagli inserisci, più l’AI ricostruisce sessioni complete e coerenti.
            </p>
            <div className="mt-4 space-y-2 text-sm text-gray-200">
              <div className="flex items-center gap-2">
                <span className="widget-chip">Distanze</span>
                <span>Serie, recuperi, tempi e RPE.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="widget-chip">Contesto</span>
                <span>Luogo, sensazioni, note extra.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="widget-chip">PB/PR</span>
                <span>Record personali e condizioni.</span>
              </div>
            </div>
          </Card>

          <Card className="widget-card widget-teal p-5 animate-slide-up">
            <h3 className="text-base font-bold text-white mb-4">Flow in 3 step</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <span className="text-slate-200 font-medium">1. Descrivi il workout</span>
                <span className="px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-200 text-xs font-semibold">Input</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <span className="text-slate-200 font-medium">2. Verifica i dati estratti</span>
                <span className="px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-200 text-xs font-semibold">Review</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <span className="text-slate-200 font-medium">3. Salva e aggiorna KPI</span>
                <span className="px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-200 text-xs font-semibold">Save</span>
              </div>
            </div>
          </Card>

          <Card className="widget-card widget-orange p-5 animate-slide-up">
            <h3 className="text-base font-bold text-white mb-4">Suggerimenti rapidi</h3>
            <div className="grid grid-cols-2 gap-2">
              {['RPE', 'Recuperi', 'Palestra', 'Test', 'Note', 'Infortuni'].map((tag) => (
                <span 
                  key={tag}
                  className="px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-200 text-center text-sm font-semibold hover:bg-orange-500/15 transition-all cursor-pointer"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Record Modal rimosso - ora tutto è automatico! */}

      {/* Esempi */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">💡 Esempi di Input</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
            <strong className="text-cyan-300">Con PB:</strong>
            <span className="text-slate-300"> "100m 10.5sec PB + sprint 60m"</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
            <strong className="text-cyan-300">Con Massimale:</strong>
            <span className="text-slate-300"> "Squat 100kg PB, panca 75kg massimale"</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
            <strong className="text-cyan-300">Con Infortunio:</strong>
            <span className="text-slate-300"> "Sessione pista ma dolore spalla lieve"</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
            <strong className="text-cyan-300">Completo:</strong>
            <span className="text-slate-300"> "Pista: 100m 10.4sec nuovo record."</span>
          </div>
        </div>
      </div>

      {/* Ambiguity Modal */}
      {ambiguityQuestions && (
        <AmbiguityModal
          questions={ambiguityQuestions}
          onResolve={handleResolveAmbiguity}
          onSkip={handleSkipAmbiguity}
        />
      )}
    </div>
  )
}
