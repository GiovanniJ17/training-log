import { useState } from 'react';
import { PlusCircle, BarChart3, Calendar, User } from 'lucide-react';
import AITrainingInput from './components/AITrainingInput';
import TrainingDashboard from './components/TrainingDashboard';
import SessionHistory from './components/History/SessionHistory';
import AthleteProfile from './components/AthleteProfile';

function App() {
  const [activeTab, setActiveTab] = useState('input'); // 'input', 'stats', 'history', 'profile'
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger per refresh profilo

  const handleDataSaved = () => {
    setRefreshTrigger(prev => prev + 1); // Incrementa per forzare refresh
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">🏃‍♂️ Training Log</h1>
              <p className="text-sm text-gray-400">Track & Field Performance Tracker</p>
            </div>

            {/* Navigation tabs */}
            <nav className="flex gap-2">
              <button
                onClick={() => setActiveTab('input')}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'input'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
                Inserimento
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'stats'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Statistiche
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'history'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Storico
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'profile'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <User className="w-5 h-5" />
                Profilo
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="py-8">
        {activeTab === 'input' && <AITrainingInput onDataSaved={handleDataSaved} />}
        {activeTab === 'stats' && <TrainingDashboard />}
        {activeTab === 'history' && <SessionHistory />}
        {activeTab === 'profile' && <AthleteProfile key={refreshTrigger} />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
          <p>Training Log - Sistema intelligente di tracciamento allenamenti</p>
          <p className="mt-1">Powered by AI • Supabase • Cloudflare Pages</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
