import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  addRaceRecord,
  addTrainingRecord,
  addStrengthRecord,
  addInjury,
} from '../services/athleteService';

export default function RecordModal({ sessionId, onClose, onSuccess }) {
  const [recordType, setRecordType] = useState('race'); // race, training, strength, injury
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let result;

      switch (recordType) {
        case 'race':
          result = await addRaceRecord(sessionId, {
            distance_m: parseInt(formData.distance_m),
            time_s: parseFloat(formData.time_s),
            rpe: formData.rpe ? parseInt(formData.rpe) : null,
            location: formData.location,
            competition_name: formData.competition_name,
            notes: formData.notes,
            is_personal_best: formData.is_personal_best || false,
          });
          break;

        case 'training':
          result = await addTrainingRecord(sessionId, {
            exercise_name: formData.exercise_name,
            exercise_type: formData.exercise_type,
            performance_value: parseFloat(formData.performance_value),
            performance_unit: formData.performance_unit,
            rpe: formData.rpe ? parseInt(formData.rpe) : null,
            notes: formData.notes,
            is_personal_best: formData.is_personal_best || false,
          });
          break;

        case 'strength':
          result = await addStrengthRecord(sessionId, {
            exercise_name: formData.exercise_name,
            category: formData.category,
            weight_kg: parseFloat(formData.weight_kg),
            reps: parseInt(formData.reps) || 1,
            notes: formData.notes,
            is_personal_best: formData.is_personal_best || false,
          });
          break;

        case 'injury':
          result = await addInjury({
            injury_type: formData.injury_type,
            body_part: formData.body_part,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            severity: formData.severity,
            cause_session_id: sessionId,
            notes: formData.notes,
          });
          break;

        default:
          throw new Error('Tipo record non valido');
      }

      if (result.success) {
        setMessage({ type: 'success', text: 'Record aggiunto con successo!' });
        setFormData({});
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            {recordType === 'race' && 'Aggiungi PB Gara'}
            {recordType === 'training' && 'Aggiungi PB Allenamento'}
            {recordType === 'strength' && 'Aggiungi Massimale'}
            {recordType === 'injury' && 'Registra Infortunio'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Selector Tipo Record */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo di Record
            </label>
            <select
              value={recordType}
              onChange={(e) => {
                setRecordType(e.target.value);
                setFormData({});
              }}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
            >
              <option value="race">PB Gara</option>
              <option value="training">PB Allenamento</option>
              <option value="strength">Massimale Forza</option>
              <option value="injury">Infortunio</option>
            </select>
          </div>

          {/* Race Records */}
          {recordType === 'race' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Distanza (m) *
                </label>
                <input
                  type="number"
                  name="distance_m"
                  value={formData.distance_m || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tempo (secondi) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="time_s"
                  value={formData.time_s || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="10.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Competizione
                </label>
                <input
                  type="text"
                  name="competition_name"
                  value={formData.competition_name || ''}
                  onChange={handleChange}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="Nome gara"
                />
              </div>
            </>
          )}

          {/* Training Records */}
          {recordType === 'training' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Esercizio *
                </label>
                <input
                  type="text"
                  name="exercise_name"
                  value={formData.exercise_name || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="Sprint 60m"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tipo *
                </label>
                <select
                  name="exercise_type"
                  value={formData.exercise_type || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                >
                  <option value="">Seleziona tipo</option>
                  <option value="sprint">Sprint</option>
                  <option value="jump">Salto</option>
                  <option value="throw">Lancio</option>
                  <option value="endurance">Resistenza</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Valore *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="performance_value"
                    value={formData.performance_value || ''}
                    onChange={handleChange}
                    required
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                    placeholder="10.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Unità *
                  </label>
                  <select
                    name="performance_unit"
                    value={formData.performance_unit || ''}
                    onChange={handleChange}
                    required
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  >
                    <option value="">Unità</option>
                    <option value="seconds">Secondi</option>
                    <option value="meters">Metri</option>
                    <option value="reps">Reps</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Strength Records */}
          {recordType === 'strength' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Esercizio *
                </label>
                <input
                  type="text"
                  name="exercise_name"
                  value={formData.exercise_name || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="Back Squat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Categoria *
                </label>
                <select
                  name="category"
                  value={formData.category || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                >
                  <option value="">Seleziona categoria</option>
                  <option value="squat">Squat</option>
                  <option value="bench">Bench Press</option>
                  <option value="deadlift">Deadlift</option>
                  <option value="clean">Clean</option>
                  <option value="jerk">Jerk</option>
                  <option value="press">Press</option>
                  <option value="pull">Pull</option>
                  <option value="other">Altro</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Peso (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    name="weight_kg"
                    value={formData.weight_kg || ''}
                    onChange={handleChange}
                    required
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Reps
                  </label>
                  <input
                    type="number"
                    name="reps"
                    value={formData.reps || '1'}
                    onChange={handleChange}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </>
          )}

          {/* Injury */}
          {recordType === 'injury' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tipo Infortunio *
                </label>
                <input
                  type="text"
                  name="injury_type"
                  value={formData.injury_type || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="Strappo muscolare"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Parte del corpo *
                </label>
                <input
                  type="text"
                  name="body_part"
                  value={formData.body_part || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                  placeholder="Spalla, Ginocchio..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Gravità *
                </label>
                <select
                  name="severity"
                  value={formData.severity || ''}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                >
                  <option value="">Seleziona gravità</option>
                  <option value="minor">Lieve</option>
                  <option value="moderate">Moderata</option>
                  <option value="severe">Grave</option>
                </select>
              </div>
            </>
          )}

          {/* Campi comuni */}
          {recordType !== 'injury' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                RPE (1-10)
              </label>
              <input
                type="number"
                name="rpe"
                min="1"
                max="10"
                value={formData.rpe || ''}
                onChange={handleChange}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
              />
            </div>
          )}

          {/* Checkbox PB */}
          {recordType !== 'injury' && (
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                name="is_personal_best"
                checked={formData.is_personal_best || false}
                onChange={handleChange}
                className="w-4 h-4 rounded"
              />
              <span>È un Personal Best?</span>
            </label>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Note
            </label>
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              rows="2"
              placeholder="Note aggiuntive..."
            />
          </div>

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-900/20 text-green-300'
                : 'bg-red-900/20 text-red-300'
            }`}>
              {message.text}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white py-2 rounded-lg transition-colors font-medium"
            >
              {loading ? 'Salvataggio...' : 'Salva Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
