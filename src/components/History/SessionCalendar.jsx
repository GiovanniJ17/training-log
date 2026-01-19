import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SessionCalendar({
  currentMonth,
  selectedDate,
  sessionsByDate,
  onPrevMonth,
  onNextMonth,
  onDateClick,
  loading,
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calcola il primo giorno della settimana per allineamento griglia
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - monthStart.getDay());

  const calendarDays = [];
  const current = new Date(startDate);
  while (current < monthEnd || current.getDay() !== 0) {
    calendarDays.push(new Date(current));
    current.setDate(current.getDate() + 1);
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
      altro: 'bg-gray-600/30 border-gray-500',
    };
    return colors[type] || 'bg-gray-600/30 border-gray-500';
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header mese */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-700">
        <button
          onClick={onPrevMonth}
          className="p-2 hover:bg-slate-700 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <h2 className="text-lg font-bold text-white">
          {format(currentMonth, 'MMMM yyyy', { locale: it })}
        </h2>
        <button
          onClick={onNextMonth}
          className="p-2 hover:bg-slate-700 rounded-lg transition"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Giorni della settimana */}
      <div className="grid grid-cols-7 bg-slate-900/50 border-b border-slate-700">
        {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
          <div key={day} className="px-3 py-2 text-center text-sm font-semibold text-gray-400">
            {day}
          </div>
        ))}
      </div>

      {/* Griglia giorni */}
      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const daySessions = sessionsByDate[dateStr] || [];
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const ringClass = isSelected
            ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900'
            : isToday
            ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
            : '';

          return (
            <button
              key={idx}
              onClick={() => onDateClick(day)}
              disabled={loading}
              className={`aspect-square p-2 border border-slate-700 flex flex-col items-start justify-start gap-0.5 text-xs transition-colors ${
                !isCurrentMonth ? 'bg-slate-900/30' : 'bg-slate-900 hover:bg-slate-800'
              } ${ringClass}`}
            >
              <span className={`font-bold ${isCurrentMonth ? 'text-white' : 'text-gray-500'}`}>
                {day.getDate()}
              </span>
              
              {/* Mini indicatori esercizi: solo pallini */}
              <div className="flex flex-wrap gap-0.5 w-full">
                {daySessions.slice(0, 4).map(session => (
                  <div
                    key={session.id}
                    className={`w-1 h-1 rounded-full border ${getTypeColor(session.type)}`}
                    title={session.title || session.type}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
