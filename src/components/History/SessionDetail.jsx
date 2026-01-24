import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Trash2, MapPin, CalendarDays, Activity, Dumbbell, Footprints, Flag, Timer, Zap, Smile } from 'lucide-react'
import { Card, CardBody } from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import SectionTitle, { Subheader } from '../ui/SectionTitle'
import LoadingSpinner from '../LoadingSpinner'

export default function SessionDetail({ date, sessions, onDelete, loading }) {
  const getTypeColor = (type) => {
    const colors = {
      pista: 'bg-blue-500',
      palestra: 'bg-purple-500',
      strada: 'bg-green-500',
      gara: 'bg-red-500',
      test: 'bg-yellow-500',
      scarico: 'bg-cyan-500',
      recupero: 'bg-teal-500',
      altro: 'bg-gray-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  const typeLabels = {
    pista: 'Pista',
    palestra: 'Palestra',
    strada: 'Strada',
    gara: 'Gara',
    test: 'Test',
    scarico: 'Scarico',
    recupero: 'Recupero',
    altro: 'Altro'
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'pista':
        return { Icon: Zap, tint: 'text-sky-300' }
      case 'palestra':
        return { Icon: Dumbbell, tint: 'text-purple-300' }
      case 'strada':
        return { Icon: Footprints, tint: 'text-emerald-300' }
      case 'gara':
        return { Icon: Flag, tint: 'text-rose-300' }
      case 'test':
        return { Icon: Timer, tint: 'text-amber-300' }
      case 'scarico':
        return { Icon: Activity, tint: 'text-cyan-300' }
      case 'recupero':
        return { Icon: Activity, tint: 'text-teal-300' }
      default:
        return { Icon: Activity, tint: 'text-slate-300' }
    }
  }

  const buildDisplayTitle = (session) => {
    const firstNoteLine = session.notes?.split('\n')?.[0]?.trim()
    return firstNoteLine || ''
  }

  if (loading) {
    return (
      <Card className="text-center widget-card widget-accent-blue widget-shine">
        <CardBody className="py-8">
          <LoadingSpinner message="Caricamento..." />
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title={format(date, 'd MMMM yyyy', { locale: it })}
        icon={<CalendarDays className="w-5 h-5" />}
        className="mb-2"
      />

      {sessions.length === 0 ? (
        <Card className="text-center widget-card widget-accent-blue widget-shine">
          <CardBody className="py-8">
            <EmptyState
              icon={<CalendarDays className="w-6 h-6 text-primary-300" />}
              title="Nessuna sessione registrata per questo giorno"
              description="Prova a selezionare un'altra data o aggiungere un allenamento."
            />
          </CardBody>
        </Card>
      ) : (
        sessions.map((session) => (
          <Card key={session.id} className="p-0 widget-card widget-accent-emerald widget-shine tap-ripple animate-float-in">
            {/* Header Sessione */}
            <div className="panel-body flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                {(() => {
                  const { Icon, tint } = getTypeIcon(session.type)
                  return (
                    <div className={`icon-tile icon-tile-sm ${tint}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  )
                })()}
                <div
                  className={`${getTypeColor(session.type)} px-3 py-1 rounded-full text-white text-sm font-medium`}
                >
                  {typeLabels[session.type] || session.type}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">{buildDisplayTitle(session)}</h4>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onDelete(session.id)}
                  className="btn-icon btn-ghost text-red-400 hover:text-red-300"
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metadata */}
            <div className="panel-body grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-700">
              {session.rpe !== null && (
                <div className="glass-panel p-3 flex items-center gap-3">
                  <div className="icon-tile icon-tile-sm text-emerald-300">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">RPE</p>
                    <p className="text-lg font-bold text-white">{session.rpe}/10</p>
                  </div>
                </div>
              )}
              {session.location && (
                <div className="glass-panel p-3 flex items-start gap-2">
                  <div className="icon-tile icon-tile-sm text-sky-300">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Luogo</p>
                    <p className="text-sm text-white">{session.location}</p>
                  </div>
                </div>
              )}
              {session.feeling && (
                <div className="glass-panel p-3 flex items-center gap-3">
                  <div className="icon-tile icon-tile-sm text-amber-300">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Condizione</p>
                    <p className="text-sm text-white">{session.feeling}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Note */}
            {session.notes && (
              <div className="panel-body">
                <div className="flex items-center gap-2 mb-2">
                  <div className="icon-tile icon-tile-sm text-slate-300">
                    <Activity className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-gray-500 uppercase">Note</p>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{session.notes}</p>
              </div>
            )}

            {/* Gruppi ed esercizi */}
            {session.groups && session.groups.length > 0 ? (
              <div className="panel-body card-grid-2">
                {session.groups.map((group) => (
                  <div
                    key={group.id}
                    className="glass-panel p-4 transition-all duration-200 hover:border-slate-600"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="icon-tile icon-tile-sm text-sky-300">
                          <Dumbbell className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-semibold text-white">{group.name || 'Gruppo'}</p>
                      </div>
                      {group.notes && <p className="text-xs text-gray-400">{group.notes}</p>}
                    </div>
                    {group.sets && group.sets.length > 0 ? (
                      <div className="space-y-2">
                        {group.sets.map((set) => (
                          <div
                            key={set.id}
                            className="flex flex-wrap items-center gap-3 text-sm text-gray-200"
                          >
                            <span className="font-semibold">{set.exercise_name}</span>
                            {set.sets && <span className="text-gray-400">{set.sets}x</span>}
                            {set.reps && <span className="text-gray-400">{set.reps} rep</span>}
                            {set.weight_kg && (
                              <span className="text-gray-400">{set.weight_kg} kg</span>
                            )}
                            {set.distance_m && (
                              <span className="text-gray-400">{set.distance_m} m</span>
                            )}
                            {set.time_s && <span className="text-gray-400">{set.time_s}s</span>}
                            {set.recovery_s && (
                              <span className="text-gray-500">rec {set.recovery_s}s</span>
                            )}
                            {set.notes && <span className="text-gray-300">• {set.notes}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Nessun esercizio registrato.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-body text-xs text-gray-500">
                Esercizi non ancora caricati nel dettaglio
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
