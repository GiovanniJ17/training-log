/**
 * CoachAlerts Component
 * Visualizza alert proattivi dal coach AI
 */

import { useState, useEffect } from 'react';
import { generateProactiveAlerts } from '../services/proactiveCoach';

export default function CoachAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const generatedAlerts = await generateProactiveAlerts();
      setAlerts(generatedAlerts);
    } catch (error) {
      console.error('Error loading coach alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (alertType) => {
    setDismissedAlerts(prev => new Set([...prev, alertType]));
  };

  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.type));

  if (loading) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }

  if (visibleAlerts.length === 0) {
    return null; // Nessun alert da mostrare
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-700';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-700';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-700';
    }
  };

  return (
    <div className="space-y-3">
      {visibleAlerts.map((alert, index) => (
        <div
          key={index}
          className={`p-4 border-l-4 rounded-r-lg shadow-sm ${getSeverityColor(alert.severity)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Title */}
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                {alert.title}
              </h4>
              
              {/* Message */}
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {alert.message}
              </p>
              
              {/* Recommendation */}
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-sm">
                <p className="text-gray-600 dark:text-gray-400 italic">
                  💡 <strong>Consiglio:</strong> {alert.recommendation}
                </p>
              </div>
              
              {/* Data details (expandable) */}
              {alert.data && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 dark:text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                    Dettagli tecnici
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-800 text-gray-300 p-2 rounded overflow-x-auto">
                    {JSON.stringify(alert.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            
            {/* Dismiss button */}
            <button
              onClick={() => dismissAlert(alert.type)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="Nascondi alert"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
