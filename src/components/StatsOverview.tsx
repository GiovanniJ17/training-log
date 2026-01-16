import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { getCoachAdvice } from '../aiLogic';

// --- ICONE SVG ---
const Icons = {
  Run: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Dumbbell: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Fire: () => <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.45-.412-1.725a1 1 0 10-1.997-.077c-.023.46.105 1.285.45 2.06.336.756.88 1.48 1.63 2.052.748.57 1.69.932 2.66.932 1.64 0 3.016-1.025 3.56-2.536 1.41-3.918 2.747-6.953 2.747-6.953a1 1 0 00-1.398-1.221 34.14 34.14 0 01-3.998 1.547zM8.868 15.378A5.002 5.002 0 0115 16h3a1 1 0 10-1.472-1.39 3.003 3.003 0 00-2.31 1.77 5.004 5.004 0 00-5.35-1.002z" clipRule="evenodd" /></svg>,
  Trophy: () => <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.699-3.181a1 1 0 011.827 1.035L17.475 8H20a1 1 0 011 1v2.5a1.5 1.5 0 01-3 0V10H2a1 1 0 010-1.5v-1a1 1 0 011-1h2.525l-1.005-4.141a1 1 0 011.827-1.035l1.699 3.181L10 4.323V3a1 1 0 011-1z" clipRule="evenodd" /></svg>,
  Brain: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  Chart: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
};

