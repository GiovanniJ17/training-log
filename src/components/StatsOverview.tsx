import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { getCoachAdvice } from '../aiLogic';

// --- ICONE ---
const Icons = {
  Run: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Dumbbell: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Fire: () => <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.45-.412-1.725a1 1 0 10-1.997-.077c-.023.46.105 1.285.45 2.06.336.756.88 1.48 1.63 2.052.748.57 1.69.932 2.66.932 1.64 0 3.016-1.025 3.56-2.536 1.41-3.918 2.747-6.953 2.747-6.953a1 1 0 00-1.398-1.221 34.14 34.14 0 01-3.998 1.547zM8.868 15.378A5.002 5.002 0 0115 16h3a1 1 0 10-1.472-1.39 3.003 3.003 0 00-2.31 1.77 5.004 5.004 0 00-5.35-1.002z" clipRule="evenodd" /></svg>,
  Trophy: () => <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.699-3.181a1 1 0 011.827 1.035L17.475 8H20a1 1 0 011 1v2.5a1.5 1.5 0 01-3 0V10H2a1 1 0 010-1.5v-1a1 1 0 011-1h2.525l-1.005-4.141a1 1 0 011.827-1.035l1.699 3.181L10 4.323V3a1 1 0 011-1z" clipRule="evenodd" /></svg>,
  Brain: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  Chart: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
};

