import { useState, useEffect, useCallback } from 'react'
import {
  User,
  Trophy,
  AlertCircle,
  Zap,
  Target,
  CheckCircle,
  X,
  CalendarDays,
  Ruler,
  Scale,
  Activity
} from 'lucide-react'
import EmptyState from './ui/EmptyState'
import { Card } from './ui/Card'
import SectionTitle from './ui/SectionTitle'
import LoadingSpinner from './LoadingSpinner'
import {
  getAthleteProfile,
  updateAthleteProfile,
  getInjuryHistory,
  getPersonalBests,
  resolveInjury
} from '../services/athleteService'

export default function AthleteProfile() {
  const [profile, setProfile] = useState(null)
  const [personalBests, setPersonalBests] = useState(null)
  const [injuries, setInjuries] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showInjuryModal, setShowInjuryModal] = useState(false)
  const [selectedInjury, setSelectedInjury] = useState(null)
  const [endDate, setEndDate] = useState('')
  const [showOnlyActiveInjuries, setShowOnlyActiveInjuries] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editHeight, setEditHeight] = useState('')

  const loadProfileData = useCallback(async () => {
    setLoading(true)
    const [profileRes, pbsRes, injuriesRes] = await Promise.all([
      getAthleteProfile(),
      getPersonalBests(),
      getInjuryHistory()
    ])

    if (profileRes.success) setProfile(profileRes.data)
    if (pbsRes.success) {
      setPersonalBests(pbsRes.data)
      // Debug: Verifica la struttura dei record
      // PersonalBests caricati
      if (pbsRes.data?.raceRecords?.length > 0) {
        // Primo race record verificato
      }
    }
    if (injuriesRes.success) setInjuries(injuriesRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProfileData()
  }, [loadProfileData])

  const calculateAge = (birthDate) => {
    const today = new Date()
    let age = today.getFullYear() - new Date(birthDate).getFullYear()
    const monthDiff = today.getMonth() - new Date(birthDate).getMonth()
    if (monthDiff < 0) age--
    return age
  }

  const calculateBMI = (weight, height) => {
    if (!height) return null
    return (weight / (height / 100) ** 2).toFixed(1)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(2)
    return `${mins}:${secs.padStart(5, '0')}`
  }

  const isNewRecord = (record) => {
    // training_sessions è un ARRAY dovuto alla JOIN, accedi al primo elemento
    const recordDate = record?.training_sessions?.[0]?.date || record?.start_date
    if (!recordDate) {
      // No date found for record
      return false
    }
    const daysSince = Math.floor((new Date() - new Date(recordDate)) / (1000 * 60 * 60 * 24))
    const isNew = daysSince <= 7
    // Record verificato
    return isNew
  }

  const handleResolveInjury = async () => {
    if (!selectedInjury || !endDate) return

    setLoading(true)
    const result = await resolveInjury(selectedInjury.id, endDate)

    if (result.success) {
      await loadProfileData()
      setShowInjuryModal(false)
      setSelectedInjury(null)
      setEndDate('')
    }
    setLoading(false)
  }

  const handleEditProfile = () => {
    setEditName(profile?.name || '')
    setEditBirthDate(profile?.birth_date || '')
    setEditWeight(profile?.current_weight_kg != null ? profile.current_weight_kg.toString() : '')
    setEditHeight(profile?.height_cm != null ? profile.height_cm.toString() : '')
    setShowEditProfile(true)
  }

  const handleSaveProfile = async () => {
    if (!editName || !editBirthDate || !editWeight || !editHeight) {
      alert('Compila tutti i campi')
      return
    }

    setLoading(true)
    const result = await updateAthleteProfile({
      name: editName,
      birth_date: editBirthDate,
      current_weight_kg: parseFloat(editWeight),
      height_cm: parseInt(editHeight)
    })

    if (result.success) {
      await loadProfileData()
      setShowEditProfile(false)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Caricamento profilo..." />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-pop">
      <div className="glass-card widget-card widget-accent-blue widget-shine panel-body text-gray-200 text-center transition-shadow duration-200 hover:shadow-md">
          <EmptyState
            icon={<User className="w-6 h-6 text-primary-300" />}
            title="Profilo non ancora creato"
            description="Compila i dati atleta per vedere statistiche e PB personali."
          />
        </div>
        <button onClick={handleEditProfile} className="px-4 py-2 min-h-[44px] btn-primary">
          Crea profilo
        </button>
        {showEditProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="modal-shell p-5 sm:p-8 max-w-sm max-w-[95vw] max-h-[90vh] overflow-y-auto">
              <div className="modal-header mb-6">
                <SectionTitle title="Modifica Profilo" />
                <button onClick={() => setShowEditProfile(false)} className="btn-icon btn-ghost">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Mario Rossi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Data di Nascita
                  </label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="173"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="flex-1 px-4 py-2 min-h-[44px] btn-primary"
                >
                  Salva
                </button>
                <button
                  onClick={() => setShowEditProfile(false)}
                  className="px-4 py-2 min-h-[44px] btn-secondary"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell py-2 sm:py-4 space-y-6 sm:space-y-8 animate-pop">
      {/* Glassmorphism Header Profilo */}
      <div className="glass-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 flex-1">
            <div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-3xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                {profile.name}
              </h1>
              <p className="text-slate-300 text-base sm:text-lg lg:text-xl font-medium mb-6">
                {profile.sport_specialization}
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="glass-panel p-4 flex items-center gap-3 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-sky-300" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Data Nascita</div>
                    <p className="text-white font-semibold text-sm">
                      {profile.birth_date
                        ? new Date(profile.birth_date).toLocaleDateString('it-IT')
                        : '-'}
                      {profile.birth_date && (
                        <span className="text-slate-400 ml-1 text-xs">
                          ({calculateAge(profile.birth_date)} anni)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="glass-panel p-4 flex items-center gap-3 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Scale className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Peso</div>
                    <p className="text-white font-semibold text-sm">
                      {profile.current_weight_kg != null ? `${profile.current_weight_kg} kg` : '-'}
                    </p>
                  </div>
                </div>
                <div className="glass-panel p-4 flex items-center gap-3 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Altezza</div>
                    <p className="text-white font-semibold text-sm">
                      {profile.height_cm ? `${profile.height_cm} cm` : '-'}
                    </p>
                  </div>
                </div>
                <div className="glass-panel p-4 flex items-center gap-3 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-rose-300" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider">BMI</div>
                    <p className="text-white font-semibold text-sm">
                      {profile.height_cm
                        ? calculateBMI(profile.current_weight_kg, profile.height_cm)
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button onClick={handleEditProfile} className="px-4 py-2 min-h-[44px] btn-primary">
            Modifica
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="widget-card widget-accent-blue widget-shine p-2 sm:p-3">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Trophy },
            { id: 'race-pbs', label: 'PB Gara', icon: Target },
            { id: 'training-pbs', label: 'PB Allenamento', icon: Zap },
            { id: 'strength-pbs', label: 'Massimali', icon: AlertCircle },
            { id: 'injuries', label: 'Infortuni', icon: AlertCircle }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-pill min-h-[44px] whitespace-nowrap ${
                  activeTab === tab.id ? 'tab-pill-active' : ''
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenuto Tab */}
      <div>
        {/* Overview */}
        {activeTab === 'overview' && personalBests && (
          <div className="space-y-6">
            {/* Best Races - Show all unique distances */}
            {personalBests.raceRecords.length > 0 && (
              <div>
                <SectionTitle
                  title="Migliori Performance Gara"
                  icon={<Target className="w-5 h-5 text-primary-400" />}
                  className="mb-4"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalBests.raceRecords
                    .reduce((acc, record) => {
                      const existing = acc.find((r) => r.distance_m === record.distance_m)
                      if (!existing || record.time_s < existing.time_s) {
                        return [...acc.filter((r) => r.distance_m !== record.distance_m), record]
                      }
                      return acc
                    }, [])
                    .sort((a, b) => a.distance_m - b.distance_m)
                    .map((record) => (
                      <Card
                        key={record.distance_m}
                        className="p-4 sm:p-6 widget-card widget-accent-blue widget-shine"
                      >
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-400">Distanza</p>
                            <p className="text-lg sm:text-xl font-bold text-white">
                              {record.distance_m}m
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Tempo</p>
                            <p className="text-xl sm:text-2xl font-bold text-primary-400">
                              {formatTime(record.time_s)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Best Training Record */}
            {personalBests.trainingRecords.length > 0 && (
              <div>
                <SectionTitle
                  title="Migliori Performance Allenamento"
                  icon={<Zap className="w-5 h-5 text-primary-400" />}
                  className="mb-4"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalBests.trainingRecords.slice(0, 3).map((record) => (
                    <Card
                      key={record.id}
                      className="p-4 sm:p-6 widget-card widget-accent-emerald widget-shine"
                    >
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-400">Esercizio</p>
                          <p className="text-lg sm:text-xl font-bold text-white">
                            {record.exercise_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Performance</p>
                          <p className="text-xl sm:text-2xl font-bold text-primary-400">
                            {record.performance_value} {record.performance_unit}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Best Strength */}
            {personalBests.strengthRecords.length > 0 && (
              <div>
                <SectionTitle
                  title="Massimali Forza"
                  icon={<AlertCircle className="w-5 h-5 text-primary-400" />}
                  className="mb-4"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalBests.strengthRecords
                    .reduce((acc, record) => {
                      const existing = acc.find((r) => r.category === record.category)
                      if (!existing || record.weight_kg > existing.weight_kg) {
                        return [...acc.filter((r) => r.category !== record.category), record]
                      }
                      return acc
                    }, [])
                    .sort((a, b) => b.weight_kg - a.weight_kg)
                    .map((record) => (
                      <Card
                        key={record.id}
                        className="p-4 sm:p-6 widget-card widget-accent-amber widget-shine"
                      >
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-400">Esercizio</p>
                            <p className="text-lg sm:text-xl font-bold text-white">
                              {record.exercise_name}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Peso</p>
                            <p className="text-xl sm:text-2xl font-bold text-primary-400">
                              {record.weight_kg} kg
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Race PBs */}
        {activeTab === 'race-pbs' && personalBests && (
          <div className="glass-card widget-card widget-accent-blue widget-shine overflow-hidden transition-shadow duration-200 hover:shadow-md">
            <div className="panel-header">
              <SectionTitle title="Record Personali - Gara" />
            </div>
            <div className="panel-body">
              {personalBests.raceRecords.length === 0 ? (
                <div className="panel-body text-center text-gray-400 transition-shadow duration-200 hover:shadow-md">
                  Nessun record personale
                </div>
              ) : (
                <div className="card-grid-2">
                  {personalBests.raceRecords.map((record) => (
                    <div key={record.id} className="tile tile-accent-blue tap-ripple">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="icon-tile icon-tile-sm text-sky-300">
                            <Target className="w-4 h-4" />
                          </div>
                          <span className="micro-title">{record.distance_m}m</span>
                        </div>
                        {isNewRecord(record) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/80 text-white font-semibold">
                            NUOVO
                          </span>
                        )}
                      </div>
                      <div className="card-stack text-sm text-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Tempo</span>
                          <span className="font-semibold text-primary-300">
                            {formatTime(record.time_s)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">RPE</span>
                          <span className="font-semibold">{record.rpe || '-'}</span>
                        </div>
                        {record.competition_name && (
                          <div className="text-xs text-slate-400">{record.competition_name}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Training PBs */}
        {activeTab === 'training-pbs' && personalBests && (
          <div className="glass-card widget-card widget-accent-emerald widget-shine overflow-hidden transition-shadow duration-200 hover:shadow-md">
            <div className="panel-header">
              <SectionTitle title="Record Personali - Allenamento" />
            </div>
            <div className="panel-body">
              {personalBests.trainingRecords.length === 0 ? (
                <div className="panel-body text-center text-gray-400 transition-shadow duration-200 hover:shadow-md">
                  Nessun record personale
                </div>
              ) : (
                <div className="card-grid-2">
                  {personalBests.trainingRecords.map((record) => (
                    <div key={record.id} className="tile tile-accent-emerald tap-ripple">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="icon-tile icon-tile-sm text-emerald-300">
                            <Zap className="w-4 h-4" />
                          </div>
                          <span className="micro-title">{record.exercise_name}</span>
                        </div>
                        {isNewRecord(record) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/80 text-white font-semibold">
                            NUOVO
                          </span>
                        )}
                      </div>
                      <div className="card-stack text-sm text-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Tipo</span>
                          <span className="font-semibold text-emerald-300 capitalize">
                            {record.exercise_type}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Performance</span>
                          <span className="font-semibold">
                            {record.performance_value} {record.performance_unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">RPE</span>
                          <span className="font-semibold">{record.rpe || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Strength Records */}
        {activeTab === 'strength-pbs' && personalBests && (
          <div className="glass-card widget-card widget-accent-amber widget-shine overflow-hidden transition-shadow duration-200 hover:shadow-md">
            <div className="panel-header">
              <SectionTitle title="Massimali di Forza" />
            </div>
            <div className="panel-body">
              {personalBests.strengthRecords.length === 0 ? (
                <div className="panel-body text-center text-gray-400 transition-shadow duration-200 hover:shadow-md">
                  Nessun massimale registrato
                </div>
              ) : (
                <div className="card-grid-2">
                  {personalBests.strengthRecords.map((record) => (
                    <div key={record.id} className="tile tile-accent-amber tap-ripple">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="icon-tile icon-tile-sm text-amber-300">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <span className="micro-title">{record.exercise_name}</span>
                      </div>
                      <div className="card-stack text-sm text-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Categoria</span>
                          <span className="font-semibold text-amber-300 capitalize">
                            {record.category}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Peso</span>
                          <span className="font-semibold">{record.weight_kg} kg</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Reps</span>
                          <span className="font-semibold">{record.reps}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">% BW</span>
                          <span className="font-semibold text-amber-300">
                            {record.percentage_of_bodyweight}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Injuries */}
        {activeTab === 'injuries' && (
          <div className="glass-card widget-card widget-accent-pink widget-shine overflow-hidden transition-shadow duration-200 hover:shadow-md">
            <div className="panel-header">
              <SectionTitle title="Storico Infortuni" />
              <button
                onClick={() => setShowOnlyActiveInjuries(!showOnlyActiveInjuries)}
                className={`px-4 py-2 text-sm ${
                  showOnlyActiveInjuries ? 'btn-primary' : 'btn-ghost link-muted'
                }`}
              >
                {showOnlyActiveInjuries ? 'Mostra tutti' : 'Solo attivi'}
              </button>
            </div>
            <div className="divide-y divide-slate-700">
              {injuries.length === 0 ? (
                <div className="panel-body text-center text-gray-400 transition-shadow duration-200 hover:shadow-md">
                  Nessun infortunio registrato
                </div>
              ) : (
                injuries
                  .filter((injury) => !showOnlyActiveInjuries || !injury.end_date)
                  .map((injury) => (
                    <div key={injury.id} className="panel-body hover:bg-slate-700/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-white">
                              {injury.injury_type}
                            </h4>
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                injury.severity === 'severe'
                                  ? 'bg-red-900 text-red-200'
                                  : injury.severity === 'moderate'
                                    ? 'bg-yellow-900 text-yellow-200'
                                    : 'bg-green-900 text-green-200'
                              }`}
                            >
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
                          <p className="text-sm text-gray-400">
                            Parte interessata: {injury.body_part}
                          </p>
                        </div>
                        {!injury.end_date && (
                          <button
                            onClick={() => {
                              setSelectedInjury(injury)
                              setEndDate(new Date().toISOString().split('T')[0])
                              setShowInjuryModal(true)
                            }}
                            className="ml-4 px-3 py-1 btn-success text-sm flex items-center gap-2"
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
                            {injury.end_date
                              ? new Date(injury.end_date).toLocaleDateString('it-IT')
                              : 'Ancora presente'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Durata</p>
                          <p className="text-white font-medium">
                            {injury.end_date
                              ? Math.floor(
                                  (new Date(injury.end_date) - new Date(injury.start_date)) /
                                    (1000 * 60 * 60 * 24)
                                ) + ' giorni'
                              : Math.floor(
                                  (new Date() - new Date(injury.start_date)) / (1000 * 60 * 60 * 24)
                                ) + ' giorni'}
                          </p>
                        </div>
                      </div>
                      {injury.notes && <p className="text-sm text-gray-300 mt-3">{injury.notes}</p>}
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
          <div className="modal-shell max-w-md max-w-[95vw] max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <div className="modal-header mb-4">
              <SectionTitle title="Chiudi Infortunio" />
              <button
                onClick={() => {
                  setShowInjuryModal(false)
                  setSelectedInjury(null)
                  setEndDate('')
                }}
                className="btn-icon btn-ghost"
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
                className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResolveInjury}
                disabled={!endDate || loading}
                className="flex-1 px-4 py-2 min-h-[44px] btn-success"
              >
                Conferma
              </button>
              <button
                onClick={() => {
                  setShowInjuryModal(false)
                  setSelectedInjury(null)
                  setEndDate('')
                }}
                className="px-4 py-2 min-h-[44px] btn-secondary"
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
          <div className="modal-shell p-5 sm:p-8 max-w-sm max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <div className="modal-header mb-6">
              <SectionTitle title="Modifica Profilo" />
              <button onClick={() => setShowEditProfile(false)} className="btn-icon btn-ghost">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Mario Rossi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data di Nascita
                </label>
                <input
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="65"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Altezza (cm)</label>
                <input
                  type="number"
                  step="1"
                  value={editHeight}
                  onChange={(e) => setEditHeight(e.target.value)}
                  className="w-full px-4 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="173"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex-1 px-4 py-2 min-h-[44px] btn-primary"
              >
                Salva
              </button>
              <button
                onClick={() => setShowEditProfile(false)}
                className="px-4 py-2 min-h-[44px] btn-secondary"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
