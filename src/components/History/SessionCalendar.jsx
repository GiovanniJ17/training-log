import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

export default function SessionCalendar({
  currentMonth,
  selectedDate,
  sessionsByDate,
  onPrevMonth,
  onNextMonth,
  onDateClick,
  loading
}) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  // Calcola il primo giorno della settimana per allineamento griglia
  const startDate = new Date(monthStart)
  startDate.setDate(startDate.getDate() - monthStart.getDay())

  const calendarDays = []
  const current = new Date(startDate)
  while (current < monthEnd || current.getDay() !== 0) {
    calendarDays.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  const getTypeColor = (type) => {
    const colors = {
      pista: 'bg-blue-600/30 border-blue-500',
      palestra: 'bg-purple-600/30 border-purple-500',
      strada: 'bg-green-600/30 border-green-500',
      gara: 'bg-red-600/30 border-red-500',
      test: 'bg-yellow-600/30 border-yellow-500',
      scarico: 'bg-cyan-600/30 border-cyan-500',
      recupero: 'bg-teal-600/30 border-teal-500',
      altro: 'bg-gray-600/30 border-gray-500'
    }
    return colors[type] || 'bg-gray-600/30 border-gray-500'
  }

  return (
    <div className="widget-card widget-accent-emerald widget-shine-enhanced overflow-hidden card-hover-lift">
      {/* Enhanced Header */}
      <div className="relative bg-gradient-to-r from-emerald-600/20 via-teal-600/20 to-cyan-600/20 px-4 sm:px-6 py-4 border-b border-slate-700/50">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 animate-gradient-x" />
        <div className="relative flex items-center justify-between">
          <button onClick={onPrevMonth} className="btn-icon btn-ghost hover:scale-110 transition-transform">
            <ChevronLeft className="w-5 h-5 text-emerald-300" />
          </button>
          <div className="flex items-center gap-3">
            <div className="icon-tile icon-tile-sm bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border-emerald-500/40 text-emerald-300 shadow-lg">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </h2>
          </div>
          <button onClick={onNextMonth} className="btn-icon btn-ghost hover:scale-110 transition-transform">
            <ChevronRight className="w-5 h-5 text-emerald-300" />
          </button>
        </div>
      </div>

      {/* Giorni della settimana */}
      <div className="panel-body grid grid-cols-7 bg-slate-900/50 border-b border-slate-700">
        {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day) => (
          <div
            key={day}
            className="px-2 sm:px-3 py-2 text-center text-xs sm:text-sm font-semibold text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Griglia giorni */}
      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const daySessions = sessionsByDate[dateStr] || []
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isToday = isSameDay(day, new Date())
          const ringClass = isSelected
            ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900'
            : isToday
              ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
              : ''

          return (
            <button
              key={idx}
              onClick={() => onDateClick(day)}
              disabled={loading}
              className={`min-h-[56px] sm:aspect-square sm:min-h-0 p-2 border border-slate-800/80 flex flex-col items-start justify-start gap-1 text-xs transition-all duration-200 active:translate-y-px rounded-md hover:shadow-lg hover:shadow-slate-900/40 tap-ripple ${
                !isCurrentMonth ? 'bg-slate-900/30' : 'bg-slate-900 hover:bg-slate-800'
              } ${ringClass}`}
            >
              <span className={`font-bold ${isCurrentMonth ? 'text-white' : 'text-gray-500'}`}>
                {day.getDate()}
              </span>

              {/* Mini indicatori esercizi: solo pallini */}
              <div className="flex flex-wrap gap-0.5 w-full">
                {daySessions.slice(0, 4).map((session) => (
                  <div
                    key={session.id}
                    className={`w-1 h-1 rounded-full border ${getTypeColor(session.type)}`}
                    title={session.title || session.type}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
