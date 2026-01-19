import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Trash2, Edit3, Dumbbell, MapPin, Zap } from 'lucide-react';

export default function SessionDetail({ date, sessions, onEdit, onDelete, loading }) {
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

  const typeLabels = {
    pista: 'Pista',
    palestra: 'Palestra',
    strada: 'Strada',
    gara: 'Gara',
    test: 'Test',
    scarico: 'Scarico',
    recupero: 'Recupero',
    altro: 'Altro',
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
        <p className="text-gray-400">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">
        {format(date, 'd MMMM yyyy', { locale: it })}
      </h3>

      {sessions.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
          <p className="text-gray-400">Nessuna sessione registrata per questo giorno</p>
        </div>
      ) : (
        sessions.map(session => (
          <div
            key={session.id}
            className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-slate-600 transition"
          >
            {/* Header Sessione */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className={`${getTypeColor(session.type)} px-3 py-1 rounded-full text-white text-sm font-medium`}>
                  {typeLabels[session.type] || session.type}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">{session.title || 'Sessione'}</h4>
                  <p className="text-sm text-gray-400">{format(new Date(session.date), 'HH:mm', { locale: it })}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(session)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition text-blue-400 hover:text-blue-300"
                  title="Modifica"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(session.id)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition text-red-400 hover:text-red-300"
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-y border-slate-700">
              {session.rpe !== null && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">RPE</p>
                  <p className="text-lg font-bold text-white">{session.rpe}/10</p>
                </div>
              )}
              {session.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Luogo</p>
                    <p className="text-sm text-white">{session.location}</p>
                  </div>
                </div>
              )}
              {session.feeling && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Condizione</p>
                  <p className="text-sm text-white">{session.feeling}</p>
                </div>
              )}
            </div>

            {/* Note */}
            {session.notes && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Note</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{session.notes}</p>
              </div>
            )}

            {/* Placeholder per esercizi - da caricare con SessionDetail completo */}
            <div className="text-xs text-gray-500">
              <p>📋 Esercizi non ancora caricati nel dettaglio</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
