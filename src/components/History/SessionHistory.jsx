import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import EmptyState from '../ui/EmptyState'
import LoadingSpinner from '../LoadingSpinner'
import SessionCalendar from './SessionCalendar'
import SessionDetail from './SessionDetail'
import {
  getSessionsForMonth,
  getSessionsByDate,
  getSessionDetails,
  deleteTrainingSession
} from '../../services/trainingService'

export default function SessionHistory() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [sessionsByDate, setSessionsByDate] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSessions, setSelectedSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadMonthData = useCallback(async () => {
    setLoading(true)
    const result = await getSessionsForMonth(currentMonth.getFullYear(), currentMonth.getMonth())
    if (result.success) {
      setSessionsByDate(result.data)
    }
    setLoading(false)
  }, [currentMonth])

  useEffect(() => {
    loadMonthData()
  }, [loadMonthData])

  const handleDateClick = async (date) => {
    setSelectedDate(date)
    const dateStr = format(date, 'yyyy-MM-dd')
    try {
      const result = await getSessionsByDate(dateStr)
      if (result.success) {
        const detailed = await Promise.all(
          result.data.map(async (session) => {
            const detailRes = await getSessionDetails(session.id)
            return detailRes.success ? detailRes.data : session
          })
        )
        setSelectedSessions(detailed)
      } else {
        setSelectedSessions([])
        console.warn('Impossibile caricare le sessioni per la data', dateStr, result.error)
      }
    } catch (err) {
      console.warn('Errore nel caricamento dettagli data', err)
      setSelectedSessions([])
    }
  }

  const handleDeleteClick = (sessionId) => {
    setDeleteConfirm(sessionId)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    const result = await deleteTrainingSession(deleteConfirm)
    if (result.success) {
      // Ricarica il mese
      await loadMonthData()
      // Se era selezionata, aggiorna
      if (selectedDate) {
        await handleDateClick(selectedDate)
      }
      setDeleteConfirm(null)
    }
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  return (
    <div className="app-shell animate-pop">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-5 lg:gap-8">
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
        <div className="lg:col-span-2 space-y-4">
          {selectedDate && (
            <>
              <div className="widget-card widget-accent-blue widget-shine widget-tint-blue panel-body flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="icon-tile icon-tile-sm text-sky-300">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="micro-title">Data selezionata</div>
                    <div className="text-sm text-white">{format(selectedDate, 'd MMMM yyyy')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="micro-title">Sessioni</div>
                  <div className="text-lg font-semibold text-white">{selectedSessions.length}</div>
                </div>
              </div>
              <SessionDetail
                date={selectedDate}
                sessions={selectedSessions}
                onDelete={handleDeleteClick}
                loading={loading}
              />
            </>
          )}

          {!selectedDate && (
            <div className="widget-card widget-accent-blue widget-shine panel-body text-center transition-shadow duration-200 hover:shadow-md sm:px-8 sm:py-6">
              {loading ? (
                <LoadingSpinner message="Caricamento sessioni..." />
              ) : (
                <EmptyState
                  icon={<CalendarDays className="w-6 h-6 text-primary-300" />}
                  title="Seleziona un giorno nel calendario"
                  description="Qui vedrai tutte le sessioni dettagliate della data scelta."
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conferma Eliminazione */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="modal-shell p-5 sm:p-6 max-w-sm max-w-[95vw] max-h-[90vh] overflow-y-auto animate-pop">
            <div className="modal-header mb-4">
              <h3 className="text-lg font-bold text-white">Elimina Sessione</h3>
            </div>
            <p className="text-gray-300 mb-6">
              Sei sicuro? Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 min-h-[44px] btn-secondary"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 min-h-[44px] btn-danger"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
