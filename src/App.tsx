import { useState } from 'react'
import { analyzeWorkout } from './aiLogic'
import { supabase } from './supabaseClient'
import WorkoutHistory from './components/WorkoutHistory'
import StatsOverview from './components/StatsOverview'

function App() {
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'stats'>('new');
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')

  const handleAnalyze = async () => {
    if (!input.trim()) return
    setIsProcessing(true)
    setStatus('🧠 Analisi AI intelligente in corso...')
    
    try {
      // 1. L'AI ora restituisce { workouts: [...] }
      const response = await analyzeWorkout(input)
      
      if (!response.workouts || response.workouts.length === 0) {
        throw new Error("Nessun allenamento rilevato nel testo.");
      }

      setStatus(`💾 Trovate ${response.workouts.length} sessioni. Salvataggio...`)

      // 2. Cicliamo su ogni allenamento trovato e lo salviamo
      for (const item of response.workouts) {
        
        // Sanificazione Data e Tipo per ogni sessione
        let finalDate = new Date().toISOString().split('T')[0];
        if (item.session.date && item.session.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          finalDate = item.session.date;
        }

        const validTypes = ['pista', 'palestra', 'strada', 'gara', 'test', 'scarico', 'recupero', 'altro'];
        let finalType = 'altro';
        if (item.session.type) {
          const aiType = item.session.type.toLowerCase().trim();
          if (validTypes.includes(aiType)) finalType = aiType;
          else if (aiType.includes('pista')) finalType = 'pista';
          else if (aiType.includes('palestra') || aiType.includes('gym')) finalType = 'palestra';
          else if (aiType.includes('strada')) finalType = 'strada';
        }

        // Insert Sessione
        const { data: sessionData, error: sessionError } = await supabase
          .from('training_sessions')
          .insert([{ ...item.session, date: finalDate, type: finalType }])
          .select().single()

        if (sessionError) throw sessionError
        const sessionId = sessionData.id

        // Insert Gruppi
        if (item.groups) {
          for (const group of item.groups) {
            const { data: groupData, error: groupError } = await supabase
              .from('workout_groups')
              .insert([{ session_id: sessionId, name: group.name, order_index: group.order_index }])
              .select().single()
            
            if (groupError) throw groupError

            // Insert Sets
            if (group.sets) {
              const setsToInsert = group.sets.map((s: any) => ({
                ...s,
                group_id: groupData.id,
                weight_kg: s.weight_kg || null,
                distance_m: s.distance_m || null,
                time_s: s.time_s || null,
                recovery_s: s.recovery_s || null
              }))
              const { error: setsError } = await supabase.from('workout_sets').insert(setsToInsert)
              if (setsError) throw setsError
            }
          }
        }
      }

      setStatus('✅ Tutto salvato con successo!')
      setInput('')
      setTimeout(() => {
        setActiveTab('history') // Cambio tab automatico dopo 1.5 secondi
        setStatus('')
      }, 1500);

    } catch (error: any) {
      console.error(error)
      setStatus('❌ Errore: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* HEADER NAVIGAZIONE */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* LOGO AGGIORNATO (Senza trattino) */}
          <h1 className="text-2xl font-black tracking-tighter text-white italic">
            TRACKLOG <span className="text-blue-500 not-italic">AI</span>
          </h1>
          
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'new', label: '📝 Inserisci' },
              { id: 'history', label: '📅 Storico' },
              { id: 'stats', label: '📊 Stats' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-300
                  ${activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENUTO */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        
        {activeTab === 'new' && (
          <div className="max-w-2xl mx-auto bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Nuova Sessione (o Settimana)</h2>
            <p className="text-slate-500 text-sm mb-4">
              Suggerimento: Puoi scrivere "Lunedì pista..., Martedì palestra..." e salverò più giorni insieme usando le date di questa settimana.
            </p>
            <textarea 
              className="w-full h-48 p-4 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition resize-none text-slate-300 text-lg leading-relaxed placeholder:text-slate-600"
              placeholder="Es: Lunedì ho fatto 5x30m. Martedì ho fatto Squat 4x5..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {status && (
              <div className={`mt-4 p-3 rounded-lg text-sm font-bold border ${status.includes('❌') ? 'bg-red-900/20 border-red-900 text-red-400' : 'bg-green-900/20 border-green-900 text-green-400'}`}>
                {status}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleAnalyze}
                disabled={isProcessing || !input}
                className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transform transition hover:-translate-y-1
                  ${isProcessing ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/20'}`}
              >
                {isProcessing ? 'Analisi...' : 'Salva Sessioni'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && <WorkoutHistory />}
        {activeTab === 'stats' && <StatsOverview />}

      </div>
    </div>
  )
}

export default App