import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, TrendingUp, Dumbbell, Activity } from 'lucide-react';
import { getTrainingSessions, getTrainingStats } from '../services/trainingService';

export default function TrainingDashboard() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month'); // week, month, year

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    
    // Calcola date range
    const endDate = new Date();
    const startDate = new Date();
    
    if (timeRange === 'week') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    } else if (timeRange === 'year') {
      startDate.setFullYear(endDate.getFullYear() - 1);
    }

    // Carica sessioni e statistiche
    const [sessionsResult, statsResult] = await Promise.all([
      getTrainingSessions(50),
      getTrainingStats(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
    ]);

    if (sessionsResult.success) {
      setSessions(sessionsResult.data);
    }

    if (statsResult.success) {
      setStats(statsResult.data);
    }

    setLoading(false);
  };

  const getTypeColor = (type) => {
    const colors = {
      pista: 'bg-blue-500',
      palestra: 'bg-purple-500',
      strada: 'bg-green-500',
      gara: 'bg-red-500',
      test: 'bg-yellow-500',
      scarico: 'bg-cyan-500',
      recupero: 'bg-teal-500',
      altro: 'bg-gray-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header con filtri */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-7 h-7" />
          Dashboard Allenamenti
        </h2>
        
        <div className="flex gap-2">
          {['week', 'month', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {range === 'week' ? 'Settimana' : range === 'month' ? 'Mese' : 'Anno'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Totale sessioni */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-8 h-8 opacity-80" />
              <div className="text-3xl font-bold">{stats.totalSessions}</div>
            </div>
            <div className="text-primary-100">Sessioni Totali</div>
          </div>

          {/* RPE medio */}
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 opacity-80" />
              <div className="text-3xl font-bold">{stats.avgRPE}</div>
            </div>
            <div className="text-purple-100">RPE Medio</div>
          </div>

          {/* Tipo più frequente */}
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Dumbbell className="w-8 h-8 opacity-80" />
              <div className="text-xl font-bold capitalize">
                {Object.entries(stats.typeDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
              </div>
            </div>
            <div className="text-green-100">Tipo Prevalente</div>
          </div>
        </div>
      )}

      {/* Distribuzione tipi */}
      {stats && Object.keys(stats.typeDistribution).length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Distribuzione per Tipo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.typeDistribution).map(([type, count]) => (
              <div key={type} className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full ${getTypeColor(type)}`} />
                  <span className="text-white capitalize font-medium">{type}</span>
                </div>
                <div className="text-2xl font-bold text-primary-400">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista sessioni recenti */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Sessioni Recenti</h3>
        </div>
        
        <div className="divide-y divide-slate-700">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              Nessuna sessione trovata
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`w-2 h-2 rounded-full ${getTypeColor(session.type)}`} />
                      <h4 className="font-semibold text-white">
                        {session.title || `Allenamento ${session.type}`}
                      </h4>
                      <span className="text-xs text-gray-500 capitalize">
                        {session.type}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-400 ml-5">
                      {format(new Date(session.date), 'EEEE d MMMM yyyy', { locale: it })}
                    </div>

                    {session.notes && (
                      <p className="text-sm text-gray-300 mt-2 ml-5">{session.notes}</p>
                    )}

                    {session.feeling && (
                      <div className="text-sm text-primary-300 mt-1 ml-5">
                        💭 {session.feeling}
                      </div>
                    )}
                  </div>

                  {session.rpe !== null && (
                    <div className="flex flex-col items-center bg-slate-700 rounded-lg px-3 py-2">
                      <div className="text-xs text-gray-400">RPE</div>
                      <div className="text-xl font-bold text-white">{session.rpe}</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
