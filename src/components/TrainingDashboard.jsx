import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { Download, Filter, Calendar, TrendingUp } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import {
  getStatsData,
  calculateKPIs,
  getProgressionChartData,
  getWeeklyHeatmapData,
  getSessionTypeDistribution,
  getTimeSeriesStats,
  getRPEPerformanceCorrelation,
  getInjuryTimeline,
  getMonthlyMetrics,
  exportToCSV,
} from '../services/statisticsService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function TrainingDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('3months'); // 'week', 'month', '3months', 'custom'
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [progressionData, setProgressionData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [injuryTimeline, setInjuryTimeline] = useState([]);
  const [monthlyMetrics, setMonthlyMetrics] = useState([]);
  const [selectedDistance, setSelectedDistance] = useState(null);
  const [rawData, setRawData] = useState({ sessions: [], raceRecords: [], trainingRecords: [], strengthRecords: [], injuries: [] });

  useEffect(() => {
    loadDashboardData();
  }, [period, startDate, endDate]);

  const loadDashboardData = async () => {
    setLoading(true);

    // Calcola date in base al period
    const end = endDate || new Date();
    let start = startDate;

    if (!start) {
      switch (period) {
        case 'week':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      }
    }

    const result = await getStatsData(start, end);

    if (result.success) {
      const { sessions, raceRecords, trainingRecords, strengthRecords, injuries } = result.data;
      console.log('[TrainingDashboard] fetched', {
        sessions: sessions.length,
        raceRecords: raceRecords.length,
        strengthRecords: strengthRecords.length,
        injuries: injuries.length,
        sessionDates: sessions.map(s => s.date),
        raceDates: raceRecords.map(r => r.training_sessions?.[0]?.date || r.training_sessions?.date || r.created_at),
      });
      setRawData({ sessions, raceRecords, trainingRecords, strengthRecords, injuries });

      // Calcola tutte le metriche
      const kpisCalc = calculateKPIs(sessions, raceRecords, strengthRecords, trainingRecords);
      setKpis(kpisCalc);

      const progression = getProgressionChartData(raceRecords);
      setProgressionData(progression);

      const weekly = getWeeklyHeatmapData(sessions);
      setWeeklyData(weekly);

      const distribution = getSessionTypeDistribution(sessions);
      setDistributionData(distribution);

      const scatter = getRPEPerformanceCorrelation(sessions, raceRecords);
      setScatterData(scatter);

      const injuryTl = getInjuryTimeline(injuries, raceRecords);
      setInjuryTimeline(injuryTl);

      const monthly = getMonthlyMetrics(sessions, raceRecords);
      setMonthlyMetrics(monthly);
    }

    setLoading(false);
  };

  const availableDistances = useMemo(() => {
    const keys = new Set();
    progressionData.forEach((d) => {
      Object.keys(d)
        .filter((k) => k !== 'date')
        .forEach((k) => keys.add(parseInt(k)));
    });
    return Array.from(keys).sort((a, b) => a - b);
  }, [progressionData]);

  const scatterDistances = useMemo(() => {
    const keys = new Set(scatterData.map((d) => d.distance));
    return Array.from(keys).sort((a, b) => a - b);
  }, [scatterData]);

  useEffect(() => {
    if (availableDistances.length === 0) return;
    setSelectedDistance((prev) => (prev && availableDistances.includes(prev) ? prev : availableDistances[0]));
  }, [availableDistances]);

  useEffect(() => {
    if (scatterDistances.length === 0) return;
    setSelectedDistance((prev) => (prev && scatterDistances.includes(prev) ? prev : scatterDistances[0]));
  }, [scatterDistances]);

  const handleExportCSV = () => {
    exportToCSV(rawData.sessions, rawData.raceRecords, `training-stats-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">Caricamento statistiche...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header con filtri */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">📊 Statistiche Dettagliate</h1>
          <p className="text-gray-400">Analisi approfondita delle tue performance</p>
        </div>
        <div className="flex gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value="week">Ultima Settimana</option>
            <option value="month">Ultimo Mese</option>
            <option value="3months">Ultimi 3 Mesi</option>
            <option value="custom">Custom</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-gray-400 text-sm mb-2">Sessioni</div>
            <div className="text-3xl font-bold text-primary-400">{kpis.totalSessions}</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-gray-400 text-sm mb-2">RPE Medio</div>
            <div className="text-3xl font-bold text-green-400">{kpis.avgRPE}</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-gray-400 text-sm mb-2">Personal Best</div>
            <div className="text-3xl font-bold text-yellow-400">{kpis.pbCount}</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="text-gray-400 text-sm mb-2">Streak 🔥</div>
            <div className="text-3xl font-bold text-red-400">{kpis.streak} giorni</div>
          </div>
        </div>
      )}

      {/* Progressione Tempi */}
      {progressionData.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Progressione Tempi
            </h2>
            {availableDistances.length > 0 && (
              <div className="text-xs text-gray-400">Distanze: {availableDistances.join(', ')}m</div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={progressionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              {availableDistances.map((dist, idx) => (
                <Line
                  key={dist}
                  type="monotone"
                  dataKey={`${dist}m`}
                  stroke={COLORS[idx % COLORS.length]}
                  dot={{ fill: COLORS[idx % COLORS.length] }}
                  strokeWidth={2}
                  name={`${dist}m`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sessioni per tipo */}
      {distributionData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Distribuzione Tipi Allenamento</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percentage }) => `${name} ${percentage}%`}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Heatmap Settimanale */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Intensità Settimanale</h2>
            <div className="space-y-2">
              {weeklyData.slice(-8).map((week) => (
                <div key={week.week} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-mono text-gray-400">{week.week}</div>
                  <div className="flex-1 h-8 bg-slate-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-red-500 transition-all"
                      style={{ width: `${week.intensity}%` }}
                    />
                  </div>
                  <div className="text-sm font-bold text-white">{week.avgRPE} RPE</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RPE vs Performance */}
      {scatterData.length > 0 && selectedDistance && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Correlazione RPE vs Tempo</h2>
            {scatterDistances.length > 0 && (
              <select
                value={selectedDistance}
                onChange={(e) => setSelectedDistance(parseInt(e.target.value))}
                className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
              >
                {scatterDistances.map((dist) => (
                  <option key={dist} value={dist}>{dist}m</option>
                ))}
              </select>
            )}
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" dataKey="rpe" name="RPE" stroke="#94a3b8" label={{ value: 'RPE', position: 'insideBottomRight', offset: -5 }} />
              <YAxis type="number" dataKey="time" name="Tempo" stroke="#94a3b8" label={{ value: 'Secondi', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Scatter
                data={scatterData.filter(d => d.distance === selectedDistance)}
                fill="#3b82f6"
                name={`${selectedDistance}m`}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Metriche Mensili */}
      {monthlyMetrics.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">Trend Mensile</h2>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={monthlyMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Sessioni" />
              <Line type="monotone" dataKey="avg" stroke="#10b981" name="Tempo Medio" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline Infortuni */}
      {injuryTimeline.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">🏥 Timeline Infortuni</h2>
          <div className="space-y-4">
            {injuryTimeline.map((injury, idx) => (
              <div key={idx} className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-white">{injury.injury_type}</h3>
                    <p className="text-sm text-gray-400">{injury.body_part}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm font-bold ${
                    injury.severity === 'minor' ? 'bg-yellow-600' :
                    injury.severity === 'moderate' ? 'bg-orange-600' :
                    'bg-red-600'
                  } text-white`}>
                    {injury.severity}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  {injury.start_date} → {injury.end_date || 'Attivo'} ({injury.duration} giorni)
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Record durante infortunio: {injury.affectedRecords}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {progressionData.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
          <p className="text-gray-400 text-lg">Nessun dato disponibile per il periodo selezionato</p>
        </div>
      )}
    </div>
  );
}
