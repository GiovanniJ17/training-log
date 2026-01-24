import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  LineChart,
  Line,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts'
import {
  Download,
  TrendingUp,
  BarChart4,
  Activity,
  Flame,
  Trophy,
  Timer,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  CalendarDays,
  Target
} from 'lucide-react'
import { format } from 'date-fns'
import {
  getStatsData,
  calculateKPIs,
  getProgressionChartData,
  getWeeklyHeatmapData,
  getSessionTypeDistribution,
  getRPEPerformanceCorrelation,
  getInjuryTimeline,
  getMonthlyMetrics,
  getSprintLoadModel,
  getSprintPeriodComparison,
  getTargetTimeBands,
  getSprintDataQuality,
  getSprinterSummary,
  exportToCSV
} from '../services/statisticsService'
import {
  getWeeklyInsight,
  getWhatIfPrediction,
  getAdaptiveWorkoutSuggestion
} from '../services/aiCoachService'
import { generateProactiveAlerts } from '../services/proactiveCoach'
import CoachAlerts from './CoachAlerts'
import LoadingSpinner from './LoadingSpinner'
import { Card, CardBody, CardHeader } from './ui/Card'
import EmptyState from './ui/EmptyState'
import SectionTitle, { Subheader } from './ui/SectionTitle'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function TrainingDashboard() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('3months') // 'week', 'month', '3months', 'custom'
  const [chartWindow, setChartWindow] = useState('period') // 'period', '30d', '90d'
  const [progressionFocus, setProgressionFocus] = useState('all') // 'all', 'races', 'tests'
  const [sessionFocus, setSessionFocus] = useState('all') // 'all', 'sprint'
  const [smoothProgression, setSmoothProgression] = useState(false)
  const [compareProgression, setCompareProgression] = useState(false)
  const [manualTargets, setManualTargets] = useState({})
  const [startDate, _setStartDate] = useState(null)
  const [endDate, _setEndDate] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [progressionData, setProgressionData] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [distributionData, setDistributionData] = useState([])
  const [scatterData, setScatterData] = useState([])
  const [injuryTimeline, setInjuryTimeline] = useState([])
  const [monthlyMetrics, setMonthlyMetrics] = useState([])
  const [selectedDistance, setSelectedDistance] = useState(null)
  const [rawData, setRawData] = useState({
    sessions: [],
    raceRecords: [],
    trainingRecords: [],
    strengthRecords: [],
    injuries: []
  })
  const [coachInsight, setCoachInsight] = useState(null)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState(null)
  const [whatIfInput, setWhatIfInput] = useState({
    targetDistance: null,
    baseMode: 'pb',
    pbKey: '',
    baseDistance: '',
    baseTime: ''
  })
  const [whatIfResult, setWhatIfResult] = useState(null)
  const [whatIfLoading, setWhatIfLoading] = useState(false)
  const [adaptiveFocus, setAdaptiveFocus] = useState('')
  const [adaptiveResult, setAdaptiveResult] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [adaptiveLoading, setAdaptiveLoading] = useState(false)
  const [adaptiveError, setAdaptiveError] = useState(null)

  const sprintLoadModel = useMemo(() => getSprintLoadModel(rawData.sessions), [rawData.sessions])
  const sprintComparison = useMemo(
    () => getSprintPeriodComparison(rawData.sessions, rawData.raceRecords),
    [rawData.raceRecords, rawData.sessions]
  )
  const sprintTargetBands = useMemo(
    () => getTargetTimeBands(rawData.raceRecords),
    [rawData.raceRecords]
  )
  const sprinterSummary = useMemo(
    () => getSprinterSummary(rawData.sessions, rawData.raceRecords),
    [rawData.raceRecords, rawData.sessions]
  )
  const sprintDataQuality = useMemo(
    () => getSprintDataQuality(rawData.sessions, rawData.raceRecords, sprinterSummary),
    [rawData.raceRecords, rawData.sessions, sprinterSummary]
  )

  const hasSprintSummary = sprinterSummary.distanceRows.length > 0
  const hasSprintLoad = sprintLoadModel.series.length >= 7
  const hasSprintComparison =
    sprintComparison.current.sessions + sprintComparison.previous.sessions >= 2
  const hasSprintMetrics =
    sprinterSummary.sprintMetrics &&
    (sprinterSummary.sprintMetrics.maxVelocityMps ||
      sprinterSummary.sprintMetrics.accelIndex !== null ||
      sprinterSummary.sprintMetrics.speedEndurance200 !== null ||
      [60, 100, 200].some(
        (distance) => sprinterSummary.sprintMetrics.consistencyByDistance?.[distance] !== null
      ))

  const loadDashboardData = useCallback(async () => {
    setLoading(true)

    // Calcola date in base al period
    const end = endDate || new Date()
    let start = startDate

    if (!start) {
      switch (period) {
        case 'week':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case '3months':
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        default:
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
      }
    }

    const result = await getStatsData(start, end)

    if (result.success) {
      const { sessions, raceRecords, trainingRecords, strengthRecords, injuries } = result.data
      setRawData({ sessions, raceRecords, trainingRecords, strengthRecords, injuries })

      // Calcola tutte le metriche
      const kpisCalc = calculateKPIs(sessions, raceRecords, strengthRecords, trainingRecords)
      setKpis(kpisCalc)

      const progression = getProgressionChartData(raceRecords)
      setProgressionData(progression)

      const weekly = getWeeklyHeatmapData(sessions)
      setWeeklyData(weekly)

      const distribution = getSessionTypeDistribution(sessions)
      setDistributionData(distribution)

      const scatter = getRPEPerformanceCorrelation(sessions, raceRecords)
      setScatterData(scatter)

      const injuryTl = getInjuryTimeline(injuries, raceRecords)
      setInjuryTimeline(injuryTl)

      const monthly = getMonthlyMetrics(sessions, raceRecords)
      setMonthlyMetrics(monthly)

      // Genera gli alert proattivi del coach
      try {
        const detectedAlerts = await generateProactiveAlerts(
          sessions,
          raceRecords,
          strengthRecords,
          trainingRecords,
          injuries
        )
        setAlerts(detectedAlerts || [])
      } catch (err) {
        console.error('Errore generazione alert:', err)
        setAlerts([])
      }
    }

    setLoading(false)
  }, [endDate, period, startDate])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const availableDistances = useMemo(() => {
    const keys = new Set()
    progressionData.forEach((d) => {
      Object.keys(d)
        .filter((k) => k !== 'date')
        .forEach((k) => keys.add(parseInt(k)))
    })
    return Array.from(keys).sort((a, b) => a - b)
  }, [progressionData])

  const distanceOptions = useMemo(() => {
    const distances = new Set(availableDistances)
    rawData.raceRecords.forEach((r) => {
      if (r.distance_m) distances.add(Number(r.distance_m))
    })
    return Array.from(distances).sort((a, b) => a - b)
  }, [availableDistances, rawData.raceRecords])

  const pbOptions = useMemo(() => {
    const pbs = rawData.raceRecords
      .filter((r) => r.is_personal_best && r.distance_m && r.time_s)
      .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
      .slice(0, 8)
      .map((r) => ({
        distance_m: Number(r.distance_m),
        time_s: Number(r.time_s),
        date: r.date || r.created_at
      }))

    if (pbs.length) return pbs

    const bestByDistance = {}
    rawData.raceRecords.forEach((r) => {
      if (!r.distance_m || !r.time_s) return
      const distance = Number(r.distance_m)
      const time = Number(r.time_s)
      if (!bestByDistance[distance] || time < bestByDistance[distance].time_s) {
        bestByDistance[distance] = {
          distance_m: distance,
          time_s: time,
          date: r.date || r.created_at
        }
      }
    })
    return Object.values(bestByDistance).sort((a, b) => a.distance_m - b.distance_m)
  }, [rawData.raceRecords])

  const scatterDistances = useMemo(() => {
    const keys = new Set(scatterData.map((d) => d.distance))
    return Array.from(keys).sort((a, b) => a - b)
  }, [scatterData])

  useEffect(() => {
    if (availableDistances.length === 0) return
    setSelectedDistance((prev) =>
      prev && availableDistances.includes(prev) ? prev : availableDistances[0]
    )
  }, [availableDistances])

  useEffect(() => {
    if (scatterDistances.length === 0) return
    setSelectedDistance((prev) =>
      prev && scatterDistances.includes(prev) ? prev : scatterDistances[0]
    )
  }, [scatterDistances])

  useEffect(() => {
    if (!whatIfInput.targetDistance && distanceOptions.length) {
      setWhatIfInput((p) => ({ ...p, targetDistance: distanceOptions[0] }))
    }
  }, [distanceOptions, whatIfInput.targetDistance])

  useEffect(() => {
    if (whatIfInput.pbKey || !pbOptions.length) return
    const pb = pbOptions[0]
    setWhatIfInput((p) => ({
      ...p,
      pbKey: `${pb.distance_m}-${pb.time_s}`,
      baseDistance: pb.distance_m,
      baseTime: pb.time_s.toFixed(2)
    }))
  }, [pbOptions, whatIfInput.pbKey])

  const handleExportCSV = () => {
    exportToCSV(
      rawData.sessions,
      rawData.raceRecords,
      `training-stats-${format(new Date(), 'yyyy-MM-dd')}.csv`
    )
  }

  const handleGenerateInsight = async () => {
    if (!rawData.sessions.length && !rawData.raceRecords.length) return
    setCoachLoading(true)
    setCoachError(null)
    setCoachInsight(null)
    const payload = {
      sessions: rawData.sessions,
      raceRecords: rawData.raceRecords,
      strengthRecords: rawData.strengthRecords,
      kpis: kpis || {}
    }
    const res = await getWeeklyInsight(payload)
    setCoachLoading(false)
    if (res.success) {
      setCoachInsight(res.data)
    } else {
      setCoachError(res.error)
    }
  }

  const parseTimeInput = (value) => {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    if (!text) return null
    if (text.includes(':')) {
      const [minsPart, secsPart] = text.split(':')
      const mins = Number(minsPart)
      const secs = Number(secsPart)
      if (Number.isNaN(mins) || Number.isNaN(secs)) return null
      return mins * 60 + secs
    }
    const numeric = Number(text)
    return Number.isNaN(numeric) ? null : numeric
  }

  const formatSeconds = (value) => {
    if (value === null || value === undefined) return '-'
    const seconds = Number(value)
    if (Number.isNaN(seconds)) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(2)
    if (mins > 0) {
      return `${mins}:${secs.padStart(5, '0')}`
    }
    return `${secs}s`
  }

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-'
    const num = Number(value)
    if (Number.isNaN(num)) return '-'
    return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`
  }

  const formatDeltaSeconds = (value) => {
    if (value === null || value === undefined) return '-'
    const num = Number(value)
    if (Number.isNaN(num)) return '-'
    const sign = num > 0 ? '+' : ''
    return `${sign}${num.toFixed(2)}s`
  }

  const getChartWindowStart = () => {
    if (chartWindow === 'period') return null
    const end = endDate || new Date()
    const days = chartWindow === '30d' ? 30 : 90
    return new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  }

  const isSprintSession = useCallback((session) => {
    if (session?.type === 'pista' || session?.type === 'gara' || session?.type === 'test') {
      return true
    }
    return (session.workout_groups || []).some((group) =>
      (group.workout_sets || []).some((set) => set.category === 'sprint' || set.category === 'jump')
    )
  }, [])

  const sessionTypeById = useMemo(() => {
    const map = {}
    rawData.sessions.forEach((session) => {
      map[session.id] = session.type || null
    })
    return map
  }, [rawData.sessions])

  const baseProgressionRecords = useMemo(() => {
    const base = rawData.raceRecords.filter((record) => {
      const dateObj = new Date(record.date || record.created_at)
      return !Number.isNaN(dateObj.getTime())
    })
    if (progressionFocus === 'all') return base
    return base.filter((record) => {
      const sessionType = sessionTypeById[record.session_id]
      if (progressionFocus === 'races') {
        return sessionType === 'gara' || record.type === 'race'
      }
      if (progressionFocus === 'tests') {
        return sessionType === 'test' || record.is_test
      }
      return true
    })
  }, [progressionFocus, rawData.raceRecords, sessionTypeById])

  const chartSessions = useMemo(() => {
    const start = getChartWindowStart()
    const base = rawData.sessions.filter((session) => {
      const dateObj = new Date(session.date)
      return !Number.isNaN(dateObj.getTime()) && (!start || dateObj >= start)
    })
    if (sessionFocus === 'sprint') {
      return base.filter((session) => isSprintSession(session))
    }
    return base
  }, [chartWindow, endDate, rawData.sessions, sessionFocus, isSprintSession])

  const chartRaceRecords = useMemo(() => {
    const start = getChartWindowStart()
    return baseProgressionRecords.filter((record) => {
      const dateObj = new Date(record.date || record.created_at)
      return !Number.isNaN(dateObj.getTime()) && (!start || dateObj >= start)
    })
  }, [chartWindow, endDate, baseProgressionRecords])

  const chartProgressionData = useMemo(
    () => getProgressionChartData(chartRaceRecords),
    [chartRaceRecords]
  )

  const smoothSeries = useCallback((data, window = 3) => {
    if (!data.length) return data
    const keys = Object.keys(data[0]).filter((k) => k !== 'date')
    return data.map((row, index) => {
      const smoothed = { date: row.date }
      keys.forEach((key) => {
        const values = []
        for (let i = Math.max(0, index - window + 1); i <= index; i++) {
          const value = data[i]?.[key]
          if (typeof value === 'number') values.push(value)
        }
        if (values.length) {
          smoothed[key] = values.reduce((sum, v) => sum + v, 0) / values.length
        }
      })
      return smoothed
    })
  }, [])

  const displayedProgressionData = useMemo(
    () => (smoothProgression ? smoothSeries(chartProgressionData, 3) : chartProgressionData),
    [chartProgressionData, smoothProgression, smoothSeries]
  )

  const chartWeeklyData = useMemo(
    () => getWeeklyHeatmapData(chartSessions),
    [chartSessions]
  )

  const chartDistributionData = useMemo(
    () => getSessionTypeDistribution(chartSessions),
    [chartSessions]
  )

  const chartMonthlyMetrics = useMemo(
    () => getMonthlyMetrics(chartSessions, chartRaceRecords),
    [chartRaceRecords, chartSessions]
  )

  const chartWindowLabel =
    chartWindow === 'period' ? 'Periodo' : chartWindow === '30d' ? '30g' : '90g'

  const chartAvailableDistances = useMemo(() => {
    const keys = new Set()
    chartProgressionData.forEach((d) => {
      Object.keys(d)
        .filter((k) => k !== 'date')
        .forEach((k) => keys.add(parseInt(k)))
    })
    return Array.from(keys).sort((a, b) => a - b)
  }, [chartProgressionData])

  const [selectedDistances, setSelectedDistances] = useState([])

  useEffect(() => {
    if (!chartAvailableDistances.length) return
    setSelectedDistances((prev) => {
      if (!prev.length) {
        const defaults = [60, 100, 200].filter((d) => chartAvailableDistances.includes(d))
        return defaults.length ? defaults : chartAvailableDistances
      }
      const next = prev.filter((d) => chartAvailableDistances.includes(d))
      return next.length ? next : chartAvailableDistances
    })
  }, [chartAvailableDistances])

  const toggleDistance = (distance) => {
    setSelectedDistances((prev) => {
      if (prev.includes(distance)) {
        const next = prev.filter((d) => d !== distance)
        return next.length ? next : prev
      }
      return [...prev, distance].sort((a, b) => a - b)
    })
  }

  const showAllDistances = () => {
    setSelectedDistances(chartAvailableDistances)
  }

  const focusSprintDistances = () => {
    const defaults = [60, 100, 200].filter((d) => chartAvailableDistances.includes(d))
    setSelectedDistances(defaults.length ? defaults : chartAvailableDistances)
  }

  const targetTimesByDistance = useMemo(() => {
    const map = {}
    sprintTargetBands.forEach((band) => {
      if (band.target_s) {
        map[band.distance_m] = band.target_s
      }
    })
    Object.entries(manualTargets).forEach(([distance, value]) => {
      const num = Number(value)
      if (!Number.isNaN(num) && num > 0) {
        map[Number(distance)] = num
      }
    })
    return map
  }, [sprintTargetBands, manualTargets])

  const progressionDataWithCompare = useMemo(() => {
    if (!compareProgression || chartWindow === 'period') {
      return displayedProgressionData
    }
    const end = endDate || new Date()
    const windowStart = getChartWindowStart()
    if (!windowStart) return displayedProgressionData

    const windowDays = chartWindow === '30d' ? 30 : 90
    const prevStart = new Date(windowStart.getTime() - windowDays * 24 * 60 * 60 * 1000)
    const prevEnd = new Date(windowStart.getTime() - 1)

    const prevRecords = baseProgressionRecords.filter((record) => {
      const dateObj = new Date(record.date || record.created_at)
      return !Number.isNaN(dateObj.getTime()) && dateObj >= prevStart && dateObj <= prevEnd
    })
    let prevData = getProgressionChartData(prevRecords)
    if (smoothProgression) {
      prevData = smoothSeries(prevData, 3)
    }

    const shiftDays = windowDays
    const prevMap = new Map()
    prevData.forEach((row) => {
      const dateObj = new Date(row.date)
      if (Number.isNaN(dateObj.getTime())) return
      dateObj.setDate(dateObj.getDate() + shiftDays)
      const key = dateObj.toISOString().split('T')[0]
      prevMap.set(key, row)
    })

    return displayedProgressionData.map((row) => {
      const merged = { ...row }
      const prevRow = prevMap.get(row.date)
      if (prevRow) {
        Object.keys(prevRow)
          .filter((k) => k !== 'date')
          .forEach((k) => {
            merged[`${k}_prev`] = prevRow[k]
          })
      }
      return merged
    })
  }, [
    compareProgression,
    chartWindow,
    displayedProgressionData,
    endDate,
    getChartWindowStart,
    baseProgressionRecords,
    smoothProgression,
    smoothSeries
  ])

  const progressionDataWithGoals = useMemo(() => {
    if (!displayedProgressionData.length) return displayedProgressionData
    return progressionDataWithCompare.map((row) => {
      const withGoals = { ...row }
      selectedDistances.forEach((distance) => {
        const target = targetTimesByDistance[distance]
        if (target) {
          withGoals[`${distance}m_goal`] = target
        }
      })
      return withGoals
    })
  }, [progressionDataWithCompare, selectedDistances, targetTimesByDistance])

  const getBestByDistance = (records, start, end) => {
    const grouped = {}
    records.forEach((record) => {
      const distance = Number(record.distance_m)
      if (!distance) return
      const dateObj = new Date(record.date || record.created_at)
      if (Number.isNaN(dateObj.getTime())) return
      if (start && dateObj < start) return
      if (end && dateObj > end) return
      if (!grouped[distance] || Number(record.time_s) < grouped[distance]) {
        grouped[distance] = Number(record.time_s)
      }
    })
    return grouped
  }

  const progressionInsight = useMemo(() => {
    if (!chartRaceRecords.length) return null
    const end = endDate || new Date()
    const start = getChartWindowStart()
    const recordDates = chartRaceRecords
      .map((r) => new Date(r.date || r.created_at))
      .filter((d) => !Number.isNaN(d.getTime()))
    if (!recordDates.length) return null
    const windowStart = start || new Date(Math.min(...recordDates.map((d) => d.getTime())))
    const windowDays = Math.max(1, Math.round((end - windowStart) / (1000 * 60 * 60 * 24)))
    const prevStart = new Date(windowStart.getTime() - windowDays * 24 * 60 * 60 * 1000)
    const prevEnd = new Date(windowStart.getTime() - 1)

    const currentBest = getBestByDistance(chartRaceRecords, windowStart, end)
    const prevBest = getBestByDistance(chartRaceRecords, prevStart, prevEnd)
    const priority = [100, 60, 200]
    const distance = priority.find((d) => currentBest[d] && prevBest[d])
    if (!distance) return null
    const delta = currentBest[distance] - prevBest[distance]
    return `Best ${distance}m ${delta <= 0 ? 'migliorato' : 'peggiorato'} di ${formatDeltaSeconds(
      delta
    )} rispetto alla finestra precedente`
  }, [chartRaceRecords, endDate, chartWindow])

  const distributionInsight = useMemo(() => {
    if (!chartDistributionData.length) return null
    const top = chartDistributionData.reduce((best, current) =>
      current.value > best.value ? current : best
    )
    return `Tipo prevalente: ${top.name} (${top.percentage}%)`
  }, [chartDistributionData])

  const weeklyInsight = useMemo(() => {
    if (chartWeeklyData.length < 2) return null
    const recent = chartWeeklyData.slice(-4)
    const prev = chartWeeklyData.slice(-8, -4)
    const avgRecent =
      recent.reduce((sum, w) => sum + Number(w.avgRPE || 0), 0) / recent.length
    const avgPrev = prev.length
      ? prev.reduce((sum, w) => sum + Number(w.avgRPE || 0), 0) / prev.length
      : null
    if (avgPrev === null) return null
    const delta = avgRecent - avgPrev
    return `RPE medio 4 settimane: ${avgRecent.toFixed(1)} (${formatDeltaSeconds(delta)})`
  }, [chartWeeklyData])

  const monthlyInsight = useMemo(() => {
    if (chartMonthlyMetrics.length < 2) return null
    const last = chartMonthlyMetrics[chartMonthlyMetrics.length - 1]
    const prev = chartMonthlyMetrics[chartMonthlyMetrics.length - 2]
    const lastAvg = Number(last.avg)
    const prevAvg = Number(prev.avg)
    if (Number.isNaN(lastAvg) || Number.isNaN(prevAvg)) return null
    const delta = lastAvg - prevAvg
    return `Tempo medio mensile ${delta <= 0 ? 'migliorato' : 'peggiorato'} di ${formatDeltaSeconds(
      delta
    )}`
  }, [chartMonthlyMetrics])

  const handleWhatIf = async () => {
    const targetDistance = whatIfInput.targetDistance || distanceOptions[0]
    let baseDistance = whatIfInput.baseDistance
    let baseTime = parseTimeInput(whatIfInput.baseTime)

    if (whatIfInput.baseMode === 'pb' && whatIfInput.pbKey) {
      const [distPart, timePart] = whatIfInput.pbKey.split('-')
      baseDistance = Number(distPart)
      baseTime = Number(timePart)
    }

    if (!targetDistance) return
    setWhatIfLoading(true)
    const res = await getWhatIfPrediction({
      target_distance_m: targetDistance,
      base_distance_m: baseDistance,
      base_time_s: baseTime,
      recent_pbs: pbOptions
    })
    setWhatIfLoading(false)
    setWhatIfResult(res.success ? res.data : { error: res.error })
  }

  const handleAdaptiveSuggestion = async () => {
    if (!rawData.sessions.length) return
    setAdaptiveLoading(true)
    setAdaptiveError(null)
    const res = await getAdaptiveWorkoutSuggestion({
      recentSessions: rawData.sessions,
      upcomingFocus: adaptiveFocus,
      raceRecords: rawData.raceRecords
    })
    setAdaptiveLoading(false)
    if (res.success) {
      setAdaptiveResult(res.data)
    } else {
      setAdaptiveError(res.error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner message="Caricamento statistiche..." />
      </div>
    )
  }

  return (
    <div className="app-shell py-4 space-y-6 animate-pop">
      {/* Header con filtri */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart4 className="w-5 h-5 text-cyan-400" />
            Statistiche Dettagliate
          </h1>
          <p className="text-sm text-slate-400 mt-1">Analisi approfondita delle tue performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white"
          >
            <option value="week">Ultima Settimana</option>
            <option value="month">Ultimo Mese</option>
            <option value="3months">Ultimi 3 Mesi</option>
            <option value="custom">Custom</option>
          </select>
          <button onClick={handleExportCSV} className="px-4 py-2 btn-primary rounded-xl">
            <Download className="w-4 h-4" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Proactive Alerts */}
      {alerts.length > 0 && <CoachAlerts alerts={alerts} loading={false} />}

      {/* Coach AI & What-if */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span className="text-base font-semibold text-white">Insight Coach AI</span>
            </div>
            <button
              onClick={handleGenerateInsight}
              disabled={coachLoading || (!rawData.sessions.length && !rawData.raceRecords.length)}
              className="px-4 py-2 btn-primary rounded-xl text-sm"
            >
              {coachLoading ? 'Generazione...' : 'Genera Insight'}
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-4">Commento automatico sugli ultimi allenamenti</p>
          
          {coachError && (
            <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl">
              {coachError}
            </div>
          )}
          {coachInsight && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs text-emerald-300/70 mb-1 uppercase tracking-wider">Positivo</div>
                <div className="text-slate-200">{coachInsight.positive}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-xs text-amber-300/70 mb-1 uppercase tracking-wider">Rischio</div>
                <div className="text-slate-200">{coachInsight.warning}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs text-blue-300/70 mb-1 uppercase tracking-wider">Focus</div>
                <div className="text-slate-200">{coachInsight.advice}</div>
              </div>
            </div>
          )}
          {!coachInsight && !coachLoading && !coachError && (
            <div className="p-4 text-sm text-slate-400 bg-slate-800/30 border border-slate-700/50 rounded-xl text-center">
              Genera per ottenere un commento di sintesi.
            </div>
          )}
        </div>

        <Card className="widget-card widget-accent-pink widget-shine widget-tint-pink">
          <CardHeader>
            <SectionTitle title="What-if Prestazione" icon={<TrendingUp className="w-5 h-5" />} />
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div>
              <label className="text-gray-400 text-xs">Distanza target</label>
              <select
                value={whatIfInput.targetDistance || distanceOptions[0] || ''}
                onChange={(e) =>
                  setWhatIfInput((p) => ({ ...p, targetDistance: parseInt(e.target.value) }))
                }
                className="w-full mt-1 px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white text-base sm:text-sm"
              >
                {distanceOptions.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}m
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs">Riferimento PB</label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    const pb = pbOptions[0]
                    setWhatIfInput((p) => ({
                      ...p,
                      baseMode: 'pb',
                      pbKey: p.pbKey || (pb ? `${pb.distance_m}-${pb.time_s}` : ''),
                      baseDistance: p.baseDistance || (pb ? pb.distance_m : ''),
                      baseTime: p.baseTime || (pb ? pb.time_s.toFixed(2) : '')
                    }))
                  }}
                  className={`flex-1 px-3 py-2 min-h-[44px] ${
                    whatIfInput.baseMode === 'pb' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  Usa PB recente
                </button>
                <button
                  onClick={() => setWhatIfInput((p) => ({ ...p, baseMode: 'manual' }))}
                  className={`flex-1 px-3 py-2 min-h-[44px] ${
                    whatIfInput.baseMode === 'manual' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  Inserisci manuale
                </button>
              </div>
            </div>
            {whatIfInput.baseMode === 'pb' && (
              <div>
                <label className="text-gray-400 text-xs">PB recente</label>
                <select
                  value={whatIfInput.pbKey || ''}
                  onChange={(e) => {
                    const [distPart, timePart] = e.target.value.split('-')
                    setWhatIfInput((p) => ({
                      ...p,
                      pbKey: e.target.value,
                      baseDistance: Number(distPart),
                      baseTime: Number(timePart).toFixed(2)
                    }))
                  }}
                  className="w-full mt-1 px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white text-base sm:text-sm"
                >
                  {pbOptions.map((pb) => (
                    <option
                      key={`${pb.distance_m}-${pb.time_s}`}
                      value={`${pb.distance_m}-${pb.time_s}`}
                    >
                      {pb.distance_m}m - {formatSeconds(pb.time_s)}
                    </option>
                  ))}
                </select>
                {pbOptions.length === 0 && (
                  <div className="panel-body text-xs text-gray-500 bg-slate-800/40 border border-slate-700 rounded-lg mt-2">
                    Nessun PB disponibile, usa inserimento manuale.
                  </div>
                )}
              </div>
            )}
            {whatIfInput.baseMode === 'manual' && (
              <>
                <div>
                  <label className="text-gray-400 text-xs">Distanza riferimento (m)</label>
                <input
                    type="number"
                    value={whatIfInput.baseDistance}
                    onChange={(e) =>
                      setWhatIfInput((p) => ({ ...p, baseDistance: e.target.value }))
                    }
                  className="w-full mt-1 px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white text-base sm:text-sm"
                    placeholder="Es. 100"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs">Tempo riferimento</label>
                  <input
                    type="text"
                    value={whatIfInput.baseTime}
                    onChange={(e) => setWhatIfInput((p) => ({ ...p, baseTime: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-white text-base sm:text-sm"
                    placeholder="Es. 11.24 oppure 0:11.24"
                  />
                </div>
              </>
            )}
          <button
            onClick={handleWhatIf}
            disabled={whatIfLoading || !distanceOptions.length}
            className="w-full px-3 py-2 min-h-[44px] btn-primary"
          >
              {whatIfLoading ? 'Calcolo...' : 'Stima tempo atteso'}
            </button>
            {whatIfResult && (
              <div className="panel-body text-gray-200 text-sm space-y-1 bg-slate-700 border border-slate-600 rounded">
                {whatIfResult.error && (
                  <div className="text-red-400 text-xs">{whatIfResult.error}</div>
                )}
                {whatIfResult.estimate_s !== undefined && (
                  <div>
                    <span className="text-gray-400">Stima:</span>{' '}
                    {formatSeconds(whatIfResult.estimate_s)} ({formatSeconds(whatIfResult.low_s)} -{' '}
                    {formatSeconds(whatIfResult.high_s)})
                  </div>
                )}
                {whatIfResult.explanation && (
                  <div>
                    <span className="text-gray-400">Spiegazione:</span> {whatIfResult.explanation}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Colorful KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="stat-card stat-yellow">
            <div className="flex items-start justify-between">
              <div>
                <div className="stat-label">Sessioni</div>
                <div className="stat-value">{kpis.totalSessions}</div>
              </div>
              <div className="stat-icon">
                <BarChart4 className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="stat-card stat-orange">
            <div className="flex items-start justify-between">
              <div>
                <div className="stat-label">RPE Medio</div>
                <div className="stat-value">{kpis.avgRPE}</div>
              </div>
              <div className="stat-icon">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="stat-card stat-purple">
            <div className="flex items-start justify-between">
              <div>
                <div className="stat-label">Personal Best</div>
                <div className="stat-value">{kpis.pbCount}</div>
              </div>
              <div className="stat-icon">
                <Trophy className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="stat-card stat-green">
            <div className="flex items-start justify-between">
              <div>
                <div className="stat-label">Streak</div>
                <div className="flex items-baseline gap-2">
                  <span className="stat-value">{kpis.streak}</span>
                  <span className="text-sm opacity-60">giorni</span>
                </div>
              </div>
              <div className="stat-icon">
                <Flame className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sprint Summary */}
      {hasSprintSummary && (
        <Card className="widget-card widget-accent-blue widget-shine">
          <CardHeader>
            <SectionTitle title="Sprint Summary" subtitle="I 5 numeri chiave" icon={<Trophy className="w-5 h-5" />} />
          </CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm text-gray-200">
            <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <div className="icon-tile icon-tile-sm text-sky-300">
                  <Timer className="w-4 h-4" />
                </div>
                <div className="text-gray-400 text-xs uppercase">Recenti 60/100/200</div>
              </div>
              <div className="text-white mt-1 text-lg font-semibold">
                <div className="flex flex-col gap-1 text-sm">
                  <span>60m: {formatSeconds(sprinterSummary.sprintMetrics?.recentBestByDistance?.[60])}</span>
                  <span>100m: {formatSeconds(sprinterSummary.sprintMetrics?.recentBestByDistance?.[100])}</span>
                  <span>200m: {formatSeconds(sprinterSummary.sprintMetrics?.recentBestByDistance?.[200])}</span>
                </div>
              </div>
            </div>
            <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <div className="icon-tile icon-tile-sm text-emerald-300">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="text-gray-400 text-xs uppercase">Best 100m</div>
              </div>
              <div className="text-white mt-1 text-lg font-semibold">
                {sprinterSummary.sprintMetrics?.bestTimes?.[100]
                  ? formatSeconds(sprinterSummary.sprintMetrics.bestTimes[100])
                  : '-'}
              </div>
            </div>
            <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <div className="icon-tile icon-tile-sm text-amber-300">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="text-gray-400 text-xs uppercase">Top speed</div>
              </div>
              <div className="text-white mt-1 text-lg font-semibold">
                {sprinterSummary.topSpeedMps
                  ? `${sprinterSummary.topSpeedMps.toFixed(2)} m/s`
                  : '-'}
              </div>
            </div>
            <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <div className="icon-tile icon-tile-sm text-sky-300">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="text-gray-400 text-xs uppercase">Best 200m</div>
              </div>
              <div className="text-white mt-1 text-lg font-semibold">
                {sprinterSummary.sprintMetrics?.bestTimes?.[200]
                  ? formatSeconds(sprinterSummary.sprintMetrics.bestTimes[200])
                  : '-'}
              </div>
            </div>
            <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <div className="icon-tile icon-tile-sm text-rose-300">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="text-gray-400 text-xs uppercase">PB 30 giorni</div>
              </div>
              <div className="text-white mt-1 text-lg font-semibold">
                {sprinterSummary.pbCountLast30}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sprinter Focus */}
      {hasSprintSummary && (
        <Card className="widget-card widget-accent-emerald widget-shine">
          <CardHeader>
            <SectionTitle
              title="Focus Sprinter"
              subtitle="Snapshot su distanze chiave e forma recente"
              icon={<Activity className="w-5 h-5" />}
            />
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-200">
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-rose-300">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">PB 30 giorni</div>
                </div>
                <div className="text-white mt-1 text-lg font-semibold">
                  {sprinterSummary.pbCountLast30}
                </div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-emerald-300">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">Sessioni Qualità</div>
                </div>
                <div className="text-white mt-1 text-lg font-semibold">
                  {sprinterSummary.sessionQualityLast30}
                </div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-amber-300">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">Top Speed stimata</div>
                </div>
                <div className="text-white mt-1 text-lg font-semibold">
                  {sprinterSummary.topSpeedMps ? `${sprinterSummary.topSpeedMps.toFixed(2)} m/s` : '-'}
                </div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-sky-300">
                    <LineChartIcon className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">Speed Endurance</div>
                </div>
                <div className="text-white mt-1 text-lg font-semibold">
                  {sprinterSummary.speedEnduranceIndex
                    ? sprinterSummary.speedEnduranceIndex.toFixed(2)
                    : '-'}
                </div>
              </div>
            </div>

            <div className="card-grid-3">
              {sprinterSummary.distanceRows.map((row) => (
                <div key={row.distance_m} className="tile tile-accent-blue tap-ripple">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="icon-tile icon-tile-sm text-sky-300">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div className="micro-title">{row.distance_m}m</div>
                  </div>
                  <div className="card-stack text-sm text-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Best</span>
                      <span className="text-white font-semibold">
                        {formatSeconds(row.best_time_s)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Recente</span>
                      <span className="text-white font-semibold">
                        {formatSeconds(row.recent_time_s)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Delta</span>
                      <span
                        className={`font-semibold ${
                          row.change_percent <= 0 ? 'text-green-400' : 'text-yellow-400'
                        }`}
                      >
                        {formatPercent(row.change_percent)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Trend 28g</span>
                      <span
                        className={`font-semibold ${
                          row.trend_percent !== null && row.trend_percent <= 0
                            ? 'text-green-400'
                            : 'text-yellow-400'
                        }`}
                      >
                        {formatPercent(row.trend_percent)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sprint Metrics */}
      {hasSprintMetrics && (
        <Card className="widget-card widget-accent-amber widget-shine">
          <CardHeader>
            <SectionTitle title="Metriche Sprinter" subtitle="Velocità, riserva e consistenza" icon={<LineChartIcon className="w-5 h-5" />} />
          </CardHeader>
          <CardBody className="space-y-4 text-sm text-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-sky-300">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">Max velocity</div>
                </div>
                <div className="text-white mt-1 text-lg font-semibold">
                  {sprinterSummary.sprintMetrics.maxVelocityMps
                    ? `${sprinterSummary.sprintMetrics.maxVelocityMps.toFixed(2)} m/s`
                    : '-'}
                </div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-amber-300">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">Accel index (30/60)</div>
                </div>
                <div className="text-white mt-1 text-lg font-semibold">
                  {sprinterSummary.sprintMetrics.accelIndex ?? '-'}
                </div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-emerald-300">
                    <LineChartIcon className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">Speed Endurance</div>
                </div>
                <div className="text-white mt-1 text-lg font-semibold">
                  {sprinterSummary.sprintMetrics.speedEndurance200 ?? '-'} (200/100)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[60, 100, 200].map((distance) => (
                <div
                  key={distance}
                  className="panel-body bg-slate-800 border border-slate-700 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="icon-tile icon-tile-sm text-sky-300">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div className="text-gray-400 text-xs uppercase">{distance}m consistency</div>
                  </div>
                  <div className="mt-1 text-white font-semibold">
                    {sprinterSummary.sprintMetrics.consistencyByDistance?.[distance] !== null
                      ? `${sprinterSummary.sprintMetrics.consistencyByDistance[distance].toFixed(2)}s`
                      : '-'}
                  </div>
                  <div className="text-gray-400 text-xs">Std dev ultimi 8 risultati</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {sprintDataQuality.issues.length > 0 && (
        <Card className="widget-card widget-accent-pink widget-shine">
          <CardHeader>
            <SectionTitle title="Dati da verificare" subtitle="Possibili anomalie" icon={<Target className="w-5 h-5" />} />
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-gray-200">
            {sprintDataQuality.issues.map((issue) => (
              <div
                key={issue.id}
                className={`panel-body rounded-lg border ${
                  issue.severity === 'warning'
                    ? 'bg-amber-900/20 border-amber-700 text-amber-200'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                {issue.message}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Sprint Load Model */}
      {hasSprintLoad && (
        <Card className="widget-card widget-accent-blue widget-shine">
          <CardHeader>
            <SectionTitle
              title="Sprint Load (ATL/CTL/TSB)"
              subtitle="Solo sessioni sprint, modello carico forma"
              icon={<LineChartIcon className="w-5 h-5" />}
            />
          </CardHeader>
          <CardBody>
            <div className="w-full min-h-[200px] min-w-0">
              <ResponsiveContainer width="100%" height={200} minWidth={0}>
                <LineChart data={sprintLoadModel.series.slice(-90)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="atl" stroke="#f59e0b" name="ATL" dot={false} />
                  <Line type="monotone" dataKey="ctl" stroke="#10b981" name="CTL" dot={false} />
                  <Line type="monotone" dataKey="tsb" stroke="#60a5fa" name="TSB" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {sprintLoadModel.current && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-200">
                <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                  <div className="text-gray-400 text-xs uppercase">ATL</div>
                  <div className="text-white mt-1 text-lg font-semibold">
                    {sprintLoadModel.current.atl}
                  </div>
                </div>
                <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                  <div className="text-gray-400 text-xs uppercase">CTL</div>
                  <div className="text-white mt-1 text-lg font-semibold">
                    {sprintLoadModel.current.ctl}
                  </div>
                </div>
                <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                  <div className="text-gray-400 text-xs uppercase">TSB</div>
                  <div className="text-white mt-1 text-lg font-semibold">
                    {sprintLoadModel.current.tsb}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Sprint Period Comparison */}
      {hasSprintComparison && (
        <Card className="widget-card widget-accent-emerald widget-shine">
          <CardHeader>
            <SectionTitle title="Confronto Sprint 4 settimane" icon={<CalendarDays className="w-5 h-5" />} />
          </CardHeader>
          <CardBody className="space-y-4 text-sm text-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-xs uppercase">Ultime 4 settimane</div>
                <div className="mt-2 space-y-1">
                  <div>Sessioni: {sprintComparison.current.sessions}</div>
                  <div>Distanza sprint: {sprintComparison.current.distance_m} m</div>
                  <div>RPE medio: {sprintComparison.current.avg_rpe ?? '-'}</div>
                  <div>Load sprint: {sprintComparison.current.load}</div>
                  <div>PB: {sprintComparison.current.pb_count}</div>
                </div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-xs uppercase">4 settimane precedenti</div>
                <div className="mt-2 space-y-1">
                  <div>Sessioni: {sprintComparison.previous.sessions}</div>
                  <div>Distanza sprint: {sprintComparison.previous.distance_m} m</div>
                  <div>RPE medio: {sprintComparison.previous.avg_rpe ?? '-'}</div>
                  <div>Load sprint: {sprintComparison.previous.load}</div>
                  <div>PB: {sprintComparison.previous.pb_count}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs text-gray-200">
              <div className="panel-body bg-slate-800 border border-slate-700 rounded-lg">
                <div className="text-gray-400 uppercase">Sessioni</div>
                <div className="mt-1 font-semibold">{formatPercent(sprintComparison.delta.sessions)}</div>
              </div>
              <div className="panel-body bg-slate-800 border border-slate-700 rounded-lg">
                <div className="text-gray-400 uppercase">Distanza</div>
                <div className="mt-1 font-semibold">{formatPercent(sprintComparison.delta.distance_m)}</div>
              </div>
              <div className="panel-body bg-slate-800 border border-slate-700 rounded-lg">
                <div className="text-gray-400 uppercase">RPE</div>
                <div className="mt-1 font-semibold">{formatPercent(sprintComparison.delta.avg_rpe)}</div>
              </div>
              <div className="panel-body bg-slate-800 border border-slate-700 rounded-lg">
                <div className="text-gray-400 uppercase">Load</div>
                <div className="mt-1 font-semibold">{formatPercent(sprintComparison.delta.load)}</div>
              </div>
              <div className="panel-body bg-slate-800 border border-slate-700 rounded-lg">
                <div className="text-gray-400 uppercase">PB</div>
                <div className="mt-1 font-semibold">{formatPercent(sprintComparison.delta.pb_count)}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[100, 200, 400].map((distance) => (
                <div
                  key={distance}
                  className="panel-body bg-slate-800 border border-slate-700 rounded-lg"
                >
                  <div className="text-gray-400 text-xs uppercase">{distance}m best</div>
                  <div className="mt-1 font-semibold">
                    {sprintComparison.current.bestByDistance?.[distance]
                      ? formatSeconds(sprintComparison.current.bestByDistance[distance])
                      : '-'}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Target Time Bands */}
      {sprintTargetBands.some((band) => band.target_s) && (
        <Card className="widget-card widget-accent-amber widget-shine">
          <CardHeader>
            <SectionTitle title="Target Time Bands" subtitle="Stima 100/200/400m (ultimi 120g)" icon={<Target className="w-5 h-5" />} />
          </CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-200">
            {sprintTargetBands.map((band) => (
              <div
                key={band.distance_m}
                className="panel-body bg-slate-700 rounded-lg border border-slate-600"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="icon-tile icon-tile-sm text-sky-300">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="text-gray-400 text-xs uppercase">{band.distance_m}m</div>
                </div>
                {band.target_s ? (
                  <>
                    <div className="mt-1 text-lg font-semibold">
                      {formatSeconds(band.target_s)}
                    </div>
                    <div className="text-gray-400 text-xs">
                      Range: {formatSeconds(band.low_s)} - {formatSeconds(band.high_s)}
                    </div>
                    <div className="text-gray-400 text-xs">Sample: {band.samples}</div>
                  </>
                ) : (
                  <div className="mt-2 text-gray-500 text-xs">Dati insufficienti</div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Progressione Tempi */}
      {rawData.raceRecords.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Progressione Tempi
          </h2>
          
          {/* Controls Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white">Controlli Vista</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-12">Vista</span>
                  <select
                    value={chartWindow}
                    onChange={(e) => setChartWindow(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white"
                  >
                    <option value="period">Periodo</option>
                    <option value="30d">Ultimi 30g</option>
                    <option value="90d">Ultimi 90g</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-12">Focus</span>
                  <select
                    value={progressionFocus}
                    onChange={(e) => setProgressionFocus(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white"
                  >
                    <option value="all">Tutti i record</option>
                    <option value="races">Solo gare</option>
                    <option value="tests">Solo test</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSmoothProgression((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      smoothProgression ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                    }`}
                  >
                    {smoothProgression ? 'Smooth' : 'Raw'}
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-medium text-white">Distanze & Target</span>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={focusSprintDistances}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50"
                  >
                    60/100/200
                  </button>
                  <button
                    type="button"
                    onClick={showAllDistances}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-600/50"
                  >
                    Mostra tutte
                  </button>
                  {chartAvailableDistances.map((distance) => (
                    <button
                      key={distance}
                      type="button"
                      onClick={() => toggleDistance(distance)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        selectedDistances.includes(distance)
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                      }`}
                    >
                      {distance}m
                    </button>
                  ))}
                </div>
                {selectedDistances.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedDistances.map((distance) => (
                      <label key={`target-${distance}`} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">{distance}m</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={targetTimesByDistance[distance] || ''}
                          value={manualTargets[distance] ?? ''}
                          onChange={(e) =>
                            setManualTargets((prev) => ({ ...prev, [distance]: e.target.value }))
                          }
                          className="w-16 px-2 py-1 bg-slate-700/50 border border-slate-600/50 rounded-lg text-xs text-white"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-medium text-white mb-4">Grafico Progressione</h3>
            <div className="w-full min-h-[300px] min-w-0">
                  {chartProgressionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300} minWidth={0}>
                      <LineChart data={progressionDataWithGoals} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                        <defs>
                          {selectedDistances.map((dist, idx) => (
                            <linearGradient key={dist} id={`gradient-${dist}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.8} />
                              <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.1} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#94a3b8" 
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          style={{ fontFamily: 'inherit' }}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          style={{ fontFamily: 'inherit' }}
                        />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                            border: '1px solid rgba(59, 130, 246, 0.5)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
                          }}
                          labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                          itemStyle={{ color: '#cbd5e1' }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="line"
                        />
                        {selectedDistances.map((dist, idx) => (
                          <Line
                            key={dist}
                            type="monotone"
                            dataKey={`${dist}m`}
                            stroke={COLORS[idx % COLORS.length]}
                            strokeWidth={3}
                            dot={{ fill: COLORS[idx % COLORS.length], r: 5, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 7, strokeWidth: 2, stroke: COLORS[idx % COLORS.length] }}
                            name={`${dist}m`}
                            animationDuration={1000}
                            animationEasing="ease-out"
                          />
                        ))}
                        {selectedDistances.map((dist, idx) =>
                          compareProgression && chartWindow !== 'period' ? (
                            <Line
                              key={`${dist}-prev`}
                              type="monotone"
                              dataKey={`${dist}m_prev`}
                              stroke={COLORS[idx % COLORS.length]}
                              strokeDasharray="6 4"
                              strokeOpacity={0.35}
                              dot={false}
                              name={`${dist}m (prev)`}
                            />
                          ) : null
                        )}
                        {selectedDistances.map((dist, idx) =>
                          targetTimesByDistance[dist] ? (
                            <Line
                              key={`${dist}-goal`}
                              type="monotone"
                              dataKey={`${dist}m_goal`}
                              stroke={COLORS[idx % COLORS.length]}
                              strokeDasharray="2 4"
                              strokeOpacity={0.45}
                              dot={false}
                              name={`${dist}m target`}
                            />
                          ) : null
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-sm text-gray-400 bg-slate-800/40 border border-slate-700 rounded-lg gap-2">
                      <div className="text-sm text-gray-300">
                        Nessun record per i filtri selezionati.
                      </div>
                      <div className="text-xs text-gray-500">
                        Prova a cambiare focus o periodo.
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProgressionFocus('all')}
                          className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-gray-300"
                        >
                          Mostra tutti i record
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setChartWindow('period')
                            setSmoothProgression(false)
                            setCompareProgression(false)
                          }}
                          className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-gray-300"
                        >
                          Reset vista
                        </button>
                      </div>
                    </div>
                  )}
                </div>
          </div>
        </div>
      )}

      {/* Sessioni per tipo */}
      {chartDistributionData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-pink-400" />
              <span className="text-sm font-medium text-white">Distribuzione Tipi</span>
            </div>
            <div className="w-full min-h-[180px] min-w-0">
                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={chartDistributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                    >
                      {chartDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-medium text-white">Filtro Sessioni</span>
            </div>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="icon-tile icon-tile-sm text-sky-300">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <span>Vista</span>
                </div>
                <span className="micro-title">{chartWindowLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="icon-tile icon-tile-sm text-amber-300">
                    <Target className="w-4 h-4" />
                  </div>
                  <span>Focus</span>
                </div>
                <select
                  value={sessionFocus}
                  onChange={(e) => setSessionFocus(e.target.value)}
                  className="px-2 py-1 min-h-[32px] bg-slate-800 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="all">Tutte</option>
                  <option value="sprint">Solo sprint</option>
                </select>
              </div>
              {distributionInsight && (
                <div className="p-2 rounded-lg bg-slate-700/30 text-slate-300 text-xs">{distributionInsight}</div>
              )}
              {weeklyInsight && (
                <div className="p-2 rounded-lg bg-slate-700/30 text-slate-300 text-xs">{weeklyInsight}</div>
              )}
            </div>
          </div>

          {/* Heatmap Settimanale */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">Intensità Settimanale</span>
            </div>
            <div className="space-y-2">
              {chartWeeklyData.slice(-8).map((week) => (
                <div key={week.week} className="flex items-center gap-3">
                  <div className="w-16 text-xs font-mono text-slate-400">{week.week}</div>
                  <div className="flex-1 h-6 bg-slate-700/50 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-orange-500 transition-all"
                      style={{ width: `${week.intensity}%` }}
                    />
                  </div>
                  <div className="text-xs font-semibold text-white w-12">{week.avgRPE} RPE</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RPE vs Performance */}
      {scatterData.length > 0 && selectedDistance && (
        <div className="card-grid-tight lg:grid-cols-3">
          <Card className="widget-card widget-accent-blue widget-shine widget-tint-blue">
          <CardHeader>
            <SectionTitle title="RPE vs Tempo" icon={<Activity className="w-5 h-5" />} />
          </CardHeader>
            <CardBody className="card-stack text-xs text-gray-300">
              <div className="micro-title">Distanza</div>
              {scatterDistances.length > 0 && (
                <select
                  value={selectedDistance}
                  onChange={(e) => setSelectedDistance(parseInt(e.target.value))}
                  className="px-3 py-2 min-h-[44px] bg-slate-700 border border-slate-600 rounded text-sm text-white"
                >
                  {scatterDistances.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}m
                    </option>
                  ))}
                </select>
              )}
              <div className="glass-panel p-3 text-slate-200">
                Scatter tra RPE e tempo per distanza selezionata.
              </div>
            </CardBody>
          </Card>
          <Card className="widget-card widget-accent-blue widget-shine widget-tint-blue lg:col-span-2">
            <CardHeader>
              <SectionTitle title="Grafico RPE" icon={<LineChartIcon className="w-5 h-5" />} />
            </CardHeader>
            <CardBody>
              <div className="w-full min-h-[200px] min-w-0">
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      type="number"
                      dataKey="rpe"
                      name="RPE"
                      stroke="#94a3b8"
                      label={{ value: 'RPE', position: 'insideBottomRight', offset: -5 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="time"
                      name="Tempo"
                      stroke="#94a3b8"
                      label={{ value: 'Secondi', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    />
                    <Scatter
                      data={scatterData.filter((d) => d.distance === selectedDistance)}
                      fill="#3b82f6"
                      name={`${selectedDistance}m`}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Metriche Mensili */}
      {chartMonthlyMetrics.length > 0 && (
        <div className="card-grid-tight lg:grid-cols-3">
          <Card className="widget-card widget-accent-amber widget-shine widget-tint-amber">
          <CardHeader>
            <SectionTitle title="Trend Mensile" icon={<CalendarDays className="w-5 h-5" />} />
          </CardHeader>
            <CardBody className="card-stack text-xs text-gray-300">
              <div className="flex items-center justify-between gap-2">
                <span>Vista</span>
                <span className="micro-title">{chartWindowLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Focus</span>
                <select
                  value={sessionFocus}
                  onChange={(e) => setSessionFocus(e.target.value)}
                  className="px-2 py-1 min-h-[32px] bg-slate-800 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="all">Tutte</option>
                  <option value="sprint">Solo sprint</option>
                </select>
              </div>
              {monthlyInsight && (
                <div className="glass-panel p-3 text-slate-200">{monthlyInsight}</div>
              )}
            </CardBody>
          </Card>
          <Card className="widget-card widget-accent-amber widget-shine widget-tint-amber lg:col-span-2">
          <CardHeader>
            <SectionTitle title="Grafico Mensile" icon={<LineChartIcon className="w-5 h-5" />} />
          </CardHeader>
            <CardBody>
              <div className="w-full min-h-[200px] min-w-0">
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <ComposedChart data={chartMonthlyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" name="Sessioni" />
                    <Line type="monotone" dataKey="avg" stroke="#10b981" name="Tempo Medio" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Timeline Infortuni */}
      {injuryTimeline.length > 0 && (
        <Card className="widget-card widget-accent-pink widget-shine">
          <CardHeader>
            <SectionTitle title="🏥 Timeline Infortuni" icon={<Activity className="w-5 h-5" />} />
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {injuryTimeline.map((injury, idx) => (
                <div key={idx} className="p-4 bg-slate-700 rounded-lg border border-slate-600">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-white">{injury.injury_type}</h3>
                      <p className="text-sm text-gray-400">{injury.body_part}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-sm font-bold ${
                        injury.severity === 'minor'
                          ? 'bg-yellow-600'
                          : injury.severity === 'moderate'
                            ? 'bg-orange-600'
                            : 'bg-red-600'
                      } text-white`}
                    >
                      {injury.severity}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {injury.start_date} → {injury.end_date || 'Attivo'} ({injury.duration} giorni)
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Record durante infortunio: {injury.affectedRecords}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Suggerimento Adattivo AI */}
      <Card className="widget-card widget-accent-emerald widget-shine">
        <CardHeader className="flex items-center justify-between">
          <SectionTitle
            title="Adatta la prossima sessione"
            subtitle="Analizza stanchezza e tempi recenti"
          />
          <button
            onClick={handleAdaptiveSuggestion}
            disabled={adaptiveLoading || !rawData.sessions.length}
            className="px-4 py-2 min-h-[44px] btn-primary"
          >
            {adaptiveLoading ? 'Analisi...' : 'Suggerisci'}
          </button>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            <textarea
              value={adaptiveFocus}
              onChange={(e) => setAdaptiveFocus(e.target.value)}
              className="w-full h-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-base text-white"
              placeholder="Obiettivo o allenamento previsto (opzionale)"
            />
          {adaptiveError && (
            <div className="panel-body text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg">
              {adaptiveError}
            </div>
          )}
          {adaptiveResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-200">
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-xs uppercase">Segnale</div>
                <div className="text-white mt-1">{adaptiveResult.signal}</div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-xs uppercase">Suggerimento</div>
                <div className="text-white mt-1">{adaptiveResult.suggestion}</div>
              </div>
              <div className="panel-body bg-slate-700 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-xs uppercase">Recupero</div>
                <div className="text-white mt-1">{adaptiveResult.recovery}</div>
              </div>
            </div>
          )}
          {!adaptiveResult && !adaptiveLoading && !adaptiveError && (
            <div className="panel-body text-sm text-gray-500 bg-slate-800/40 border border-slate-700 rounded-lg">
              Premi "Suggerisci" per un check rapido su carico e possibili modifiche.
            </div>
          )}
          </div>
        </CardBody>
      </Card>

      {/* Empty State */}
      {progressionData.length === 0 && (
        <Card className="text-center widget-card widget-accent-blue widget-shine">
          <CardBody className="py-10 sm:py-12">
            <EmptyState
              icon={<BarChart4 className="w-6 h-6 text-primary-300" />}
              title="Nessun dato disponibile per il periodo selezionato"
              description="Prova ad allargare il periodo o inserire nuovi allenamenti."
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
