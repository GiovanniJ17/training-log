import { useState } from 'react'
import { PlusCircle, BarChart3, Calendar, User } from 'lucide-react'
import AITrainingInput from './components/AITrainingInput'
import TrainingDashboard from './components/TrainingDashboard'
import SessionHistory from './components/History/SessionHistory'
import AthleteProfile from './components/AthleteProfile'

function App() {
  const [activeTab, setActiveTab] = useState('input')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const tabs = [
    { id: 'input', label: 'Inserimento', Icon: PlusCircle },
    { id: 'stats', label: 'Statistiche', Icon: BarChart3 },
    { id: 'history', label: 'Storico', Icon: Calendar },
    { id: 'profile', label: 'Profilo', Icon: User }
  ]

  const handleDataSaved = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen text-white">
      {/* Background with subtle gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 -z-10" />
      
      {/* Decorative blurred orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-900/70 backdrop-blur-xl">
        <div className="app-shell py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <span className="text-xl">🏃</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Training Log</h1>
                <p className="text-xs text-slate-400 hidden sm:block">Track & Field Performance Tracker</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="app-shell py-4">
        <div className="glass-card p-1.5">
          <nav className="flex items-center gap-1">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`nav-tab flex-1 justify-center ${activeTab === id ? 'nav-tab-active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="pb-8 animate-fade-in">
        {activeTab === 'input' && <AITrainingInput onDataSaved={handleDataSaved} />}
        {activeTab === 'stats' && <TrainingDashboard key={refreshTrigger} />}
        {activeTab === 'history' && <SessionHistory key={refreshTrigger} />}
        {activeTab === 'profile' && <AthleteProfile key={refreshTrigger} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-900/30 backdrop-blur-sm py-6">
        <div className="app-shell text-center text-xs text-slate-500">
          <p>Training Log - Tracciamento intelligente allenamenti</p>
        </div>
      </footer>
    </div>
  )
}

export default App
