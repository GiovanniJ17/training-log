import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const Icons = {
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Calendar: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Alert: () => <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
};

type Session = { id: string; date: string; title: string; type: string; rpe: number; notes: string; };
type GroupDetail = { id: string; name: string; workout_sets: any[]; };

export default function WorkoutHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');     
  const [filterDay, setFilterDay] = useState('all');    

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [details, setDetails] = useState<GroupDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchSessions(); }, []);

  // --- 🔥 NUOVO: BLOCCO DELLO SCROLL BACKGROUND ---
  // Quando un modale è aperto (selectedSession o deleteId), blocca lo scroll del body
  useEffect(() => {
    if (selectedSession || deleteId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup quando il componente viene smontato
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedSession, deleteId]);
  // ------------------------------------------------

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase.from('training_sessions').select('*').order('date', { ascending: false });
      if (error) throw error;
      setSessions(data || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('training_sessions').delete().eq('id', deleteId);
      setSessions(prev => prev.filter(s => s.id !== deleteId));
      setDeleteId(null); 
    } catch (error) { alert("Errore"); }
  };

  const openDeleteModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  }

  const openDetails = async (session: Session) => {
    setSelectedSession(session);
    setLoadingDetails(true);
    setDetails([]);
    try {
      const { data } = await supabase.from('workout_groups').select(`id, name, order_index, workout_sets (*)`).eq('session_id', session.id).order('order_index', { ascending: true });
      const sorted = data?.map(g => ({ ...g, workout_sets: g.workout_sets.sort((a:any,b:any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) }));
      setDetails(sorted || []);
    } catch (error) { console.error(error); } finally { setLoadingDetails(false); }
  };

  const filteredSessions = sessions.filter(session => {
    const sDate = new Date(session.date);
    const matchesSearch = searchTerm === '' || session.title?.toLowerCase().includes(searchTerm.toLowerCase()) || session.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = filterDate === '' || session.date === filterDate;
    const matchesDay = filterDay === 'all' || sDate.getDay().toString() === filterDay;
    return matchesSearch && matchesDate && matchesDay;
  });

  const formatSetDisplay = (set: any) => {
    if (set.distance_m && set.distance_m > 0) return `${set.sets} x ${set.distance_m}m`;
    if (set.time_s && (!set.reps || set.reps <= 1)) return `${set.sets} x ${set.time_s}"`;
    if (set.reps && set.reps > 0) return `${set.sets} x ${set.reps}`;
    return "";
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Caricamento...</div>;

  return (
    <div className="space-y-6 pb-20">
      
      {/* BARRA FILTRI */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Icons.Search />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Cerca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <input type="date" className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          <select className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
            <option value="all">Tutti i Giorni</option>
            <option value="1">Lunedì</option>
            <option value="2">Martedì</option>
            <option value="3">Mercoledì</option>
            <option value="4">Giovedì</option>
            <option value="5">Venerdì</option>
            <option value="6">Sabato</option>
            <option value="0">Domenica</option>
          </select>
          {(filterDate || filterDay !== 'all') && <button onClick={() => { setFilterDate(''); setFilterDay('all'); }} className="text-sm text-red-400 font-bold px-3">Reset</button>}
        </div>
      </div>

      {/* LISTA RISULTATI */}
      <div className="grid gap-4">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-20 text-slate-600">Nessun allenamento trovato.</div>
        ) : (
          filteredSessions.map((session) => (
            <div 
              key={session.id} 
              onClick={() => openDetails(session)}
              className="group bg-slate-900 rounded-2xl p-6 border border-slate-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5 ${session.type==='pista' ? 'bg-red-500' : session.type==='palestra' ? 'bg-indigo-500' : 'bg-slate-600'}`} />
              <div className="flex justify-between items-start pl-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1"><Icons.Calendar /> {new Date(session.date).toLocaleDateString('it-IT')}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300">{new Date(session.date).toLocaleDateString('it-IT', { weekday: 'long' })}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {session.title || 'Allenamento senza titolo'}
                  </h3>
                  {session.notes && <p className="text-slate-400 text-sm line-clamp-1">{session.notes}</p>}
                </div>
                {session.rpe > 0 && <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl font-black text-xl border ${session.rpe >= 8 ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{session.rpe}</div>}
              </div>
              <button onClick={(e) => openDeleteModal(session.id, e)} className="absolute bottom-4 right-4 p-2 text-slate-600 hover:text-red-400 transition z-10 opacity-0 group-hover:opacity-100"><Icons.Trash /></button>
            </div>
          ))
        )}
      </div>

      {/* --- MODALE CONFERMA CANCELLAZIONE --- */}
      {deleteId && (
        // FIXED INSET-0: Copre tutto lo schermo
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95">
            <div className="flex justify-center mb-4"><Icons.Alert /></div>
            <h3 className="text-xl font-bold text-white mb-2">Eliminare sessione?</h3>
            <p className="text-slate-400 text-sm mb-6">L'azione è irreversibile.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)} className="px-5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition">Annulla</button>
              <button onClick={confirmDelete} className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-900/20 transition">Elimina</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE DETTAGLI --- */}
      {selectedSession && (
        // FIXED INSET-0: Risolve il problema dello spazio trasparente
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          
          {/* Contenitore Modale con Scroll Interno */}
          <div className="bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95">
            
            <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-start">
              <div>
                <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">{selectedSession.type}</span>
                <h2 className="text-2xl font-black text-white mt-1">{selectedSession.title}</h2>
                <p className="text-slate-400 text-sm">{new Date(selectedSession.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><Icons.Close /></button>
            </div>
            
            {/* Solo questo div scrolla ora */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950 space-y-8">
              {loadingDetails ? <div className="text-center text-slate-500">Caricamento...</div> : 
               details.map((group) => (
                <div key={group.id} className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">{group.name}</h3>
                  </div>
                  <div className="space-y-3 pl-5 border-l-2 border-slate-800 ml-1">
                    {group.workout_sets?.map((set: any, idx: number) => (
                      <div key={idx} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-200 text-lg">{set.exercise_name}</div>
                          {set.notes && <div className="text-slate-500 text-sm italic">{set.notes}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-blue-400 text-lg">
                            {formatSetDisplay(set)}
                            {set.weight_kg && <span className="text-slate-400 text-sm ml-1">@ {set.weight_kg}kg</span>}
                          </div>
                          {set.recovery_s && <div className="text-xs text-slate-600 font-bold">REC {set.recovery_s}"</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}