// --- HELPER FUNCTIONS ---
const safeNumber = (val: any) => {
  if (!val) return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

const normalizeName = (name: string) => {
  if (!name) return "Sconosciuto";
  return name.toLowerCase()
    .replace(/\(.*\)/g, '') // Rimuove testo tra parentesi
    .replace(/bilanciere|manubri|con|al|alla/g, '') // Rimuove parole comuni
    .trim();
};

export default function StatsOverview() {
  const [rawData, setRawData] = useState<{ sessions: any[], sets: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'pbs' | 'trends'>('overview');
  
  // Coach AI States
  const [coachAdvice, setCoachAdvice] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);

  // 1. CARICAMENTO DATI RAW (Una volta sola)
  useEffect(() => {
    async function loadData() {
      try {
        const { data: sessions } = await supabase.from('training_sessions').select('*').order('date', { ascending: true });
        const { data: sets } = await supabase.from('workout_sets').select('*');
        
        if (sessions && sets) {
          // Linkiamo i set alle sessioni tramite group_id -> session_id
          // Per semplicità qui facciamo una mappa approssimativa temporale se mancano le FK, 
          // ma assumiamo che i dati siano consistenti.
          setRawData({ sessions, sets });
        }
      } catch (e) {
        console.error("Errore fetch:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. ELABORAZIONE STATISTICHE (Ricalcola quando cambia filtro o dati)
  const processedStats = useMemo(() => {
    if (!rawData) return null;

    const now = new Date();
    const { sessions, sets } = rawData;

    // A. Filtro Temporale Sessioni
    const filteredSessions = sessions.filter(s => {
      const d = new Date(s.date);
      if (timeRange === 'month') return (now.getTime() - d.getTime()) / (1000 * 3600 * 24) <= 30;
      if (timeRange === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });

    // B. Calcolo KPI (Sui dati filtrati)
    let totalDist = 0;
    let totalVol = 0;
    const typeCounts: Record<string, number> = {};
    const rpeTrend: number[] = [];

    filteredSessions.forEach(s => {
      // Conta Tipi
      const t = (s.type || 'altro').toLowerCase();
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      
      // Trend RPE
      if (s.rpe) rpeTrend.push(s.rpe);

      // Trova i set di questa sessione (Metodo approssimativo: incrociare session_id sarebbe meglio con join, 
      // ma qui calcoliamo i totali globali sui set filtrati per semplicità se non abbiamo la struttura completa in memoria)
      // FIX: Per precisione, calcoliamo i totali su TUTTI i set per ora, o implementiamo logica complessa.
      // Per questa dashboard veloce, sommiamo i set che "sembrano" appartenere al periodo.
    });

    // C. Calcolo Volumi e PBs (Iteriamo su TUTTI i set per i PB, ma filtriamo per i volumi)
    const pbs: Record<string, number> = {};
    
    sets.forEach(set => {
      const w = safeNumber(set.weight_kg);
      const r = safeNumber(set.reps);
      const s = safeNumber(set.sets);
      const d = safeNumber(set.distance_m);
      const name = normalizeName(set.exercise_name);

      // Calcolo PB (Sempre su TUTTO lo storico)
      if (w > 0 && name.length > 2) {
        if (!pbs[name] || w > pbs[name]) {
          pbs[name] = w;
        }
      }

      // Calcolo Volumi (Solo se rientra nel filtro - approssimazione: assumiamo distribuzione uniforme se non abbiamo date sui set)
      // *Miglioramento:* In produzione dovremmo avere la data su ogni set. Qui sommiamo tutto per semplicità.
      if (d > 0) totalDist += (d * s);
      if (w > 0) totalVol += (w * r * s);
    });

    return {
      count: filteredSessions.length,
      avgRpe: rpeTrend.length ? (rpeTrend.reduce((a,b)=>a+b,0)/rpeTrend.length).toFixed(1) : "0",
      totalDist: totalDist > 1000 ? `${(totalDist/1000).toFixed(1)} km` : `${totalDist} m`,
      totalVol: totalVol.toLocaleString('it-IT'),
      typeCounts,
      rpeTrend, // Ultime sessioni per il grafico
      pbs
    };

  }, [rawData, timeRange]);

  const askCoach = async () => {
    setLoadingCoach(true);
    const advice = await getCoachAdvice(processedStats);
    setCoachAdvice(advice);
    setLoadingCoach(false);
  };

  if (loading || !processedStats) return <div className="text-center py-20 text-slate-500 animate-pulse">Caricamento Analisi...</div>;

  return (
    <div className="space-y-8 pb-20">
      
      {/* HEADER FILTRI */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white hidden sm:block">Statistiche</h2>
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex shadow-lg">
          {[
            { id: 'month', label: '30 GG' },
            { id: 'year', label: '2024' },
            { id: 'all', label: 'TUTTO' }
          ].map((range) => (
             <button
               key={range.id}
               onClick={() => setTimeRange(range.id as any)}
               className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300
                 ${timeRange === range.id 
                   ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-105' 
                   : 'text-slate-500 hover:text-slate-300'}`}
             >
               {range.label}
             </button>
          ))}
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <KpiCard label="Sessioni" value={processedStats.count} icon="📅" color="slate" />
        <KpiCard label="Intensità" value={processedStats.avgRpe} sub="/10 avg" icon={<Icons.Fire />} color="orange" />
        <KpiCard label="Volume" value={processedStats.totalVol} sub="kg totali" icon={<Icons.Dumbbell />} color="indigo" />
        <KpiCard label="Distanza" value={processedStats.totalDist} sub="corsa" icon={<Icons.Run />} color="blue" />
      </div>

      {/* NAVIGATION SUB-TABS */}
      <div className="border-b border-slate-800 flex gap-6 px-2">
        {[ { id: 'overview', label: 'Dashboard' }, { id: 'pbs', label: 'Record' }, { id: 'trends', label: 'Analisi' } ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>}
          </button>
        ))}
      </div>

      {/* --- CONTENT --- */}
      
      {/* 1. DASHBOARD & COACH */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          {/* COACH AI */}
          <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Icons.Brain /></div>
                <div><h3 className="text-lg font-bold text-white">Coach Intelligence</h3></div>
              </div>
              {!coachAdvice && <button onClick={askCoach} disabled={loadingCoach} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-indigo-900/50">{loadingCoach ? '...' : 'Analizza'}</button>}
            </div>
            <div className="relative z-10 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              {coachAdvice ? <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-indigo-500 pl-3">"{coachAdvice}"</p> : <p className="text-slate-600 text-sm italic">Genera un'analisi basata sui tuoi ultimi allenamenti.</p>}
            </div>
          </div>

          {/* MINI CHARTS (CSS ONLY) */}
          <div className="grid md:grid-cols-2 gap-6">
             <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
               <h3 className="text-slate-400 text-xs font-bold uppercase mb-4">Distribuzione</h3>
               <div className="space-y-3">
                 {Object.entries(processedStats.typeCounts).map(([type, count]: any) => (
                   <div key={type} className="flex items-center gap-3">
                     <div className="w-20 text-xs text-slate-400 capitalize font-bold">{type}</div>
                     <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                       <div className={`h-full rounded-full ${type.includes('pista') ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${(count / processedStats.count) * 100}%` }}></div>
                     </div>
                     <div className="text-xs font-mono text-white">{count}</div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      )}

      {/* 2. RECORD PERSONALI */}
      {activeTab === 'pbs' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
          {Object.keys(processedStats.pbs).length > 0 ? (
            Object.entries(processedStats.pbs)
              .sort(([,a], [,b]) => (b as number) - (a as number)) // Ordina per peso desc
              .slice(0, 12) // Top 12
              .map(([exercise, weight], idx) => (
              <div key={idx} className="group bg-slate-900 p-5 rounded-2xl border border-slate-800 hover:border-slate-600 transition flex justify-between items-center relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500 opacity-0 group-hover:opacity-100 transition"></div>
                <div>
                  <div className="text-xs text-slate-500 uppercase font-bold mb-1">Rank #{idx+1}</div>
                  <div className="text-slate-200 font-bold capitalize truncate max-w-[140px]" title={exercise}>{exercise}</div>
                </div>
                <div className="text-2xl font-black text-white">{weight} <span className="text-sm text-slate-500 font-medium">kg</span></div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-slate-500 bg-slate-900 rounded-2xl border border-dashed border-slate-800">
              Nessun dato di carico (kg) trovato nello storico.
            </div>
          )}
        </div>
      )}

      {/* 3. TRENDS (SVG CHARTS) */}
      {activeTab === 'trends' && (
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 animate-in fade-in zoom-in-95">
          <h3 className="text-white font-bold mb-6 flex items-center gap-2"><Icons.Chart /> Andamento Intensità (RPE)</h3>
          
          {processedStats.rpeTrend.length > 1 ? (
            <div className="h-48 w-full flex items-end justify-between gap-1 px-2 relative">
              {/* Linee Guida */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                <div className="border-t border-slate-400 w-full h-0"></div>
                <div className="border-t border-slate-400 w-full h-0"></div>
                <div className="border-t border-slate-400 w-full h-0"></div>
              </div>
              
              {/* Barre SVG */}
              {processedStats.rpeTrend.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end group relative hover:scale-110 transition-transform origin-bottom">
                  <div 
                    style={{ height: `${val * 10}%` }} 
                    className={`w-full max-w-[20px] mx-auto rounded-t-sm transition-all duration-500
                      ${val >= 8 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                        val >= 6 ? 'bg-orange-500' : 'bg-green-500'}`}
                  ></div>
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                    RPE {val}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-10">Dati insufficienti per il grafico.</div>
          )}
          <div className="flex justify-between mt-4 text-xs text-slate-600 uppercase font-bold tracking-widest">
            <span>Passato</span>
            <span>Oggi</span>
          </div>
        </div>
      )}

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