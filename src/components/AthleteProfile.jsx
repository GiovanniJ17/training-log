import { useState, useEffect } from 'react';
import { User, Trophy, AlertCircle, Zap, Target, CheckCircle, X } from 'lucide-react';
import {
  getAthleteProfile,
  updateAthleteProfile,
  getRaceRecords,
  getTrainingRecords,
  getStrengthRecords,
  getInjuryHistory,
  getPersonalBests,
  resolveInjury,
} from '../services/athleteService';

export default function AthleteProfile() {
  const [profile, setProfile] = useState(null);
  const [personalBests, setPersonalBests] = useState(null);
  const [injuries, setInjuries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [selectedInjury, setSelectedInjury] = useState(null);
  const [endDate, setEndDate] = useState('');
  const [showOnlyActiveInjuries, setShowOnlyActiveInjuries] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);
    const [profileRes, pbsRes, injuriesRes] = await Promise.all([
      getAthleteProfile(),
      getPersonalBests(),
      getInjuryHistory(),
    ]);

    if (profileRes.success) setProfile(profileRes.data);
    if (pbsRes.success) {
      setPersonalBests(pbsRes.data);
      // Debug: Verifica la struttura dei record
      console.log('[AthleteProfile] PersonalBests caricati:', pbsRes.data);
      if (pbsRes.data?.raceRecords?.length > 0) {
        console.log('[AthleteProfile] Primo race record:', pbsRes.data.raceRecords[0]);
      }
    }
    if (injuriesRes.success) setInjuries(injuriesRes.data);
    setLoading(false);
  };

  const calculateAge = (birthDate) => {
    const today = new Date();
    let age = today.getFullYear() - new Date(birthDate).getFullYear();
    const monthDiff = today.getMonth() - new Date(birthDate).getMonth();
    if (monthDiff < 0) age--;
    return age;
  };

  const calculateBMI = (weight, height) => {
    if (!height) return null;
    return (weight / ((height / 100) ** 2)).toFixed(1);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  const isNewRecord = (record) => {
    // training_sessions è un ARRAY dovuto alla JOIN, accedi al primo elemento
    const recordDate = record?.training_sessions?.[0]?.date || record?.start_date;
    if (!recordDate) {
      console.log('[isNewRecord] No date found for record:', record);
      return false;
    }
    const daysSince = Math.floor((new Date() - new Date(recordDate)) / (1000 * 60 * 60 * 24));
    const isNew = daysSince <= 7;
    console.log(`[isNewRecord] Record ${record.distance_m || record.exercise_name}m date: ${recordDate}, daysSince: ${daysSince}, isNew: ${isNew}`);
    return isNew;
  };

  const handleResolveInjury = async () => {
    if (!selectedInjury || !endDate) return;
    
    setLoading(true);
    const result = await resolveInjury(selectedInjury.id, endDate);
    
    if (result.success) {
      await loadProfileData();
      setShowInjuryModal(false);
      setSelectedInjury(null);
      setEndDate('');
    }
    setLoading(false);
  };

  const handleEditProfile = () => {
    setEditWeight(profile.current_weight_kg.toString());
    setEditHeight((profile.height_cm || '').toString());
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editWeight || !editHeight) {
      alert('Compila tutti i campi');
      return;
    }

    setLoading(true);
    const result = await updateAthleteProfile({
      current_weight_kg: parseFloat(editWeight),
      height_cm: parseInt(editHeight),
    });

    if (result.success) {
      await loadProfileData();
      setShowEditProfile(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Caricamento profilo...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-red-400">
          Errore nel caricamento del profilo
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header Profilo */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-8">
        <div className="flex items-start justify-between">
          <div className="flex gap-6 flex-1">
            <div className="w-32 h-32 bg-primary-600 rounded-lg flex items-center justify-center">
              <User className="w-16 h-16 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">{profile.name}</h1>
              <p className="text-primary-300 text-lg mb-4">{profile.sport_specialization}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Data Nascita</span>
                  <p className="text-white font-medium">
                    {new Date(profile.birth_date).toLocaleDateString('it-IT')}
                    {' '}
                    <span className="text-gray-400">({calculateAge(profile.birth_date)} anni)</span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Peso</span>
                  <p className="text-white font-medium">{profile.current_weight_kg} kg</p>
                </div>
                {profile.height_cm && (
                  <>
                    <div>
                      <span className="text-gray-400">Altezza</span>
                      <p className="text-white font-medium">{profile.height_cm} cm</p>
                    </div>
                    <div>
                      <span className="text-gray-400">BMI</span>
                      <p className="text-white font-medium">{calculateBMI(profile.current_weight_kg, profile.height_cm)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleEditProfile}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Modifica
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {[
          { id: 'overview', label: 'Overview', icon: Trophy },
          { id: 'race-pbs', label: 'PB Gara', icon: Target },
          { id: 'training-pbs', label: 'PB Allenamento', icon: Zap },
          { id: 'strength-pbs', label: 'Massimali', icon: AlertCircle },
          { id: 'injuries', label: 'Infortuni', icon: AlertCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenuto Tab */}
      <div>
        {/* Overview */}
        {activeTab === 'overview' && personalBests && (
          <div className="space-y-6">
            {/* Best Races - Show all unique distances */}
            {personalBests.raceRecords.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary-400" />
                  Migliori Performance Gara
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {personalBests.raceRecords
                    .reduce((acc, record) => {
                      const existing = acc.find(r => r.distance_m === record.distance_m);
                      if (!existing || record.time_s < existing.time_s) {
                        return [...acc.filter(r => r.distance_m !== record.distance_m), record];
                      }
                      return acc;
                    }, [])
                    .sort((a, b) => a.distance_m - b.distance_m)
                    .map(record => (
                      <div key={record.distance_m} className="bg-slate-800 rounded-xl p-6">
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-400">Distanza</p>
                            <p className="text-xl font-bold text-white">{record.distance_m}m</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Tempo</p>
                            <p className="text-2xl font-bold text-primary-400">{formatTime(record.time_s)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Best Training Record */}
            {personalBests.trainingRecords.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary-400" />
                  Migliori Performance Allenamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {personalBests.trainingRecords.slice(0, 3).map(record => (
                    <div key={record.id} className="bg-slate-800 rounded-xl p-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-400">Esercizio</p>
                          <p className="text-xl font-bold text-white">{record.exercise_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Performance</p>
                          <p className="text-2xl font-bold text-primary-400">
                            {record.performance_value} {record.performance_unit}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best Strength */}
            {personalBests.strengthRecords.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary-400" />
                  Massimali Forza
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {personalBests.strengthRecords
                    .reduce((acc, record) => {
                      const existing = acc.find(r => r.category === record.category);
                      if (!existing || record.weight_kg > existing.weight_kg) {
                        return [...acc.filter(r => r.category !== record.category), record];
                      }
                      return acc;
                    }, [])
                    .sort((a, b) => b.weight_kg - a.weight_kg)
                    .map(record => (
                      <div key={record.id} className="bg-slate-800 rounded-xl p-6">
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-400">Esercizio</p>
                            <p className="text-xl font-bold text-white">{record.exercise_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Peso</p>
                            <p className="text-2xl font-bold text-primary-400">{record.weight_kg} kg</p>
                          </div>
                        </div>
                      </div>
                    ))}\n                </div>
              </div>
            )}
          </div>
        )}

        {/* Race PBs */}
        {activeTab === 'race-pbs' && personalBests && (
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Record Personali - Gara</h3>
            </div>
            <div className="divide-y divide-slate-700">
              {personalBests.raceRecords.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nessun record personale</div>
              ) : (
                personalBests.raceRecords.map((record) => (
                  <div key={record.id} className="p-6 hover:bg-slate-700/50 transition-colors">
                    <div className="grid grid-cols-4 gap-4 items-start">
                      <div>
                        <p className="text-sm text-gray-400">Distanza</p>
                        <p className="text-lg font-bold text-white">{record.distance_m}m</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Tempo</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-primary-400">{formatTime(record.time_s)}</p>
                          {isNewRecord(record) && (
                            <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">NUOVO</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">RPE</p>
                        <p className="text-lg font-bold text-white">{record.rpe || '-'}</p>
                      </div>
                    </div>
                    {record.competition_name && (
                      <p className="text-sm text-gray-400 mt-2">{record.competition_name}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Training PBs */}
        {activeTab === 'training-pbs' && personalBests && (
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Record Personali - Allenamento</h3>
            </div>
            <div className="divide-y divide-slate-700">
              {personalBests.trainingRecords.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nessun record personale</div>
              ) : (
                personalBests.trainingRecords.map((record) => (
                  <div key={record.id} className="p-6 hover:bg-slate-700/50 transition-colors">                    {isNewRecord(record) && (
                      <div className="mb-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-primary-600 text-white font-medium">
                          NUOVO
                        </span>
                      </div>
                    )}                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Esercizio</p>
                        <p className="text-lg font-bold text-white">{record.exercise_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Tipo</p>
                        <p className="text-lg font-bold text-primary-400 capitalize">{record.exercise_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Performance</p>
                        <p className="text-lg font-bold text-white">
                          {record.performance_value} {record.performance_unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">RPE</p>
                        <p className="text-lg font-bold text-white">{record.rpe || '-'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Strength Records */}
        {activeTab === 'strength-pbs' && personalBests && (
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Massimali di Forza</h3>
            </div>
            <div className="divide-y divide-slate-700">
              {personalBests.strengthRecords.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nessun massimale registrato</div>
              ) : (
                personalBests.strengthRecords.map((record) => (
                  <div key={record.id} className="p-6 hover:bg-slate-700/50 transition-colors">
                    <div className="grid grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Esercizio</p>
                        <p className="text-lg font-bold text-white">{record.exercise_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Categoria</p>
                        <p className="text-lg font-bold text-primary-400 capitalize">{record.category}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Peso</p>
                        <p className="text-lg font-bold text-white">{record.weight_kg} kg</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Reps</p>
                        <p className="text-lg font-bold text-white">{record.reps}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">% BW</p>
                        <p className="text-lg font-bold text-primary-400">
                          {record.percentage_of_bodyweight}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Injuries */}
        {activeTab === 'injuries' && (
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Storico Infortuni</h3>
              <button
                onClick={() => setShowOnlyActiveInjuries(!showOnlyActiveInjuries)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showOnlyActiveInjuries
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {showOnlyActiveInjuries ? 'Mostra tutti' : 'Solo attivi'}
              </button>
            </div>
            <div className="divide-y divide-slate-700">
              {injuries.length === 0 ? (
                <div className="p-6 text-center text-gray-400">Nessun infortunio registrato</div>
              ) : (
                injuries
                  .filter(injury => !showOnlyActiveInjuries || !injury.end_date)
                  .map((injury) => (
                  <div key={injury.id} className="p-6 hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">{injury.injury_type}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            injury.severity === 'severe' ? 'bg-red-900 text-red-200' :
                            injury.severity === 'moderate' ? 'bg-yellow-900 text-yellow-200' :
                            'bg-green-900 text-green-200'
                          }`}>
                            {injury.severity}
                          </span>
                          {!injury.end_date && (
                            <span className="text-xs px-2 py-1 rounded-full bg-red-900 text-red-200 font-medium">
                              In corso
                            </span>
                          )}
                          {isNewRecord(injury) && (
                            <span className="text-xs px-2 py-1 rounded-full bg-primary-600 text-white font-medium">
                              NUOVO
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">Parte interessata: {injury.body_part}</p>
                      </div>
                      {!injury.end_date && (
                        <button
                          onClick={() => {
                            setSelectedInjury(injury);
                            setEndDate(new Date().toISOString().split('T')[0]);
                            setShowInjuryModal(true);
                          }}
                          className="ml-4 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Segna come guarito
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Data Inizio</p>
                        <p className="text-white font-medium">
                          {new Date(injury.start_date).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Data Fine</p>
                        <p className="text-white font-medium">
                          {injury.end_date ? new Date(injury.end_date).toLocaleDateString('it-IT') : 'Ancora presente'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Durata</p>
                        <p className="text-white font-medium">
                          {injury.end_date
                            ? Math.floor((new Date(injury.end_date) - new Date(injury.start_date)) / (1000 * 60 * 60 * 24)) + ' giorni'
                            : Math.floor((new Date() - new Date(injury.start_date)) / (1000 * 60 * 60 * 24)) + ' giorni'}
                        </p>
                      </div>
                    </div>
                    {injury.notes && (
                      <p className="text-sm text-gray-300 mt-3">{injury.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modale chiusura infortunio */}
      {showInjuryModal && selectedInjury && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Chiudi Infortunio</h3>
              <button
                onClick={() => {
                  setShowInjuryModal(false);
                  setSelectedInjury(null);
                  setEndDate('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                <strong>{selectedInjury.injury_type}</strong> - {selectedInjury.body_part}
              </p>
              <p className="text-sm text-gray-400">
                Iniziato il: {new Date(selectedInjury.start_date).toLocaleDateString('it-IT')}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Data di guarigione
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResolveInjury}
                disabled={!endDate || loading}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                Conferma
              </button>
              <button
                onClick={() => {
                  setShowInjuryModal(false);
                  setSelectedInjury(null);
                  setEndDate('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Profilo */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-sm w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Modifica Profilo</h3>
              <button
                onClick={() => setShowEditProfile(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="65"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Altezza (cm)
                </label>
                <input
                  type="number"
                  step="1"
                  value={editHeight}
                  onChange={(e) => setEditHeight(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="173"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                Salva
              </button>
              <button
                onClick={() => setShowEditProfile(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
