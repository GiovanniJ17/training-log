/**
 * CoachAlerts Component
 * Visualizza alert proattivi dal coach AI
 */

import { useState, useEffect, useCallback } from 'react'
import { generateProactiveAlerts } from '../services/proactiveCoach'
import LoadingSpinner from './LoadingSpinner'

// Se vengono passati alerts/ loading dal parent non viene fatta la fetch interna
export default function CoachAlerts({ alerts: externalAlerts, loading: externalLoading = false }) {
  const controlled = externalAlerts !== undefined
  const [alerts, setAlerts] = useState(externalAlerts || [])
  const [loading, setLoading] = useState(controlled ? externalLoading : true)
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set())

  const loadAlerts = useCallback(async () => {
    if (controlled) return
    setLoading(true)
    try {
      const generatedAlerts = await generateProactiveAlerts()
      setAlerts(generatedAlerts)
    } catch (error) {
      console.error('Error loading coach alerts:', error)
    } finally {
      setLoading(false)
    }
  }, [controlled])

  useEffect(() => {
    if (controlled) {
      setAlerts(externalAlerts || [])
      setLoading(externalLoading)
      return
    }

    loadAlerts()
  }, [controlled, externalAlerts, externalLoading, loadAlerts])

  const dismissAlert = (alertType) => {
    setDismissedAlerts((prev) => new Set([...prev, alertType]))
  }

  const visibleAlerts = alerts.filter((alert) => !dismissedAlerts.has(alert.type))

  if (loading) {
    return (
      <LoadingSpinner message="Caricamento alert coach..." />
    )
  }

  if (visibleAlerts.length === 0) {
    return null // Nessun alert da mostrare
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-900/20 border-red-500/70'
      case 'medium':
        return 'bg-amber-900/20 border-amber-500/70'
      default:
        return 'bg-sky-900/20 border-sky-500/70'
    }
  }

  return (
    <div className="space-y-3">
      {visibleAlerts.map((alert, index) => (
        <div
          key={index}
          className={`widget-card widget-shine panel-body border-l-4 rounded-r-lg transition-shadow duration-200 hover:shadow-md ${getSeverityColor(
            alert.severity
          )}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Title */}
              <h4 className="font-semibold text-white mb-1">{alert.title}</h4>

              {/* Message */}
              <p className="text-sm text-gray-300 mb-2">{alert.message}</p>

              {/* Recommendation */}
              <div className="glass-panel p-3 rounded-lg text-sm">
                <p className="text-gray-300 italic">
                  💡 <strong>Consiglio:</strong> {alert.recommendation}
                </p>
              </div>

              {/* Data details (expandable) */}
              {alert.data && (
                <details className="mt-2">
                  <summary className="summary-muted active:translate-y-px">
                    Dettagli tecnici
                  </summary>
                  <pre className="mt-2 text-xs bg-slate-900/80 text-gray-300 p-2 rounded overflow-x-auto">
                    {JSON.stringify(alert.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => dismissAlert(alert.type)}
              className="btn-icon btn-ghost link-muted"
              title="Nascondi alert"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
