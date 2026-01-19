import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import SessionCalendar from './SessionCalendar';
import SessionDetail from './SessionDetail';
import SessionEditor from './SessionEditor';
import { getSessionsForMonth, getSessionsByDate, deleteTrainingSession } from '../../services/trainingService';

export default function SessionHistory() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessionsByDate, setSessionsByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSession, setEditingSession] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadMonthData();
  }, [currentMonth]);

  const loadMonthData = async () => {
    setLoading(true);
    const result = await getSessionsForMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    if (result.success) {
      setSessionsByDate(result.data);
    }
    setLoading(false);
  };

  const handleDateClick = async (date) => {
    setSelectedDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    const result = await getSessionsByDate(dateStr);
    if (result.success) {
      setSelectedSessions(result.data);
    }
  };

  const handleEditSession = (session) => {
    setEditingSession(session);
    setShowEditor(true);
  };

  const handleDeleteClick = (sessionId) => {
    setDeleteConfirm(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    
    const result = await deleteTrainingSession(deleteConfirm);
    if (result.success) {
      // Ricarica il mese
      await loadMonthData();
      // Se era selezionata, aggiorna
      if (selectedDate) {
        await handleDateClick(selectedDate);
      }
      setDeleteConfirm(null);
    }
  };

  const handleSaveEditor = async () => {
    await loadMonthData();
    if (selectedDate) {
      await handleDateClick(selectedDate);
    }
    setShowEditor(false);
    setEditingSession(null);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="lg:col-span-1">
          <SessionCalendar
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            sessionsByDate={sessionsByDate}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onDateClick={handleDateClick}
            loading={loading}
          />
        </div>

        {/* Dettagli e Editor */}
        <div className="lg:col-span-2">
          {selectedDate && (
            <SessionDetail
              date={selectedDate}
              sessions={selectedSessions}
              onEdit={handleEditSession}
              onDelete={handleDeleteClick}
              loading={loading}
            />
          )}

          {!selectedDate && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
              <p className="text-gray-400">Seleziona un giorno nel calendario per visualizzare le sessioni</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modale */}
      {showEditor && editingSession && (
        <SessionEditor
          session={editingSession}
          onClose={() => {
            setShowEditor(false);
            setEditingSession(null);
          }}
          onSave={handleSaveEditor}
        />
      )}

      {/* Conferma Eliminazione */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Elimina Sessione</h3>
            <p className="text-gray-300 mb-6">Sei sicuro? Questa azione non può essere annullata.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