// --- HELPER DI PULIZIA ---
const cleanNumber = (val: any) => {
  if (!val) return 0;
  // Rimuove "kg", "m", e converte in numero puro
  const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

const normalizeName = (name: string) => {
  if (!name) return "sconosciuto";
  return name.toLowerCase()
    .replace(/\(.*\)/g, '') // Toglie parentesi
    .replace(/bilanciere|manubri|con|al|alla/g, '') // Toglie parole comuni
    .trim();
};

export default function StatsOverview() {
  const [data, setData] = useState<{ sessions: any[], sets: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'pbs' | 'trends'>('overview');
  
  // Stati Coach
  const [coachAdvice, setCoachAdvice] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);

  // 1. CARICAMENTO DATI COMPLETO (JOIN MANUALE)
  useEffect(() => {
    async function loadFullHistory() {
      try {
        // Scarica TUTTO
        const { data: sessions } = await supabase.from('training_sessions').select('*').order('date', { ascending: true });
        const { data: groups } = await supabase.from('workout_groups').select('*');
        const { data: sets } = await supabase.from('workout_sets').select('*');

        if (sessions && groups && sets) {
          // Creiamo una mappa per collegare: Set -> Gruppo -> Sessione
          const groupToSessionMap = new Map();
          groups.forEach(g => groupToSessionMap.set(g.id, g.session_id));

          const sessionDateMap = new Map();
          sessions.forEach(s => sessionDateMap.set(s.id, new Date(s.date)));

          // Arricchiamo ogni set con la data della sua sessione
          const enrichedSets = sets.map(set => {
            const sessionId = groupToSessionMap.get(set.group_id);
            const date = sessionDateMap.get(sessionId);
            return { ...set, date, sessionId }; // Ora il set sa quando è stato fatto!
          }).filter(s => s.date); // Rimuoviamo set orfani

          setData({ sessions, sets: enrichedSets });
        }
      } catch (e) {
        console.error("Errore fetch:", e);
      } finally {
        setLoading(false);
      }
    }
    loadFullHistory();
  }, []);

  // 2. MOTORE DI CALCOLO (Si aggiorna quando cambi filtro)
  const stats = useMemo(() => {
    if (!data) return null;

    const now = new Date();
    const { sessions, sets } = data;

    // Funzione filtro data
    const isWithinRange = (dateString: string | Date) => {
      const d = new Date(dateString);
      if (timeRange === 'all') return true;
      if (timeRange === 'year') return d.getFullYear() === now.getFullYear();
      if (timeRange === 'month') return (now.getTime() - d.getTime()) / (1000 * 3600 * 24) <= 30;
      return false;
    };

    // A. Filtra Sessioni
    const filteredSessions = sessions.filter(s => isWithinRange(s.date));

    // B. Filtra Set (Per volumi e distanze del periodo)
    const filteredSets = sets.filter(s => isWithinRange(s.date));

    // C. Calcolo KPI
    let totalDist = 0;
    let totalVol = 0;
    const typeCounts: Record<string, number> = {};
    const rpeTrend: number[] = [];

    // Loop Sessioni
    filteredSessions.forEach(s => {
      const t = (s.type || 'altro').toLowerCase();
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      if (s.rpe) rpeTrend.push(s.rpe);
    });

    // Loop Set Filtrati (Volume & Distanza Periodo)
    filteredSets.forEach(s => {
      const w = cleanNumber(s.weight_kg);
      const r = cleanNumber(s.reps);
      const rep_sets = cleanNumber(s.sets);
      const d = cleanNumber(s.distance_m);

      if (d > 0) totalDist += (d * rep_sets);
      if (w > 0) totalVol += (w * r * rep_sets);
    });

    // D. Calcolo PB (Sempre su TUTTO lo storico, un record è per sempre!)
    const pbs: Record<string, number> = {};
    sets.forEach(s => {
      const w = cleanNumber(s.weight_kg);
      const name = normalizeName(s.exercise_name);
      
      if (w > 0 && name.length > 2) {
        if (!pbs[name] || w > pbs[name]) {
          pbs[name] = w;
        }
      }
    });

    return {
      count: filteredSessions.length,
      avgRpe: rpeTrend.length ? (rpeTrend.reduce((a,b)=>a+b,0)/rpeTrend.length).toFixed(1) : "0",
      totalDistDisplay: totalDist > 1000 ? `${(totalDist/1000).toFixed(1)} km` : `${totalDist} m`,
      totalVolDisplay: totalVol.toLocaleString('it-IT'),
      totalDistVal: totalDist, // Per il coach
      totalVolVal: totalVol,   // Per il coach
      typeCounts,
      rpeTrend,
      pbs,
      lastDate: filteredSessions[filteredSessions.length-1]?.date
    };

  }, [data, timeRange]);

  const askCoach = async () => {
    if (!stats) return;
    setLoadingCoach(true);
    const coachData = {
      totalSessions: stats.count,
      avgRpe: stats.avgRpe,
      totalDistance: stats.totalDistVal,
      totalVolume: stats.totalVolVal,
      typeBreakdown: stats.typeCounts
    };
    const advice = await getCoachAdvice(coachData);
    setCoachAdvice(advice);
    setLoadingCoach(false);
  };

  if (loading || !stats) return <div className="text-center py-20 text-slate-500 animate-pulse">Caricamento Analisi...</div>;

  return (
    <div className="space-y-8 pb-20 px-1">
      
      {/* HEADER E FILTRI */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Statistiche</h2>
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex shadow-lg">
          {[
            { id: 'month', label: '30 GG' },
            { id: 'year', label: '2025' }, // Aggiornato anno
            { id: 'all', label: 'TUTTO' }
          ].map((range) => (
             <button
               key={range.id}
               onClick={() => setTimeRange(range.id as any)}
               className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300
                 ${timeRange === range.id 
                   ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                   : 'text-slate-500 hover:text-slate-300'}`}
             >
               {range.label}
             </button>
          ))}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <KpiCard label="Sessioni" value={stats.count} icon="📅" color="slate" />
        <KpiCard label="Intensità" value={stats.avgRpe} sub="/10 media" icon={<Icons.Fire />} color="orange" />
        <KpiCard label="Volume" value={stats.totalVolDisplay} sub="kg totali" icon={<Icons.Dumbbell />} color="indigo" />
        <KpiCard label="Distanza" value={stats.totalDistDisplay} sub="corsa" icon={<Icons.Run />} color="blue" />
      </div>

      {/* TABS */}
      <div className="border-b border-slate-800 flex gap-6 px-2 overflow-x-auto">
        {[ { id: 'overview', label: 'Dashboard' }, { id: 'pbs', label: 'Record' }, { id: 'trends', label: 'Analisi' } ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-sm font-bold transition-all whitespace-nowrap relative ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>}
          </button>
        ))}
      </div>

      {/* CONTENUTO TABS */}
      <div className="min-h-[300px]">
        
        {/* 1. DASHBOARD */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* COACH */}
            <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden group mt-4">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Icons.Brain /></div>
                  <div><h3 className="text-lg font-bold text-white">Coach Intelligence</h3></div>
                </div>
                {!coachAdvice && <button onClick={askCoach} disabled={loadingCoach} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-indigo-900/50">{loadingCoach ? '...' : 'Analizza'}</button>}
              </div>
              <div className="relative z-10 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                {coachAdvice ? <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-indigo-500 pl-3">"{coachAdvice}"</p> : <p className="text-slate-600 text-sm italic">Clicca "Analizza" per generare un report sui tuoi {stats.count} allenamenti.</p>}
              </div>
            </div>

            {/* MINI CHART DISTRIBUZIONE */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
               <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Tipologie Allenamento</h3>
               <div className="space-y-3">
                 {Object.entries(stats.typeCounts).map(([type, count]: any) => (
                   <div key={type} className="flex items-center gap-3">
                     <div className="w-24 text-xs text-slate-400 capitalize font-bold truncate">{type}</div>
                     <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                       <div className={`h-full rounded-full ${type.includes('pista') ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${(count / stats.count) * 100}%` }}></div>
                     </div>
                     <div className="text-xs font-mono text-white w-6 text-right">{count}</div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* 2. RECORD */}
        {activeTab === 'pbs' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {Object.entries(stats.pbs).length > 0 ? (
              Object.entries(stats.pbs)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 15)
                .map(([exercise, weight], idx) => (
                <div key={idx} className="group bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition flex justify-between items-center">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-xs font-mono text-slate-600">#{idx+1}</span>
                    <span className="text-slate-300 font-bold capitalize truncate" title={exercise}>{exercise}</span>
                  </div>
                  <span className="text-blue-400 font-black whitespace-nowrap">{weight} <span className="text-xs text-slate-600 font-normal">kg</span></span>
                </div>
              ))
            ) : <div className="col-span-full text-center py-20 text-slate-500">Nessun massimale trovato.</div>}
          </div>
        )}

        {/* 3. TREND */}
        {activeTab === 'trends' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 mt-4 animate-in fade-in zoom-in-95">
            <h3 className="text-white font-bold mb-6 flex items-center gap-2"><Icons.Chart /> Trend Intensità (RPE)</h3>
            <div className="h-40 w-full flex items-end justify-between gap-1 px-2 relative">
              {/* Griglia Sfondo */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                <div className="border-t border-slate-400 w-full h-0"></div>
                <div className="border-t border-slate-400 w-full h-0"></div>
              </div>
              
              {stats.rpeTrend.length > 0 ? stats.rpeTrend.slice(-15).map((val, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end group relative hover:scale-105 transition-transform">
                  <div 
                    style={{ height: `${val * 10}%` }} 
                    className={`w-full max-w-[30px] mx-auto rounded-t-sm transition-all duration-500 opacity-80 hover:opacity-100
                      ${val >= 8 ? 'bg-red-500' : val >= 6 ? 'bg-orange-500' : 'bg-green-500'}`}
                  ></div>
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-xs font-bold px-2 py-1 rounded z-10">
                    {val}
                  </div>
                </div>
              )) : <div className="w-full text-center text-slate-500 self-center">Dati insufficienti</div>}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-600 uppercase font-bold tracking-widest">
              <span>Passato</span>
              <span>Recente</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mini Componente Card
function KpiCard({ label, value, sub, icon, color }: any) {
  const colors: any = {
    slate: "bg-slate-800/50 text-slate-200 border-slate-700",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
  };
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} flex flex-col justify-between min-h-[100px]`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] uppercase font-bold opacity-70 tracking-wider">{label}</span>
        <div className="opacity-80 scale-75 origin-top-right">{icon}</div>
      </div>
      <div>
        <div className="text-2xl font-black tracking-tight">{value}</div>
        {sub && <div className="text-[10px] opacity-50 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}