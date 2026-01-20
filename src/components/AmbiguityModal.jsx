/**
 * AmbiguityModal - Human-in-the-loop for AI uncertainties
 * Mostra domande dall'AI quando c'è ambiguità nei dati
 */

import { useState } from 'react';

export default function AmbiguityModal({ questions, onResolve, onSkip }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  if (!questions || questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const handleAnswer = (value) => {
    const newAnswers = {
      ...answers,
      [currentQuestion.field]: value
    };
    setAnswers(newAnswers);

    if (isLast) {
      onResolve(newAnswers);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
            <span className="text-xl">🤔</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              L'AI ha un dubbio
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Domanda {currentIndex + 1} di {questions.length}
            </p>
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {currentQuestion.question}
          </p>

          {/* Options */}
          {currentQuestion.options ? (
            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(option)}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 
                           hover:border-blue-500 dark:hover:border-blue-400 
                           hover:bg-blue-50 dark:hover:bg-blue-900/20 
                           transition-colors"
                >
                  <span className="text-gray-900 dark:text-white font-medium">
                    {option}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              autoFocus
              placeholder="La tua risposta..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleAnswer(e.target.value.trim());
                }
              }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 
                     hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Salta tutte
          </button>
          {!currentQuestion.options && (
            <button
              onClick={() => setCurrentIndex(currentIndex + 1)}
              disabled={isLast}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLast ? 'Fine' : 'Prossima'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
