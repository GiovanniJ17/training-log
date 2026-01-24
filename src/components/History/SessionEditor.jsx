import { useState } from 'react'
import { X } from 'lucide-react'
import { updateTrainingSession } from '../../services/trainingService'
import { Card, CardBody, CardHeader } from '../ui/Card'
import SectionTitle from '../ui/SectionTitle'

export default function SessionEditor({ session, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: session.title || '',
    type: session.type || 'altro',
    location: session.location || '',
    rpe: session.rpe || '',
    feeling: session.feeling || '',
    notes: session.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const types = [
    { value: 'pista', label: 'Pista' },
    { value: 'palestra', label: 'Palestra' },
    { value: 'strada', label: 'Strada' },
    { value: 'gara', label: 'Gara' },
    { value: 'test', label: 'Test' },
    { value: 'scarico', label: 'Scarico' },
    { value: 'recupero', label: 'Recupero' },
    { value: 'altro', label: 'Altro' }
  ]

  const feelings = [
    { value: 'excellent', label: '😄 Ottimo' },
    { value: 'good', label: '🙂 Buono' },
    { value: 'neutral', label: '😐 Neutro' },
    { value: 'tired', label: '😴 Stanco' },
    { value: 'bad', label: '😞 Male' }
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await updateTrainingSession(session.id, formData)

    if (result.success) {
      setSaving(false)
      onSave()
    } else {
      setError(result.error)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="modal-shell max-w-2xl max-h-[90vh] overflow-y-auto animate-pop widget-shine">
        {/* Header */}
        <div className="modal-header sticky top-0">
          <SectionTitle title="Modifica Sessione" />
          <button onClick={onClose} className="btn-icon btn-ghost">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="panel-body bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <Card className="p-0 widget-card widget-accent-blue widget-shine">
            <CardHeader>
              <SectionTitle title="Dettagli sessione" />
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Titolo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Titolo Sessione
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="es. Allenamento velocità"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-all duration-200"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo Allenamento
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500 transition-all duration-200"
                >
                  {types.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Luogo</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  placeholder="es. Pista centrale"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-all duration-200"
                />
              </div>

              {/* RPE */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  RPE (Perceived Exertion) 0-10
                </label>
                <input
                  type="number"
                  name="rpe"
                  value={formData.rpe}
                  onChange={handleChange}
                  min="0"
                  max="10"
                  placeholder="0-10"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-all duration-200"
                />
              </div>

              {/* Feeling */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Come ti senti?
                </label>
                <select
                  name="feeling"
                  value={formData.feeling || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500 transition-all duration-200"
                >
                  <option value="">Seleziona...</option>
                  {feelings.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardBody>
          </Card>

          <Card className="p-0 widget-card widget-accent-emerald widget-shine">
            <CardHeader>
              <SectionTitle title="Note" />
            </CardHeader>
            <CardBody>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                placeholder="Aggiungi note sulla sessione..."
                rows="4"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-all duration-200 resize-none"
              />
            </CardBody>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-6 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 btn-secondary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 btn-primary"
            >
              {saving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
