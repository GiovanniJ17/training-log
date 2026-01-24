/**
 * AmbiguityModal - Human-in-the-loop for AI uncertainties
 * Mostra domande dall'AI quando c'è ambiguità nei dati
 */

import { useState } from 'react'

export default function AmbiguityModal({ questions, onResolve, onSkip }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})

  if (!questions || questions.length === 0) return null

  const currentQuestion = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1

  const handleAnswer = (value) => {
    const newAnswers = {
      ...answers,
      [currentQuestion.field]: value
    }
    setAnswers(newAnswers)

    if (isLast) {
      onResolve(newAnswers)
    } else {
      setCurrentIndex(currentIndex + 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="modal-shell max-w-md p-6">
        {/* Header */}
        <div className="modal-header mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-900/40 flex items-center justify-center">
            <span className="text-xl">🤔</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">L'AI ha un dubbio</h3>
            <p className="text-sm text-gray-400">
              Domanda {currentIndex + 1} di {questions.length}
            </p>
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-gray-300 mb-4">{currentQuestion.question}</p>

          {/* Options */}
          {currentQuestion.options ? (
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => {
                // Gestisce sia il vecchio formato (stringhe) che il nuovo (oggetti {label, value})
                const label = typeof option === 'object' ? option.label : option
                const value = typeof option === 'object' ? option.value : option

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(value)} // Passa il VALUE, non la label
                    className="w-full text-left px-4 py-3 rounded-lg border-2 border-slate-700 
                             hover:border-primary-500 hover:bg-slate-700/40 
                             transition-colors"
                  >
                    <span className="text-white font-medium">{label}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <input
              type="text"
              autoFocus
              placeholder="La tua risposta..."
              className="w-full px-4 py-2 border border-slate-600 rounded-lg 
                       bg-slate-700 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleAnswer(e.target.value.trim())
                }
              }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onSkip} className="flex-1 px-4 py-2 btn-ghost link-muted">
            Salta tutte
          </button>
          {!currentQuestion.options && (
            <button
              onClick={() => setCurrentIndex(currentIndex + 1)}
              disabled={isLast}
              className="flex-1 px-4 py-2 btn-primary"
            >
              {isLast ? 'Fine' : 'Prossima'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
