import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from '@/crm/router'
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  KeyRound,
  Landmark,
  LayoutList,
  Pencil,
  Plus,
  Rows3,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { useSchemes } from '../context/SchemeContext'
import { usePlots } from '../context/PlotContext'
import { useLeads } from '../context/LeadContext'
import { useBookings } from '../context/BookingContext'
import { useBrokers } from '../context/BrokerContext'
import { usePayments } from '../context/PaymentContext'
import { useOtherPayments } from '../context/OtherPaymentContext'
import { useAuth } from '../context/AuthContext'
import {
  assessHandover,
  isHandoverReady,
  isBookingHandedOver,
} from '../types/payments'
import {
  bookingFinancialSummary,
  EMPTY_BOOKING_FINANCE,
} from '../lib/bookingFinance'
import { HandoverDialog } from '../components/booking/HandoverDialog'
import { buildScheduleInputFromBooking } from '../lib/bookingPaymentSchedule'
import { buildHandoverOtherContext } from '../lib/handoverOther'
import {
  BOOKING_SORT_LABELS,
  collectFinancialYears,
  financialYearKey,
  financialYearLabel,
  parseSmartQuery,
  type BookingSortKey,
} from '../lib/bookingFilters'
import { calculatePlotPrice } from '../lib/pricing'
import { formatCurrency, formatNumber } from '../lib/schemes'
import {
  chequeGstPercent,
  splitGrossBankAmount,
} from '../lib/chequeGst'
import { AddBrokerPanel } from '../components/AddBrokerPanel'
import { LandPaymentDialog } from '../components/booking/LandPaymentDialog'
import { ConstructionPaymentDialog } from '../components/booking/ConstructionPaymentDialog'
import {
  FIXED_CHEQUE_GST_PERCENT,
  normalizePaymentPlans,
  type SchemePaymentPlan,
} from '../types/scheme'
import {
  MIN_CHEQUE_PERCENT,
  constructionCashChequeSplit,
  landCashChequeSplit,
  type DealPayableSplit,
} from '../lib/dealFinance'
import {
  AGENCY_RELATION_LABELS,
  BROKER_ORG_LABELS,
  BOOKING_STATUS_LABELS,
  BOOKING_TOKEN_MODE_LABELS,
  addDays,
  bookingPlotIds,
  brokerRecordToInfo,
  createEmptyBrokerInfo,
  createEmptyConstructionPayment,
  createEmptyPaymentPlanOverride,
  createEmptyPlotLine,
  normalizeBookingRecord,
  bookingHasConstruction,
  canAddConstructionToBooking,
  constructionPlotCount,
  rollupConstructionPayment,
  rollupLandPayment,
  todayISO,
  type BookingPaymentPlanOverride,
  type BookingPlotLine,
  type BookingRecord,
  type BookingStatus,
  type BookingTokenMode,
  type BrokerInfo,
  type BrokerageType,
  type ConstructionPaymentConfig,
  type LandPaymentConfig,
} from '../types/sales'

const BOOKING_STEPS = ['Details', 'Payment plan', 'Review'] as const
import {
  Button,
  Card,
  Field,
  Input,
  MultiSelectDropdown,
  Select,
  Textarea,
  Toggle,
} from '../components/ui/Form'

const STATUSES = Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[]

function schemeLabel(
  schemes: { id: string; schemeName?: string; schemeCode?: string }[],
  id: string,
) {
  const s = schemes.find((x) => x.id === id)
  return s?.schemeName || s?.schemeCode || '—'
}

function plotLabel(
  plots: { id: string; plotNumber?: string | number }[],
  id: string,
) {
  const p = plots.find((x) => x.id === id)
  return p ? `Plot ${p.plotNumber}` : '—'
}

function plotLabels(
  plots: { id: string; plotNumber?: string | number }[],
  ids: string[],
) {
  if (!ids.length) return '—'
  return ids.map((id) => plotLabel(plots, id)).join(', ')
}

function plotLinesSummary(
  plots: { id: string; plotNumber?: string | number }[],
  lines: BookingPlotLine[],
) {
  if (!lines.length) return '—'
  return lines
    .map((l) => {
      const base = plotLabel(plots, l.plotId)
      const unit =
        l.constructionPayment?.configured &&
        (l.constructionPayment.unitType || l.constructionPayment.unitLabel)
          ? ` (${String(
              l.constructionPayment.unitType ||
                l.constructionPayment.unitLabel,
            ).toUpperCase()})`
          : ''
      return `${base}${unit}`
    })
    .join(', ')
}

function statusTone(status: BookingStatus) {
  if (status === 'booked') return 'bg-brand-soft text-brand'
  if (status === 'completed') return 'bg-success-soft text-success'
  if (status === 'cancelled') return 'bg-surface-2 text-ink-faint'
  return 'bg-warn-soft text-warn'
}

export function BookingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const isNew = location.pathname.endsWith('/new') || params.has('lead')

  const { schemes, getScheme } = useSchemes()
  const { getPlotsByScheme, plots } = usePlots()
  const { getLead, updateLead } = useLeads()
  const {
    bookings,
    saveBooking,
    updateBooking,
    deleteBooking,
    getActiveBookingForPlot,
  } = useBookings()
  const { user } = useAuth()
  const isAccountant = user?.role === 'accountant'
  const isAdmin = user?.role === 'admin'
  const canTakeBookings = !isAccountant
  const canEditBookings = !isAccountant
  const canHandover = isAdmin || isAccountant
  const { brokers, getBroker } = useBrokers()
  const {
    installments,
    receipts,
    createPlan,
    ensureConstructionSchedule,
    getInstallmentsByBooking,
  } = usePayments()
  const { receipts: otherReceipts } = useOtherPayments()

  const otherCtx = (b: BookingRecord) =>
    buildHandoverOtherContext(b, getScheme(b.schemeId), plots, otherReceipts)

  const leadIdParam = params.get('lead')
  const lead = leadIdParam ? getLead(leadIdParam) : undefined

  const [showForm, setShowForm] = useState(
    canTakeBookings && (isNew || Boolean(lead)),
  )
  /** When set, form updates this booking instead of creating a new one */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<
    'create' | 'edit' | 'add-construction'
  >('create')
  const [listQuery, setListQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookingStatus[]>([])
  const [schemeFilter, setSchemeFilter] = useState('all')
  const [plotFilter, setPlotFilter] = useState('all')
  const [fyFilter, setFyFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<BookingSortKey>('updated')
  const [needsConstructionOnly, setNeedsConstructionOnly] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [listDensity, setListDensity] = useState<'compact' | 'comfortable'>(
    'compact',
  )
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [schemeId, setSchemeId] = useState(
    params.get('scheme') || lead?.schemeId || schemes[0]?.id || '',
  )
  const initialPlot =
    params.get('plot') || lead?.plotId || ''
  const [plotIds, setPlotIds] = useState<string[]>(
    initialPlot ? [initialPlot] : [],
  )
  const [plotLines, setPlotLines] = useState<BookingPlotLine[]>(() =>
    initialPlot ? [createEmptyPlotLine(initialPlot)] : [],
  )
  const [configPlotId, setConfigPlotId] = useState(initialPlot)
  const [customerName, setCustomerName] = useState(lead?.name ?? '')
  const [customerPhone, setCustomerPhone] = useState(lead?.phone ?? '')
  const [customerEmail, setCustomerEmail] = useState(lead?.email ?? '')
  const [salesPerson, setSalesPerson] = useState(user?.name ?? '')
  const [viaBroker, setViaBroker] = useState(false)

  useEffect(() => {
    if (!editingId && user?.name) {
      setSalesPerson(user.name)
    }
  }, [user?.name, editingId])
  const [brokerId, setBrokerId] = useState<string>('')
  const [broker, setBroker] = useState<BrokerInfo>(() => createEmptyBrokerInfo())
  const [showAddBroker, setShowAddBroker] = useState(false)
  const [propertyRegistration, setPropertyRegistration] = useState(true)
  const [bookingAmount, setBookingAmount] = useState('')
  const [bookingAmountMode, setBookingAmountMode] =
    useState<BookingTokenMode | ''>('')
  const [status, setStatus] = useState<BookingStatus>('reserved')
  const [bookingDate, setBookingDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [handoverBookingId, setHandoverBookingId] = useState<string | null>(
    null,
  )
  const [formStep, setFormStep] = useState(0)
  const landPayment = useMemo(
    () => rollupLandPayment(plotLines),
    [plotLines],
  )
  const constructionPayment = useMemo(
    () => rollupConstructionPayment(plotLines),
    [plotLines],
  )
  const constructionConfiguredCount = constructionPlotCount(plotLines)
  const hasMinConstruction = constructionConfiguredCount >= 1
  /** UI: user opened construction section (or already has / is adding construction) */
  const [showConstructionUi, setShowConstructionUi] = useState(false)
  const includeConstruction =
    showConstructionUi || hasMinConstruction || formMode === 'add-construction'
  const [landDialogOpen, setLandDialogOpen] = useState(false)
  const [constructionDialogOpen, setConstructionDialogOpen] = useState(false)
  const [landPaymentPlanId, setLandPaymentPlanId] = useState('')
  const [constructionPaymentPlanId, setConstructionPaymentPlanId] = useState('')
  const [landPaymentPlanCustom, setLandPaymentPlanCustom] = useState(false)
  const [landPaymentPlanOverride, setLandPaymentPlanOverride] =
    useState<BookingPaymentPlanOverride>(() =>
      createEmptyPaymentPlanOverride(),
    )
  const [constructionPaymentPlanCustom, setConstructionPaymentPlanCustom] =
    useState(false)
  const [constructionPaymentPlanOverride, setConstructionPaymentPlanOverride] =
    useState<BookingPaymentPlanOverride>(() =>
      createEmptyPaymentPlanOverride(),
    )
  const [installmentDueDate, setInstallmentDueDate] = useState(() =>
    todayISO(),
  )

  const setBrokerField = <K extends keyof BrokerInfo>(
    key: K,
    value: BrokerInfo[K],
  ) => setBroker((prev) => ({ ...prev, [key]: value }))

  const applyBroker = (id: string) => {
    setBrokerId(id)
    const record = getBroker(id)
    if (!record) return
    setBroker((prev) =>
      brokerRecordToInfo(record, {
        brokerageType: prev.brokerageType,
        brokerageValue: prev.brokerageValue,
      }),
    )
  }

  useEffect(() => {
    if (!canTakeBookings && (isNew || params.has('lead'))) {
      setShowForm(false)
      navigate('/bookings', { replace: true })
    }
  }, [canTakeBookings, isNew, params, navigate])

  useEffect(() => {
    if (
      isAccountant &&
      showForm &&
      formMode !== 'add-construction'
    ) {
      setShowForm(false)
      setEditingId(null)
      setFormMode('create')
    }
  }, [isAccountant, showForm, formMode])

  const scheme = getScheme(schemeId)
  const schemePaymentPlans = useMemo(
    () => (scheme ? normalizePaymentPlans(scheme) : []),
    [scheme],
  )
  const landMasterPlan =
    schemePaymentPlans.find((p) => p.id === landPaymentPlanId) ||
    schemePaymentPlans[0]
  const landPaymentPlan: SchemePaymentPlan | undefined = landMasterPlan
    ? {
        ...(landPaymentPlanCustom
          ? {
              ...landMasterPlan,
              name:
                landPaymentPlanOverride.name ||
                `${landMasterPlan.name} (custom)`,
              months: landPaymentPlanOverride.months || landMasterPlan.months,
              chequePaymentPercent:
                landPaymentPlanOverride.chequePaymentPercent ||
                landMasterPlan.chequePaymentPercent,
            }
          : landMasterPlan),
        chequeGstPercent: FIXED_CHEQUE_GST_PERCENT,
      }
    : undefined
  const constructionMasterPlan =
    schemePaymentPlans.find((p) => p.id === constructionPaymentPlanId) ||
    schemePaymentPlans[0]
  const constructionPaymentPlan: SchemePaymentPlan | undefined =
    constructionMasterPlan
      ? {
          ...(constructionPaymentPlanCustom
            ? {
                ...constructionMasterPlan,
                name:
                  constructionPaymentPlanOverride.name ||
                  `${constructionMasterPlan.name} (custom)`,
                months:
                  constructionPaymentPlanOverride.months ||
                  constructionMasterPlan.months,
                chequePaymentPercent:
                  constructionPaymentPlanOverride.chequePaymentPercent ||
                  constructionMasterPlan.chequePaymentPercent,
              }
            : constructionMasterPlan),
          chequeGstPercent: FIXED_CHEQUE_GST_PERCENT,
        }
      : undefined

  const seedLandCustomFromMaster = (plan?: SchemePaymentPlan) => {
    if (!plan) return
    setLandPaymentPlanOverride(
      createEmptyPaymentPlanOverride({
        name: `${plan.name} (custom)`,
        months: plan.months,
        chequePaymentPercent: plan.chequePaymentPercent,
      }),
    )
  }

  const seedConstructionCustomFromMaster = (plan?: SchemePaymentPlan) => {
    if (!plan) return
    setConstructionPaymentPlanOverride(
      createEmptyPaymentPlanOverride({
        name: `${plan.name} (custom)`,
        months: plan.months,
        chequePaymentPercent: plan.chequePaymentPercent,
      }),
    )
  }

  useEffect(() => {
    if (!schemePaymentPlans.length) {
      setLandPaymentPlanId('')
      setConstructionPaymentPlanId('')
      return
    }
    if (!schemePaymentPlans.some((p) => p.id === landPaymentPlanId)) {
      setLandPaymentPlanId(schemePaymentPlans[0].id)
    }
    if (!schemePaymentPlans.some((p) => p.id === constructionPaymentPlanId)) {
      setConstructionPaymentPlanId(schemePaymentPlans[0].id)
    }
  }, [schemePaymentPlans, landPaymentPlanId, constructionPaymentPlanId])
  const schemePlots = useMemo(() => {
    return getPlotsByScheme(schemeId).filter((p) => {
      // Always keep plots already on this booking (edit flow)
      if (plotIds.includes(p.id)) return true
      // Only offer free inventory
      if (p.status !== 'available') return false
      // Hide if another active booking holds them
      return !getActiveBookingForPlot(p.id, editingId || undefined)
    })
  }, [
    getPlotsByScheme,
    schemeId,
    plotIds,
    getActiveBookingForPlot,
    editingId,
  ])

  const heldPlotHint = useMemo(() => {
    const held = plotIds
      .map((id) => {
        const holder = getActiveBookingForPlot(id, editingId || undefined)
        const plot = plots.find((p) => p.id === id)
        if (!holder || !plot) return null
        return `Plot ${plot.plotNumber} → ${holder.bookingCode} (${holder.customerName})`
      })
      .filter(Boolean)
    return held.length ? held.join(' · ') : ''
  }, [plotIds, getActiveBookingForPlot, editingId, plots])

  const selectedPlot = plots.find((p) => p.id === (configPlotId || plotIds[0]))
  const quoteTotal = useMemo(() => {
    if (!scheme || plotIds.length === 0) return null
    let total = 0
    let baseAmount = 0
    let roadPremiumAmount = 0
    let developmentChargeAmount = 0
    let area = 0
    for (const id of plotIds) {
      const plot = plots.find((p) => p.id === id)
      if (!plot) continue
      const q = calculatePlotPrice(scheme, plot)
      if (!q) continue
      total += q.total
      baseAmount += q.baseAmount
      roadPremiumAmount += q.roadPremiumAmount
      developmentChargeAmount += q.developmentChargeAmount
      area += Number(plot.sbuAreaSqYards) || 0
    }
    if (total <= 0) return null
    return {
      total,
      baseAmount,
      roadPremiumAmount,
      developmentChargeAmount,
      area,
    }
  }, [scheme, plotIds, plots])
  const quote = quoteTotal

  const syncPlotSelection = (nextIds: string[]) => {
    setPlotIds(nextIds)
    setPlotLines((prev) => {
      const map = new Map(prev.map((l) => [l.plotId, l]))
      return nextIds.map(
        (id) => map.get(id) || createEmptyPlotLine(id),
      )
    })
    setConfigPlotId((cur) =>
      nextIds.includes(cur) ? cur : nextIds[0] || '',
    )
  }

  const patchPlotLine = (
    plotId: string,
    patch: Partial<BookingPlotLine>,
  ) => {
    setPlotLines((prev) =>
      prev.map((l) => (l.plotId === plotId ? { ...l, ...patch } : l)),
    )
  }

  const validUntil = useMemo(() => {
    const days =
      status === 'reserved'
        ? Number(scheme?.reservationValidity || 7)
        : Number(scheme?.bookingValidityDays || 15)
    return addDays(bookingDate, Number.isFinite(days) ? days : 7)
  }, [
    bookingDate,
    scheme?.bookingValidityDays,
    scheme?.reservationValidity,
    status,
  ])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const applyBookingStatus = (id: string, status: BookingStatus) => {
    const existing = bookings.find((b) => b.id === id)
    if (!existing) return
    if (status !== 'completed' && existing.handoverAt) {
      updateBooking(id, {
        status,
        handoverAt: null,
        handoverDate: null,
        handoverById: null,
        handoverByName: '',
        handoverNote: '',
      })
      return
    }
    updateBooking(id, { status })
  }

  const confirmHandover = (input: { handoverDate: string; note: string }) => {
    if (!handoverBookingId || !user) return
    const booking = bookings.find((b) => b.id === handoverBookingId)
    if (!booking) return
    const inst = getInstallmentsByBooking(booking.id)
    const finance = financeByBooking.get(booking.id)
    if (
      !isHandoverReady(
        booking,
        inst,
        otherCtx(booking),
        finance?.gstPending ?? 0,
      )
    ) {
      flash(
        'Land, construction, GST, and other payments must be complete before handover',
      )
      setHandoverBookingId(null)
      return
    }
    updateBooking(handoverBookingId, {
      status: 'completed',
      handoverAt: new Date().toISOString(),
      handoverDate: input.handoverDate,
      handoverById: user.id,
      handoverByName: user.name,
      handoverNote: input.note,
    })
    setHandoverBookingId(null)
    flash('Plot handed over — booking completed, plot sold')
  }

  const undoHandover = (id: string) => {
    if (!isAdmin) {
      flash('Only admin can undo handover')
      return
    }
    if (
      !window.confirm(
        'Undo handover? Booking returns to Booked and plot(s) to booked status.',
      )
    ) {
      return
    }
    updateBooking(id, {
      status: 'booked',
      handoverAt: null,
      handoverDate: null,
      handoverById: null,
      handoverByName: '',
      handoverNote: '',
    })
    flash('Handover undone')
  }

  const handoverBooking = handoverBookingId
    ? bookings.find((b) => b.id === handoverBookingId)
    : undefined

  const bookingPropertyLabel = (b: (typeof bookings)[0]) =>
    `${schemeName(b.schemeId)} · ${plotLabels(plots, bookingPlotIds(b))}`

  const plotById = useMemo(() => {
    const map = new Map(plots.map((p) => [p.id, p]))
    return map
  }, [plots])

  const financialYears = useMemo(
    () => collectFinancialYears(bookings),
    [bookings],
  )

  const plotsForFilter = useMemo(() => {
    const list =
      schemeFilter === 'all'
        ? plots
        : plots.filter((p) => p.schemeId === schemeFilter)
    return [...list].sort((a, b) =>
      String(a.plotNumber).localeCompare(String(b.plotNumber), undefined, {
        numeric: true,
      }),
    )
  }, [plots, schemeFilter])

  const financeByBooking = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof bookingFinancialSummary>
    >()
    for (const b of bookings) {
      const bookingInst = installments.filter((i) => i.bookingId === b.id)
      map.set(
        b.id,
        bookingFinancialSummary(
          b,
          bookingInst,
          receipts,
          getScheme(b.schemeId),
        ),
      )
    }
    return map
  }, [bookings, getScheme, installments, receipts])

  const smartQuery = useMemo(() => parseSmartQuery(listQuery), [listQuery])

  const filteredBookings = useMemo(() => {
    const statusSet = new Set<BookingStatus>(statusFilter)
    if (smartQuery.status) statusSet.add(smartQuery.status)

    const fySet = new Set<string>(fyFilter)
    if (smartQuery.fy) fySet.add(smartQuery.fy)

    const effectivePlotToken = smartQuery.plot || ''
    const constructionMode = smartQuery.construction
      ? smartQuery.construction
      : needsConstructionOnly
        ? 'missing'
        : null

    const list = bookings.filter((b) => {
      if (statusSet.size > 0 && !statusSet.has(b.status)) return false
      if (schemeFilter !== 'all' && b.schemeId !== schemeFilter) return false
      if (plotFilter !== 'all' && !bookingPlotIds(b).includes(plotFilter))
        return false

      if (fySet.size > 0) {
        const fy = financialYearKey(b.bookingDate)
        if (!fySet.has(fy)) return false
      }

      if (constructionMode === 'missing') {
        if (!canAddConstructionToBooking(b)) return false
      } else if (constructionMode === 'yes') {
        if (!bookingHasConstruction(b)) return false
      } else if (constructionMode === 'no') {
        if (bookingHasConstruction(b)) return false
      }

      const ids = bookingPlotIds(b)
      const plotNumber = ids
        .map((id) => String(plotById.get(id)?.plotNumber || ''))
        .join(' ')
        .toLowerCase()
      const plotLabelText = plotLabels(plots, ids).toLowerCase()

      if (effectivePlotToken) {
        const token = effectivePlotToken.toLowerCase()
        if (
          !plotNumber.includes(token) &&
          !plotLabelText.includes(token) &&
          !plotNumber.replace(/\s+/g, '').includes(token.replace(/\s+/g, ''))
        ) {
          return false
        }
      }

      if (smartQuery.textTokens.length) {
        const hay = [
          b.bookingCode,
          b.customerName,
          b.customerPhone,
          b.customerEmail,
          b.salesPerson,
          b.broker?.fullName,
          b.broker?.firmName,
          b.notes,
          schemeLabel(schemes, b.schemeId),
          plotLabelText,
          plotNumber,
          b.bookingDate,
          financialYearLabel(financialYearKey(b.bookingDate)),
        ]
          .join(' ')
          .toLowerCase()
        if (!smartQuery.textTokens.every((t) => hay.includes(t))) return false
      }

      return true
    })

    const cmp = (a: BookingRecord, b: BookingRecord) => {
      if (sortBy === 'customer') {
        return a.customerName.localeCompare(b.customerName)
      }
      if (sortBy === 'bookingDate') {
        return (b.bookingDate || '').localeCompare(a.bookingDate || '')
      }
      if (sortBy === 'dealValue') {
        const av = financeByBooking.get(a.id)?.total || 0
        const bv = financeByBooking.get(b.id)?.total || 0
        return bv - av
      }
      if (sortBy === 'pending') {
        const av = financeByBooking.get(a.id)?.pending || 0
        const bv = financeByBooking.get(b.id)?.pending || 0
        return bv - av
      }
      if (sortBy === 'plot') {
        const an = String(
          bookingPlotIds(a)
            .map((id) => plotById.get(id)?.plotNumber || '')
            .join(' '),
        )
        const bn = String(
          bookingPlotIds(b)
            .map((id) => plotById.get(id)?.plotNumber || '')
            .join(' '),
        )
        return an.localeCompare(bn, undefined, { numeric: true })
      }
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    }

    return [...list].sort(cmp)
  }, [
    bookings,
    smartQuery,
    statusFilter,
    schemeFilter,
    plotFilter,
    fyFilter,
    needsConstructionOnly,
    sortBy,
    schemes,
    plots,
    plotById,
    financeByBooking,
  ])

  useEffect(() => {
    setPage(1)
  }, [
    listQuery,
    statusFilter,
    schemeFilter,
    plotFilter,
    fyFilter,
    needsConstructionOnly,
    sortBy,
    pageSize,
  ])

  useEffect(() => {
    if (schemeFilter !== 'all' && plotFilter !== 'all') {
      const plot = plotById.get(plotFilter)
      if (plot && plot.schemeId !== schemeFilter) setPlotFilter('all')
    }
  }, [schemeFilter, plotFilter, plotById])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / pageSize),
  )
  const currentPage = Math.min(page, totalPages)
  const pagedBookings = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredBookings.slice(start, start + pageSize)
  }, [filteredBookings, currentPage, pageSize])

  const needsConstructionCount = useMemo(
    () => bookings.filter((b) => canAddConstructionToBooking(b)).length,
    [bookings],
  )

  const activeFilterCount = [
    statusFilter.length > 0,
    schemeFilter !== 'all',
    plotFilter !== 'all',
    fyFilter.length > 0,
    needsConstructionOnly,
    Boolean(listQuery.trim()),
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setListQuery('')
    setStatusFilter([])
    setSchemeFilter('all')
    setPlotFilter('all')
    setFyFilter([])
    setNeedsConstructionOnly(false)
  }

  const statusFilterOptions = useMemo(
    () =>
      STATUSES.map((s) => ({
        value: s,
        label: BOOKING_STATUS_LABELS[s],
        count: bookings.filter((b) => b.status === s).length,
      })),
    [bookings],
  )

  const fyFilterOptions = useMemo(
    () =>
      financialYears.map((fy) => ({
        value: fy,
        label: financialYearLabel(fy),
        count: bookings.filter((b) => financialYearKey(b.bookingDate) === fy)
          .length,
      })),
    [bookings, financialYears],
  )

  const financialSummary = useMemo(() => {
    let total = 0
    let collected = 0
    let pending = 0
    for (const b of filteredBookings) {
      if (b.status === 'cancelled') continue
      const f = financeByBooking.get(b.id)
      if (!f) continue
      total += f.total
      collected += f.collected
      pending += f.pending
    }
    return { total, collected, pending }
  }, [filteredBookings, financeByBooking])

  const validateDetailsStep = () => {
    if (
      !schemeId ||
      plotIds.length === 0 ||
      !customerName.trim() ||
      !customerPhone.trim()
    ) {
      flash('Customer, scheme, and at least one plot are required')
      return false
    }
    if (!salesPerson.trim()) {
      flash('Sales person is required')
      return false
    }
    if (!landPaymentPlan) {
      flash('Select a land payment plan')
      return false
    }
    if (viaBroker) {
      if (!brokerId) {
        flash('Select or add a broker')
        return false
      }
      if (!broker.brokerageValue.trim()) {
        flash('Brokerage amount or percent is required')
        return false
      }
    }
    const amount =
      bookingAmount.trim() || scheme?.minimumBookingAmount || ''
    if (!amount) {
      flash('Booking amount is required')
      return false
    }
    if (Number(amount) > 0 && !bookingAmountMode) {
      flash('Select whether the token was paid in cash or cheque')
      return false
    }
    return true
  }

  const goNext = () => {
    if (formStep === 0 && !validateDetailsStep()) return
    if (formStep === 1) {
      if (!landPaymentPlan) {
        flash('Select a land payment plan')
        return
      }
      if (landPaymentPlanCustom) {
        const months = Number(landPaymentPlanOverride.months)
        if (!Number.isFinite(months) || months < 1) {
          flash('Custom land plan: enter duration in months')
          return
        }
        const cheque = Number(landPaymentPlanOverride.chequePaymentPercent)
        if (
          !Number.isFinite(cheque) ||
          cheque < MIN_CHEQUE_PERCENT ||
          cheque > 100
        ) {
          flash(
            `Custom land plan: cheque % must be ${MIN_CHEQUE_PERCENT}–100`,
          )
          return
        }
      }
      if (!landPayment.configured) {
        flash('Land payment is compulsory — configure land for each plot')
        return
      }
      if (
        !plotLines.every((l) => l.landPayment.configured)
      ) {
        flash('Configure land payment for every selected plot')
        return
      }
      if (includeConstruction) {
        if (!constructionPaymentPlan) {
          flash('Select a construction payment plan')
          return
        }
        if (!hasMinConstruction) {
          flash(
            'Configure construction on at least one plot (others can stay land-only)',
          )
          return
        }
        if (constructionPaymentPlanCustom) {
          const months = Number(constructionPaymentPlanOverride.months)
          if (!Number.isFinite(months) || months < 1) {
            flash('Custom construction plan: enter duration in months')
            return
          }
          const cheque = Number(
            constructionPaymentPlanOverride.chequePaymentPercent,
          )
          if (
            !Number.isFinite(cheque) ||
            cheque < MIN_CHEQUE_PERCENT ||
            cheque > 100
          ) {
            flash(
              `Custom construction plan: cheque % must be ${MIN_CHEQUE_PERCENT}–100`,
            )
            return
          }
        }
      }
      if (!installmentDueDate) {
        flash('Enter installment due date')
        return
      }
    }
    setFormStep((s) => Math.min(2, s + 1))
  }

  const handleSave = () => {
    if (isAccountant && formMode !== 'add-construction') {
      flash('Accounts can only add construction to existing bookings')
      return
    }
    if (!canTakeBookings && formMode === 'create') {
      flash('Accounts cannot create new bookings')
      return
    }
    if (isAccountant && formMode === 'add-construction') {
      if (!hasMinConstruction) {
        flash('Configure construction on at least one plot')
        setFormStep(1)
        return
      }
    }
    if (heldPlotHint) {
      flash(
        `Cannot save — plot already on another booking. ${heldPlotHint}`,
      )
      setFormStep(0)
      return
    }
    if (!validateDetailsStep()) {
      setFormStep(0)
      return
    }
    if (!landPayment.configured || !plotLines.every((l) => l.landPayment.configured)) {
      flash('Configure land payment for every selected plot')
      setFormStep(1)
      return
    }
    if (!landPaymentPlan) {
      flash('Select a land payment plan')
      setFormStep(1)
      return
    }
    if (landPaymentPlanCustom) {
      const months = Number(landPaymentPlanOverride.months)
      if (!Number.isFinite(months) || months < 1) {
        flash('Custom land plan: enter duration in months')
        setFormStep(1)
        return
      }
      const cheque = Number(landPaymentPlanOverride.chequePaymentPercent)
      if (
        !Number.isFinite(cheque) ||
        cheque < MIN_CHEQUE_PERCENT ||
        cheque > 100
      ) {
        flash(
          `Custom land plan: cheque % must be ${MIN_CHEQUE_PERCENT}–100`,
        )
        setFormStep(1)
        return
      }
    }
    if (includeConstruction) {
      if (!constructionPaymentPlan) {
        flash('Select a construction payment plan')
        setFormStep(1)
        return
      }
      if (!hasMinConstruction) {
        flash(
          'Configure construction on at least one plot (others can stay land-only)',
        )
        setFormStep(1)
        return
      }
      if (constructionPaymentPlanCustom) {
        const months = Number(constructionPaymentPlanOverride.months)
        if (!Number.isFinite(months) || months < 1) {
          flash('Custom construction plan: enter duration in months')
          setFormStep(1)
          return
        }
        const cheque = Number(
          constructionPaymentPlanOverride.chequePaymentPercent,
        )
        if (
          !Number.isFinite(cheque) ||
          cheque < MIN_CHEQUE_PERCENT ||
          cheque > 100
        ) {
          flash(
            `Custom construction plan: cheque % must be ${MIN_CHEQUE_PERCENT}–100`,
          )
          setFormStep(1)
          return
        }
      }
    } else if (formMode === 'create' || formMode === 'edit') {
      // Construction may be added later — at least one plot required when they do
    }
    if (!installmentDueDate) {
      flash('Enter installment due date')
      setFormStep(1)
      return
    }

    const amount =
      bookingAmount.trim() || scheme?.minimumBookingAmount || ''
    if (Number(amount) > 0 && !bookingAmountMode) {
      flash('Select whether the token was paid in cash or cheque')
      setFormStep(0)
      return
    }

    const construction: ConstructionPaymentConfig = hasMinConstruction
      ? { ...constructionPayment, included: true }
      : createEmptyConstructionPayment()

    const dealTotal =
      landPayment.totalValue + (construction.totalValue || 0)
    const existing = editingId
      ? bookings.find((b) => b.id === editingId)
      : undefined

    const normalizedInput = normalizeBookingRecord({
      schemeId,
      plotId: plotIds[0] || '',
      plotIds,
      plotLines,
      leadId: existing?.leadId ?? lead?.id ?? null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      salesPerson: (
        editingId
          ? salesPerson || user?.name || ''
          : user?.name || salesPerson || ''
      ).trim(),
      viaBroker,
      brokerId: viaBroker ? brokerId : null,
      broker: viaBroker
        ? {
            ...broker,
            brokerageValue: broker.brokerageValue.trim(),
          }
        : createEmptyBrokerInfo(),
      propertyRegistration,
      landPayment,
      constructionPayment: construction,
      landPaymentPlanId: landPaymentPlan?.id ?? null,
      constructionPaymentPlanId: construction.configured
        ? constructionPaymentPlan?.id ?? null
        : null,
      paymentPlanId: landPaymentPlan?.id ?? null,
      landPaymentPlanCustom,
      landPaymentPlanOverride: landPaymentPlanCustom
        ? createEmptyPaymentPlanOverride(landPaymentPlanOverride)
        : null,
      constructionPaymentPlanCustom: construction.configured
        ? constructionPaymentPlanCustom
        : false,
      constructionPaymentPlanOverride:
        construction.configured && constructionPaymentPlanCustom
          ? createEmptyPaymentPlanOverride(constructionPaymentPlanOverride)
          : null,
      landInstallmentDueDate: installmentDueDate,
      constructionInstallmentDueDate: construction.configured
        ? installmentDueDate
        : '',
      bookingAmount: amount,
      bookingAmountMode:
        Number(amount) > 0 && bookingAmountMode
          ? bookingAmountMode
          : null,
      quotedPrice: String(dealTotal || quote?.total || ''),
      bookingDate,
      validUntil,
      status,
      notes: notes.trim(),
      handoverAt: existing?.handoverAt ?? null,
      handoverDate: existing?.handoverDate ?? null,
      handoverById: existing?.handoverById ?? null,
      handoverByName: existing?.handoverByName ?? '',
      handoverNote: existing?.handoverNote ?? '',
    })

    let record
    try {
      record = saveBooking(normalizedInput, editingId || undefined)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not save booking')
      return
    }

    if (!editingId && lead) {
      updateLead(lead.id, {
        status: 'converted',
        plotId: plotIds[0] || null,
        followUpOn: null,
        followUpNote: '',
      })
    }

    const existingInst = getInstallmentsByBooking(record.id)
    const hasPaid = existingInst.some((i) => i.paidAmount > 0)
    const scheduleInput = buildScheduleInputFromBooking(
      record,
      getScheme(record.schemeId),
    )
    if (scheduleInput) {
      if (hasPaid) {
        ensureConstructionSchedule(scheduleInput)
      } else {
        createPlan(scheduleInput)
      }
    }

    flash(
      editingId
        ? `Booking ${record.bookingCode} updated`
        : `Booking ${record.bookingCode} saved`,
    )
    resetBookingForm()
    navigate('/bookings', { replace: true })
  }

  const resetBookingForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormMode('create')
    setFormStep(0)
    setPlotIds([])
    setPlotLines([])
    setConfigPlotId('')
    setShowConstructionUi(false)
    setLandPaymentPlanCustom(false)
    setLandPaymentPlanOverride(createEmptyPaymentPlanOverride())
    setConstructionPaymentPlanCustom(false)
    setConstructionPaymentPlanOverride(createEmptyPaymentPlanOverride())
    setLandDialogOpen(false)
    setConstructionDialogOpen(false)
  }

  const openBookingEditor = (
    booking: BookingRecord,
    options?: { addConstruction?: boolean },
  ) => {
    const addConstruction = Boolean(options?.addConstruction)
    if (isAccountant && !addConstruction) {
      flash('Accounts cannot edit bookings — only add construction if missing')
      return
    }
    if (addConstruction && !canAddConstructionToBooking(booking)) {
      flash(
        bookingHasConstruction(booking)
          ? 'Construction is already configured on every plot'
          : 'Cannot add construction to this booking',
      )
      return
    }
    if (isAccountant && addConstruction && booking.status === 'cancelled') {
      flash('Cannot add construction to a cancelled booking')
      return
    }
    const normalized = normalizeBookingRecord(booking)
    setEditingId(booking.id)
    setFormMode(addConstruction ? 'add-construction' : 'edit')
    setSchemeId(booking.schemeId)
    setPlotIds(normalized.plotIds)
    setPlotLines(normalized.plotLines)
    setConfigPlotId(normalized.plotIds[0] || '')
    setCustomerName(booking.customerName)
    setCustomerPhone(booking.customerPhone)
    setCustomerEmail(booking.customerEmail)
    setSalesPerson(booking.salesPerson || user?.name || '')
    setViaBroker(booking.viaBroker)
    setBrokerId(booking.brokerId || '')
    setBroker(
      booking.viaBroker
        ? { ...createEmptyBrokerInfo(), ...booking.broker }
        : createEmptyBrokerInfo(),
    )
    setShowAddBroker(false)
    setPropertyRegistration(booking.propertyRegistration !== false)
    setBookingAmount(booking.bookingAmount || '')
    setBookingAmountMode(
      booking.bookingAmountMode === 'cash' ||
        booking.bookingAmountMode === 'cheque'
        ? booking.bookingAmountMode
        : '',
    )
    setStatus(
      booking.status === 'booked' || booking.status === 'reserved'
        ? booking.status
        : 'reserved',
    )
    setBookingDate(booking.bookingDate || todayISO())
    setNotes(booking.notes || '')
    const hasConstruction = bookingHasConstruction(normalized)
    setShowConstructionUi(Boolean(addConstruction) || hasConstruction)
    setLandPaymentPlanId(
      booking.landPaymentPlanId || booking.paymentPlanId || '',
    )
    setConstructionPaymentPlanId(booking.constructionPaymentPlanId || '')
    setLandPaymentPlanCustom(Boolean(booking.landPaymentPlanCustom))
    setLandPaymentPlanOverride(
      createEmptyPaymentPlanOverride(booking.landPaymentPlanOverride),
    )
    setConstructionPaymentPlanCustom(
      Boolean(booking.constructionPaymentPlanCustom),
    )
    setConstructionPaymentPlanOverride(
      createEmptyPaymentPlanOverride(booking.constructionPaymentPlanOverride),
    )
    setInstallmentDueDate(
      booking.landInstallmentDueDate ||
        booking.constructionInstallmentDueDate ||
        booking.bookingDate ||
        todayISO(),
    )
    setFormStep(addConstruction ? 1 : 0)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const paymentPlanChecklist = [
    {
      id: 'due',
      label: 'Installment due date',
      done: Boolean(installmentDueDate),
    },
    {
      id: 'land-plan',
      label: 'Land payment plan',
      done: Boolean(landPaymentPlan),
    },
    {
      id: 'land-value',
      label: 'Land payment value',
      done:
        landPayment.configured &&
        plotLines.every((l) => l.landPayment.configured),
    },
    {
      id: 'construction',
      label: includeConstruction
        ? 'Construction on ≥1 plot'
        : 'Construction (add later — min 1 plot)',
      done: !includeConstruction
        ? true
        : Boolean(constructionPaymentPlan && hasMinConstruction),
      optional: !includeConstruction,
    },
  ] as const

  const setConstructionIncluded = (include: boolean) => {
    if (!include) {
      setShowConstructionUi(false)
      setPlotLines((prev) =>
        prev.map((l) => ({
          ...l,
          constructionPayment: createEmptyConstructionPayment(),
        })),
      )
      setConstructionPaymentPlanCustom(false)
      setConstructionPaymentPlanOverride(createEmptyPaymentPlanOverride())
      setConstructionDialogOpen(false)
      return
    }
    setShowConstructionUi(true)
  }

  const clearConstructionOnPlot = (plotId: string) => {
    patchPlotLine(plotId, {
      constructionPayment: createEmptyConstructionPayment(),
    })
  }

  const schemeName = (id: string) =>
    schemes.find((s) => s.id === id)?.schemeName || '—'

  const planDetailsForBooking = (b: BookingRecord) => {
    const schemeRec = getScheme(b.schemeId)
    const plans = schemeRec ? normalizePaymentPlans(schemeRec) : []
    return resolveBookingPlanDetails(b, plans)
  }

  if (schemes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <div className="py-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-brand" />
            <h1 className="mt-3 font-display text-2xl">No schemes yet</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {user?.role === 'admin'
                ? 'Create a scheme and plots before taking bookings.'
                : 'Ask an admin to create a scheme before taking bookings.'}
            </p>
            {user?.role === 'admin' && (
              <Link to="/schemes/new" className="mt-5 inline-block">
                <Button>Create Scheme</Button>
              </Link>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Sales Pipeline
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
            Bookings
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            {isAccountant
              ? 'View bookings and add construction when it was skipped. Full booking edits are for sales and admin.'
              : 'Create bookings, track collections, and add construction later if skipped.'}
          </p>
        </div>
        {!showForm && canTakeBookings && (
          <Button
            type="button"
            onClick={() => {
              resetBookingForm()
              setFormMode('create')
              setShowForm(true)
              setFormStep(0)
              setSchemeId(schemes[0]?.id || '')
              syncPlotSelection([])
              setCustomerName('')
              setCustomerPhone('')
              setCustomerEmail('')
              setSalesPerson(user?.name || '')
              setViaBroker(false)
              setBrokerId('')
              setBroker(createEmptyBrokerInfo())
              setPropertyRegistration(true)
              setBookingAmount('')
              setBookingAmountMode('')
              setStatus('reserved')
              setBookingDate(todayISO())
              setNotes('')
              setInstallmentDueDate(todayISO())
              navigate('/bookings/new')
            }}
          >
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        )}
      </div>

      {!showForm && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Deal value
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                {formatCurrency(financialSummary.total)}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Collected
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-success">
                {formatCurrency(financialSummary.collected)}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{
                    width: `${
                      financialSummary.total > 0
                        ? Math.min(
                            100,
                            (financialSummary.collected /
                              financialSummary.total) *
                              100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Pending
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-warn">
                {formatCurrency(financialSummary.pending)}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder='Smart search — try plot:43, fy:2025-26, status:booked, or customer name'
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as BookingSortKey)
                  }
                  aria-label="Sort bookings"
                  className="min-w-[180px]"
                >
                  {(Object.keys(BOOKING_SORT_LABELS) as BookingSortKey[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        Sort · {BOOKING_SORT_LABELS[key]}
                      </option>
                    ),
                  )}
                </Select>
                <Button
                  type="button"
                  variant={showAdvancedFilters ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowAdvancedFilters((v) => !v)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10px] text-brand-ink">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <MultiSelectDropdown
                label="Status"
                allLabel="All"
                values={statusFilter}
                onChange={(next) => {
                  setListQuery((q) =>
                    q
                      .replace(/\bstatus:\w+/gi, '')
                      .replace(
                        /\b(reserved|booked|cancelled|canceled|completed|done)\b/gi,
                        '',
                      )
                      .replace(/\s{2,}/g, ' ')
                      .trim(),
                  )
                  setStatusFilter(next)
                }}
                options={statusFilterOptions}
              />
              <MultiSelectDropdown
                label="FY"
                allLabel="All years"
                values={fyFilter}
                onChange={(next) => {
                  setListQuery((q) =>
                    q
                      .replace(/\bfy[:\s-]?\S+/gi, '')
                      .replace(/\s{2,}/g, ' ')
                      .trim(),
                  )
                  setFyFilter(next)
                }}
                options={fyFilterOptions}
              />
              <button
                type="button"
                onClick={() => setNeedsConstructionOnly((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  needsConstructionOnly ||
                  smartQuery.construction === 'missing'
                    ? 'border-brand/40 bg-brand-soft/50 text-brand'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Needs construction
                <span className="text-ink-faint">{needsConstructionCount}</span>
              </button>
            </div>

            {showAdvancedFilters && (
              <div className="grid gap-3 rounded-xl border border-line bg-surface-2/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Scheme">
                  <Select
                    value={schemeFilter}
                    onChange={(e) => setSchemeFilter(e.target.value)}
                  >
                    <option value="all">All schemes</option>
                    {schemes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.schemeName || s.schemeCode}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Plot" hint="Filter by plot number">
                  <Select
                    value={plotFilter}
                    onChange={(e) => setPlotFilter(e.target.value)}
                  >
                    <option value="all">All plots</option>
                    {plotsForFilter.map((p) => (
                      <option key={p.id} value={p.id}>
                        Plot {p.plotNumber}
                        {schemeFilter === 'all'
                          ? ` · ${schemeLabel(schemes, p.schemeId)}`
                          : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Quick plot search">
                  <Input
                    value={smartQuery.plot || ''}
                    onChange={(e) => {
                      const value = e.target.value.trim()
                      const withoutPlot = listQuery
                        .replace(/\bplot\s*[:=\s]\s*[a-z0-9/-]+/gi, '')
                        .replace(/#[a-z0-9/-]+/gi, '')
                        .replace(/\bplot:[^\s]+/gi, '')
                        .trim()
                      setListQuery(
                        value
                          ? `${withoutPlot} plot:${value}`.trim()
                          : withoutPlot,
                      )
                    }}
                    placeholder="e.g. 43B"
                  />
                </Field>
              </div>
            )}

            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Active
                </span>
                {listQuery.trim() && (
                  <FilterChip
                    label={`Search: ${listQuery.trim()}`}
                    onClear={() => setListQuery('')}
                  />
                )}
                {statusFilter.map((s) => (
                  <FilterChip
                    key={s}
                    label={BOOKING_STATUS_LABELS[s]}
                    onClear={() => {
                      setStatusFilter((prev) =>
                        prev.filter((x) => x !== s),
                      )
                    }}
                  />
                ))}
                {schemeFilter !== 'all' && (
                  <FilterChip
                    label={schemeLabel(schemes, schemeFilter)}
                    onClear={() => setSchemeFilter('all')}
                  />
                )}
                {plotFilter !== 'all' && (
                  <FilterChip
                    label={plotLabel(plots, plotFilter)}
                    onClear={() => setPlotFilter('all')}
                  />
                )}
                {fyFilter.map((fy) => (
                  <FilterChip
                    key={fy}
                    label={financialYearLabel(fy)}
                    onClear={() => {
                      setFyFilter((prev) => prev.filter((x) => x !== fy))
                    }}
                  />
                ))}
                {needsConstructionOnly && (
                  <FilterChip
                    label="Needs construction"
                    onClear={() => setNeedsConstructionOnly(false)}
                  />
                )}
                <button
                  type="button"
                  className="text-xs font-semibold text-ink-muted hover:text-ink"
                  onClick={clearAllFilters}
                >
                  Clear all
                </button>
              </div>
            )}

            <p className="text-[11px] text-ink-faint">
              Tips: <code className="text-ink-muted">plot:43B</code> ·{' '}
              <code className="text-ink-muted">fy:2025-26</code> ·{' '}
              <code className="text-ink-muted">status:booked</code> ·{' '}
              <code className="text-ink-muted">construction:missing</code>
            </p>
          </div>
        </>
      )}

      {showForm && (
        <Card
          title={
            formMode === 'add-construction'
              ? `Add construction · ${
                  bookings.find((b) => b.id === editingId)?.bookingCode || ''
                }`
              : editingId
                ? `Edit booking · ${
                    bookings.find((b) => b.id === editingId)?.bookingCode || ''
                  }`
                : lead
                  ? `Book from lead · ${lead.name}`
                  : 'New booking'
          }
          description={
            formMode === 'add-construction'
              ? 'Construction is required on at least one plot. Other plots can stay land-only.'
              : editingId
                ? 'Change deal details anytime. Construction is required on ≥1 plot — add it later if skipped.'
                : 'Land on every plot. Construction on at least one plot (now or later); others can stay land-only.'
          }
        >
          {formMode === 'add-construction' && (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <Building2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Adding construction to this booking
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {constructionConfiguredCount > 0
                      ? 'Add construction on remaining plot(s). At least one is already configured.'
                      : 'Pick which plot(s) get construction (min 1). Other plots stay land-only.'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!landPayment.configured || plotIds.length === 0 || !scheme}
                onClick={() => {
                  const target =
                    plotLines.find((l) => !l.constructionPayment.configured)
                      ?.plotId ||
                    plotIds[0]
                  if (!target) return
                  setConfigPlotId(target)
                  setConstructionIncluded(true)
                  setConstructionDialogOpen(true)
                }}
              >
                Configure value
              </Button>
            </div>
          )}

          <div className="mb-6">
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{
                  width: `${((formStep + 1) / BOOKING_STEPS.length) * 100}%`,
                }}
              />
            </div>
            <ol className="flex flex-wrap items-center gap-2">
              {BOOKING_STEPS.map((label, index) => {
                const done = index < formStep
                const active = index === formStep
                const detailsLocked =
                  isAccountant && formMode === 'add-construction' && index === 0
                const canJump =
                  !detailsLocked && (done || index === formStep)
                return (
                  <li key={label} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canJump}
                      onClick={() => canJump && setFormStep(index)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-brand text-brand-ink'
                          : done
                            ? 'bg-brand-soft text-brand hover:brightness-95'
                            : 'cursor-default bg-surface-2 text-ink-faint'
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px]">
                        {done ? <Check className="h-3 w-3" /> : index + 1}
                      </span>
                      {label}
                    </button>
                    {index < BOOKING_STEPS.length - 1 && (
                      <span className="h-px w-4 bg-line" />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          {formStep === 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Customer name" required>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Field>
            <Field label="Phone" required>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </Field>
            <Field
              label="Sales person"
              required
              hint="From signed-in user"
            >
              <Input
                value={salesPerson}
                readOnly
                className="bg-surface-2"
              />
            </Field>
            <Field label="Scheme" required>
              <Select
                value={schemeId}
                onChange={(e) => {
                  setSchemeId(e.target.value)
                  syncPlotSelection([])
                }}
              >
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.schemeName || s.schemeCode}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Plots"
              required
              hint={
                heldPlotHint
                  ? `Already booked elsewhere — remove or free first: ${heldPlotHint}`
                  : 'Same scheme — only available plots are listed'
              }
              error={heldPlotHint || undefined}
              className="sm:col-span-2"
            >
              <MultiSelectDropdown
                label="Plots"
                allLabel="Select plots"
                values={plotIds}
                onChange={syncPlotSelection}
                options={schemePlots.map((p) => {
                  const price = scheme
                    ? calculatePlotPrice(scheme, p)
                    : null
                  return {
                    value: p.id,
                    label: `Plot ${p.plotNumber} · ${p.blockName || '—'} · ${p.status}${
                      price ? ` · ${formatCurrency(price.total)}` : ''
                    }`,
                  }
                })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
              >
                <option value="reserved">Reserved</option>
                <option value="booked">Booked</option>
              </Select>
            </Field>
            <Field label="Booking amount" required hint={
              scheme?.minimumBookingAmount
                ? `Scheme minimum ${formatCurrency(scheme.minimumBookingAmount)}`
                : undefined
            }>
              <Input
                type="number"
                min="0"
                value={bookingAmount}
                onChange={(e) => setBookingAmount(e.target.value)}
                placeholder={scheme?.minimumBookingAmount || '₹'}
              />
            </Field>
            <Field
              label="Token paid by"
              required
              hint="Cash → cash quota · Cheque → GST-inclusive, cheque quota"
            >
              <Select
                value={bookingAmountMode}
                onChange={(e) =>
                  setBookingAmountMode(
                    e.target.value as BookingTokenMode | '',
                  )
                }
              >
                <option value="">Select mode</option>
                {(Object.keys(BOOKING_TOKEN_MODE_LABELS) as BookingTokenMode[]).map(
                  (m) => (
                    <option key={m} value={m}>
                      {BOOKING_TOKEN_MODE_LABELS[m]}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            {bookingAmountMode === 'cheque' &&
              Number(bookingAmount || scheme?.minimumBookingAmount || 0) >
                0 && (
                <div className="rounded-xl bg-surface-2/70 px-3 py-2.5 text-xs text-ink-muted sm:col-span-2 lg:col-span-3">
                  {(() => {
                    const take = Math.round(
                      Number(
                        bookingAmount || scheme?.minimumBookingAmount || 0,
                      ),
                    )
                    const split = splitGrossBankAmount(
                      take,
                      chequeGstPercent(),
                    )
                    return (
                      <>
                        <p className="font-semibold text-ink-faint">
                          Cheque token (GST-inclusive)
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                          <span>
                            Toward deal{' '}
                            <span className="font-medium text-ink">
                              {formatCurrency(split.principal)}
                            </span>
                          </span>
                          <span>
                            GST {chequeGstPercent()}%{' '}
                            <span className="font-medium text-ink">
                              {formatCurrency(split.gst)}
                            </span>
                          </span>
                          <span>
                            Collected{' '}
                            <span className="font-medium text-ink">
                              {formatCurrency(split.gross)}
                            </span>
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            <Field label="Booking date">
              <Input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </Field>
            <Field label="Valid until" hint="Auto from scheme rules">
              <Input type="date" value={validUntil} readOnly className="bg-surface-2" />
            </Field>
            {quote && (
              <div className="rounded-xl border border-line bg-brand-soft/50 px-4 py-3 sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Quoted plot price
                  {plotIds.length > 1 ? ` · ${plotIds.length} plots` : ''}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                  {formatCurrency(quote.total)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Base {formatCurrency(quote.baseAmount)}
                  {quote.roadPremiumAmount > 0 &&
                    ` · Road +${formatCurrency(quote.roadPremiumAmount)}`}
                  {quote.developmentChargeAmount > 0 &&
                    ` · Dev +${formatCurrency(quote.developmentChargeAmount)}`}
                  {quote.area > 0 && ` · ${formatNumber(quote.area)} sq.yd`}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  {plotLabels(plots, plotIds)}
                </p>
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-3 grid gap-4 sm:grid-cols-2">
              <Field label="Property registration">
                <Toggle
                  checked={propertyRegistration}
                  onChange={setPropertyRegistration}
                />
              </Field>
              <Field label="Booking via broker?">
                <Toggle checked={viaBroker} onChange={setViaBroker} />
              </Field>
            </div>
            {viaBroker && (
              <div className="sm:col-span-2 lg:col-span-3 space-y-4 rounded-2xl border border-line bg-surface-2/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Broker details
                    </p>
                    <p className="text-xs text-ink-muted">
                      {user?.role === 'admin'
                        ? 'Select an existing broker or add a new one to the master list.'
                        : 'Select a broker from the master list.'}
                    </p>
                  </div>
                  {user?.role === 'admin' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddBroker(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add broker
                    </Button>
                  )}
                </div>

                {user?.role === 'admin' && showAddBroker && (
                  <AddBrokerPanel
                    onSaved={(record) => {
                      applyBroker(record.id)
                      setShowAddBroker(false)
                      flash(`Broker ${record.fullName} saved`)
                    }}
                    onCancel={() => setShowAddBroker(false)}
                  />
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Select broker" required className="lg:col-span-2">
                    <Select
                      value={brokerId}
                      onChange={(e) => {
                        if (!e.target.value) {
                          setBrokerId('')
                          setBroker((prev) => ({
                            ...createEmptyBrokerInfo(),
                            brokerageType: prev.brokerageType,
                            brokerageValue: prev.brokerageValue,
                          }))
                          return
                        }
                        applyBroker(e.target.value)
                      }}
                    >
                      <option value="">Choose broker</option>
                      {brokers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.fullName}
                          {b.firmName ? ` · ${b.firmName}` : ''}
                          {b.phone ? ` · ${b.phone}` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Brokerage type">
                    <Select
                      value={broker.brokerageType}
                      onChange={(e) =>
                        setBrokerField(
                          'brokerageType',
                          e.target.value as BrokerageType,
                        )
                      }
                    >
                      <option value="percent">Percent (%)</option>
                      <option value="amount">Fixed amount (₹)</option>
                    </Select>
                  </Field>
                  <Field
                    label={
                      broker.brokerageType === 'percent'
                        ? 'Brokerage %'
                        : 'Brokerage amount'
                    }
                    required
                  >
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={broker.brokerageValue}
                      onChange={(e) =>
                        setBrokerField('brokerageValue', e.target.value)
                      }
                      placeholder={
                        broker.brokerageType === 'percent' ? 'e.g. 2' : '₹'
                      }
                    />
                  </Field>
                </div>

                {brokerId && (
                  <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      Selected broker
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {broker.fullName}
                      {broker.firmName ? ` · ${broker.firmName}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {[
                        broker.phone,
                        broker.email,
                        BROKER_ORG_LABELS[broker.orgType],
                        broker.licenseNumber && `Lic ${broker.licenseNumber}`,
                        broker.gstNumber && `GST ${broker.gstNumber}`,
                        broker.agencyRelation !== 'none' &&
                          `${AGENCY_RELATION_LABELS[broker.agencyRelation]}${
                            broker.associatedAgency
                              ? `: ${broker.associatedAgency}`
                              : ''
                          }`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {(broker.bankAccountNumber || broker.bankName) && (
                      <p className="mt-1 text-xs text-ink-muted">
                        Bank:{' '}
                        {[
                          broker.bankAccountName,
                          broker.bankAccountNumber,
                          broker.bankIfsc,
                          broker.bankName,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>
          </div>
          )}

          {formStep === 1 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Checklist
                </p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {paymentPlanChecklist.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          item.done
                            ? 'bg-success-soft text-success'
                            : 'bg-warn-soft text-warn'
                        }`}
                      >
                        {item.done ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="text-[10px] font-bold">!</span>
                        )}
                      </span>
                      <span
                        className={
                          item.done ? 'text-ink-muted' : 'font-medium text-ink'
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {schemePaymentPlans.length === 0 && (
                <p className="rounded-xl border border-line bg-warn-soft/40 px-4 py-3 text-sm text-ink">
                  No payment plans on this scheme. Edit scheme → Booking → Add
                  plan.
                </p>
              )}

              <Field
                label="Installment due date"
                required
                hint="Same first EMI due date for land and construction"
                className="max-w-xs"
              >
                <Input
                  type="date"
                  value={installmentDueDate}
                  onChange={(e) => setInstallmentDueDate(e.target.value)}
                />
              </Field>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-brand" />
                    <p className="text-sm font-semibold text-ink">Land</p>
                    <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                      Required
                    </span>
                  </div>
                  <Field label="Land payment plan" required>
                    <Select
                      value={landMasterPlan?.id || ''}
                      onChange={(e) => {
                        const id = e.target.value
                        setLandPaymentPlanId(id)
                        const next = schemePaymentPlans.find((p) => p.id === id)
                        if (landPaymentPlanCustom) seedLandCustomFromMaster(next)
                      }}
                      disabled={!schemePaymentPlans.length}
                    >
                      {!schemePaymentPlans.length && (
                        <option value="">No plans</option>
                      )}
                      {schemePaymentPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.months} mo · Cheque {p.chequePaymentPercent}%
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Customize plan"
                    hint="Edit months / cheque % for this booking"
                  >
                    <Toggle
                      checked={landPaymentPlanCustom}
                      onChange={(v) => {
                        setLandPaymentPlanCustom(v)
                        if (v) seedLandCustomFromMaster(landMasterPlan)
                      }}
                      labelYes="Custom"
                      labelNo="Master"
                    />
                  </Field>
                  {landPaymentPlanCustom && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Plan name">
                        <Input
                          value={landPaymentPlanOverride.name}
                          onChange={(e) =>
                            setLandPaymentPlanOverride((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Custom land plan"
                        />
                      </Field>
                      <Field label="Duration (months)" required>
                        <Input
                          type="number"
                          min="1"
                          value={landPaymentPlanOverride.months}
                          onChange={(e) =>
                            setLandPaymentPlanOverride((prev) => ({
                              ...prev,
                              months: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Cheque payment %"
                        hint={`Min ${MIN_CHEQUE_PERCENT}% · rest is cash · on land value A only`}
                      >
                        <Input
                          type="number"
                          min={MIN_CHEQUE_PERCENT}
                          max="100"
                          value={landPaymentPlanOverride.chequePaymentPercent}
                          onChange={(e) =>
                            setLandPaymentPlanOverride((prev) => ({
                              ...prev,
                              chequePaymentPercent: e.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="GST on cheque %" hint="Fixed">
                        <Input
                          type="text"
                          value={`${FIXED_CHEQUE_GST_PERCENT}%`}
                          readOnly
                          disabled
                        />
                      </Field>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      Land per plot
                    </p>
                    {plotLines.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
                        Select plots in Details first.
                      </p>
                    ) : (
                      plotLines.map((line) => {
                        const plot = plots.find((p) => p.id === line.plotId)
                        const configured = line.landPayment.configured
                        return (
                          <button
                            key={line.plotId}
                            type="button"
                            onClick={() => {
                              if (!plot || !scheme) {
                                flash('Select scheme and plots in Details first')
                                setFormStep(0)
                                return
                              }
                              setConfigPlotId(line.plotId)
                              setLandDialogOpen(true)
                            }}
                            className={`w-full rounded-2xl border p-4 text-left transition hover:border-brand ${
                              configured
                                ? 'border-brand bg-brand-soft/40'
                                : 'border-line bg-surface-2/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-ink">
                                  {plot
                                    ? `Plot ${plot.plotNumber}`
                                    : 'Plot'}{' '}
                                  · Land
                                </p>
                                <p className="mt-0.5 text-xs text-ink-muted">
                                  Compulsory · click to configure
                                </p>
                              </div>
                              {configured ? (
                                <span className="rounded-lg bg-success-soft px-2 py-1 text-[11px] font-semibold text-success">
                                  Configured
                                </span>
                              ) : (
                                <span className="rounded-lg bg-warn-soft px-2 py-1 text-[11px] font-semibold text-warn">
                                  Required
                                </span>
                              )}
                            </div>
                            {configured && (
                              <p className="mt-2 text-sm font-semibold tabular-nums">
                                {formatCurrency(line.landPayment.totalValue)}
                              </p>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                  {landPayment.configured && landPaymentPlan && (
                    <ChequeCashSplitCard
                      title="Land · cheque / cash"
                      plan={landPaymentPlan}
                      land={landPayment}
                    />
                  )}
                </div>

                <div
                  className={`space-y-3 rounded-2xl border p-4 transition ${
                    formMode === 'add-construction' || includeConstruction
                      ? 'border-brand/40 bg-brand-soft/20'
                      : 'border-line bg-surface'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-brand" />
                      <p className="text-sm font-semibold text-ink">
                        Construction
                      </p>
                      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                        Optional
                      </span>
                    </div>
                    {includeConstruction && formMode !== 'add-construction' && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                        onClick={() => setConstructionIncluded(false)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {!includeConstruction ? (
                    <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-5 text-center">
                      <p className="text-sm font-medium text-ink">
                        Construction later
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Required on at least one plot eventually. You can
                        configure it now or add it later — other plots can stay
                        land-only.
                      </p>
                      <Button
                        type="button"
                        className="mt-4"
                        size="sm"
                        disabled={!plotLines.every((l) => l.landPayment.configured)}
                        onClick={() => setConstructionIncluded(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Add construction now
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-ink-muted">
                        Configure construction only on the plots that need it
                        (e.g. 2BHK on Plot 1). Leave the rest land-only. At
                        least one plot is required
                        {hasMinConstruction
                          ? ` · ${constructionConfiguredCount} configured`
                          : ' · none yet'}.
                      </p>
                      <Field label="Construction payment plan" required>
                        <Select
                          value={constructionMasterPlan?.id || ''}
                          onChange={(e) => {
                            const id = e.target.value
                            setConstructionPaymentPlanId(id)
                            const next = schemePaymentPlans.find(
                              (p) => p.id === id,
                            )
                            if (constructionPaymentPlanCustom) {
                              seedConstructionCustomFromMaster(next)
                            }
                          }}
                          disabled={!schemePaymentPlans.length}
                        >
                          {!schemePaymentPlans.length && (
                            <option value="">No plans</option>
                          )}
                          {schemePaymentPlans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.months} mo · Cheque{' '}
                              {p.chequePaymentPercent}%
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Customize plan"
                        hint="Edit months / cheque % for this booking"
                      >
                        <Toggle
                          checked={constructionPaymentPlanCustom}
                          onChange={(v) => {
                            setConstructionPaymentPlanCustom(v)
                            if (v) {
                              seedConstructionCustomFromMaster(
                                constructionMasterPlan,
                              )
                            }
                          }}
                          labelYes="Custom"
                          labelNo="Master"
                        />
                      </Field>
                      {constructionPaymentPlanCustom && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Plan name">
                            <Input
                              value={constructionPaymentPlanOverride.name}
                              onChange={(e) =>
                                setConstructionPaymentPlanOverride((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              placeholder="Custom construction plan"
                            />
                          </Field>
                          <Field label="Duration (months)" required>
                            <Input
                              type="number"
                              min="1"
                              value={constructionPaymentPlanOverride.months}
                              onChange={(e) =>
                                setConstructionPaymentPlanOverride((prev) => ({
                                  ...prev,
                                  months: e.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field
                            label="Cheque payment %"
                            hint={`Min ${MIN_CHEQUE_PERCENT}% · rest is cash · on full construction amount`}
                          >
                            <Input
                              type="number"
                              min={MIN_CHEQUE_PERCENT}
                              max="100"
                              value={
                                constructionPaymentPlanOverride.chequePaymentPercent
                              }
                              onChange={(e) =>
                                setConstructionPaymentPlanOverride((prev) => ({
                                  ...prev,
                                  chequePaymentPercent: e.target.value,
                                }))
                              }
                            />
                          </Field>
                          <Field label="GST on cheque %" hint="Fixed">
                            <Input
                              type="text"
                              value={`${FIXED_CHEQUE_GST_PERCENT}%`}
                              readOnly
                              disabled
                            />
                          </Field>
                        </div>
                      )}
                      {!hasMinConstruction ? (
                        <div className="space-y-2">
                          {plotLines.map((line) => {
                            const plot = plots.find((p) => p.id === line.plotId)
                            return (
                              <Button
                                key={line.plotId}
                                type="button"
                                className="w-full"
                                onClick={() => {
                                  if (!plot || !scheme) {
                                    flash(
                                      'Select scheme and plots in Details first',
                                    )
                                    setFormStep(0)
                                    return
                                  }
                                  setConfigPlotId(line.plotId)
                                  setConstructionDialogOpen(true)
                                }}
                              >
                                <Building2 className="h-4 w-4" />
                                {plot
                                  ? `Plot ${plot.plotNumber}`
                                  : 'Plot'}{' '}
                                · Add construction
                              </Button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {plotLines.map((line) => {
                            const plot = plots.find(
                              (p) => p.id === line.plotId,
                            )
                            const configured =
                              line.constructionPayment.configured
                            return (
                              <div
                                key={line.plotId}
                                className={`flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                  configured
                                    ? 'border-brand bg-brand-soft/40'
                                    : 'border-dashed border-line bg-surface'
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold text-ink">
                                    {plot
                                      ? `Plot ${plot.plotNumber}`
                                      : 'Plot'}
                                  </p>
                                  <p className="text-xs text-ink-muted">
                                    {configured
                                      ? `${(
                                          line.constructionPayment.unitType ||
                                          line.constructionPayment.unitLabel ||
                                          'unit'
                                        ).toUpperCase()} · ${formatCurrency(
                                          line.constructionPayment.totalValue,
                                        )}`
                                      : 'Land only — no construction'}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      configured ? 'secondary' : 'primary'
                                    }
                                    onClick={() => {
                                      setConfigPlotId(line.plotId)
                                      setConstructionDialogOpen(true)
                                    }}
                                  >
                                    {configured ? 'Edit' : 'Add construction'}
                                  </Button>
                                  {configured &&
                                    constructionConfiguredCount > 1 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          clearConstructionOnPlot(line.plotId)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {hasMinConstruction &&
                        constructionPaymentPlan && (
                          <ChequeCashSplitCard
                            title="Construction · cheque / cash"
                            plan={constructionPaymentPlan}
                            constructionAmount={constructionPayment.totalValue}
                          />
                        )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {formStep === 2 && (
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-soft/60 to-surface px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  Deal summary
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-ink-muted">Total</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums">
                      {formatCurrency(
                        landPayment.totalValue +
                          (hasMinConstruction
                            ? constructionPayment.totalValue
                            : 0),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Token</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-success">
                      {formatCurrency(
                        bookingAmount || scheme?.minimumBookingAmount || 0,
                      )}
                    </p>
                    {bookingAmountMode ? (
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        via {BOOKING_TOKEN_MODE_LABELS[bookingAmountMode]}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">After token</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-warn">
                      {formatCurrency(
                        Math.max(
                          0,
                          landPayment.totalValue +
                            (hasMinConstruction
                              ? constructionPayment.totalValue
                              : 0) -
                            Number(
                              bookingAmount ||
                                scheme?.minimumBookingAmount ||
                                0,
                            ),
                        ),
                      )}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-ink-muted">
                  {customerName} · {scheme?.schemeName || '—'} ·{' '}
                  {plotLabels(plots, plotIds)} · Due {installmentDueDate || '—'}
                </p>
              </div>

              <ReviewSection title="Customer">
                <ReviewRow label="Name" value={customerName || '—'} />
                <ReviewRow label="Phone" value={customerPhone || '—'} />
                <ReviewRow label="Email" value={customerEmail || '—'} />
                <ReviewRow label="Sales person" value={salesPerson || '—'} />
              </ReviewSection>

              <ReviewSection title="Deal">
                <ReviewRow
                  label="Scheme"
                  value={scheme?.schemeName || scheme?.schemeCode || '—'}
                />
                <ReviewRow
                  label="Plots"
                  value={plotLinesSummary(plots, plotLines)}
                />
                <ReviewRow
                  label="Status"
                  value={BOOKING_STATUS_LABELS[status]}
                />
                <ReviewRow label="Booking date" value={bookingDate || '—'} />
                <ReviewRow label="Valid until" value={validUntil || '—'} />
                <ReviewRow
                  label="Token / booking amount"
                  value={formatCurrency(
                    bookingAmount || scheme?.minimumBookingAmount || 0,
                  )}
                />
                <ReviewRow
                  label="Token paid by"
                  value={
                    bookingAmountMode
                      ? BOOKING_TOKEN_MODE_LABELS[bookingAmountMode]
                      : '—'
                  }
                />
                <ReviewRow
                  label="Property registration"
                  value={propertyRegistration ? 'Yes' : 'No'}
                />
                <ReviewRow
                  label="Via broker"
                  value={viaBroker ? 'Yes' : 'No'}
                />
                {quote && (
                  <>
                    <ReviewRow
                      label="Quoted plot price"
                      value={formatCurrency(quote.total)}
                    />
                    <ReviewRow
                      label="Quote breakdown"
                      value={[
                        `Base ${formatCurrency(quote.baseAmount)}`,
                        quote.roadPremiumAmount > 0
                          ? `Road +${formatCurrency(quote.roadPremiumAmount)}`
                          : null,
                        quote.developmentChargeAmount > 0
                          ? `Dev +${formatCurrency(quote.developmentChargeAmount)}`
                          : null,
                        quote.area > 0
                          ? `${formatNumber(quote.area)} sq.yd`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </>
                )}
                {notes.trim() && (
                  <ReviewRow label="Notes" value={notes.trim()} />
                )}
              </ReviewSection>

              {viaBroker && (
                <ReviewSection title="Broker">
                  <ReviewRow label="Name" value={broker.fullName || '—'} />
                  <ReviewRow label="Firm" value={broker.firmName || '—'} />
                  <ReviewRow label="Phone" value={broker.phone || '—'} />
                  <ReviewRow label="Email" value={broker.email || '—'} />
                  <ReviewRow
                    label="Org type"
                    value={BROKER_ORG_LABELS[broker.orgType] || '—'}
                  />
                  <ReviewRow
                    label="License"
                    value={broker.licenseNumber || '—'}
                  />
                  <ReviewRow label="GSTIN" value={broker.gstNumber || '—'} />
                  <ReviewRow
                    label="Agency"
                    value={
                      [
                        broker.associatedAgency,
                        broker.agencyRelation !== 'none'
                          ? AGENCY_RELATION_LABELS[broker.agencyRelation]
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  <ReviewRow
                    label="Brokerage"
                    value={
                      broker.brokerageValue
                        ? broker.brokerageType === 'percent'
                          ? `${broker.brokerageValue}%`
                          : formatCurrency(broker.brokerageValue)
                        : '—'
                    }
                  />
                  <ReviewRow
                    label="Bank"
                    value={
                      [
                        broker.bankAccountName,
                        broker.bankAccountNumber,
                        broker.bankIfsc,
                        broker.bankName,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                </ReviewSection>
              )}

              <ReviewSection title="Installment">
                <ReviewRow
                  label="Due date (land & construction)"
                  value={installmentDueDate || '—'}
                />
                <ReviewRow
                  label="Grand total"
                  value={formatCurrency(
                    landPayment.totalValue +
                      (hasMinConstruction
                        ? constructionPayment.totalValue
                        : 0),
                  )}
                />
              </ReviewSection>

              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewSection title="Land payment">
                  <ReviewRow
                    label="Configured"
                    value={landPayment.configured ? 'Yes' : 'No'}
                  />
                  <ReviewRow
                    label="Booking date"
                    value={landPayment.bookingDate || '—'}
                  />
                  <ReviewRow
                    label="Plot"
                    value={landPayment.plotNumber || '—'}
                  />
                  <ReviewRow
                    label="SBU area"
                    value={
                      landPayment.sbuAreaSqYards
                        ? `${formatNumber(landPayment.sbuAreaSqYards)} sq.yd`
                        : '—'
                    }
                  />
                  <ReviewRow
                    label="Basic rate"
                    value={
                      landPayment.basicRate
                        ? formatCurrency(landPayment.basicRate)
                        : '—'
                    }
                  />
                  <ReviewRow
                    label="Basic amount"
                    value={formatCurrency(landPayment.basicAmount)}
                  />
                  {(landPayment.roadPremiumAmount || 0) > 0 && (
                    <ReviewRow
                      label="Road premium"
                      value={`${formatCurrency(landPayment.roadPremiumAmount ?? 0)}${
                        landPayment.facingRoadWidth
                          ? ` (${landPayment.facingRoadWidth} m · ${
                              landPayment.roadPremiumLabel || '0'
                            })`
                          : landPayment.roadPremiumLabel
                            ? ` (${landPayment.roadPremiumLabel})`
                            : ''
                      }`}
                    />
                  )}
                  {(landPayment.gardenPremiumAmount || 0) > 0 && (
                    <ReviewRow
                      label="Garden facing"
                      value={formatCurrency(landPayment.gardenPremiumAmount ?? 0)}
                    />
                  )}
                  <ReviewRow
                    label="Development charge"
                    value={`${formatCurrency(landPayment.developmentChargeAmount)}${
                      landPayment.developmentChargeLabel
                        ? ` (${landPayment.developmentChargeLabel})`
                        : ''
                    }`}
                  />
                  <ReviewRow
                    label="Land total"
                    value={formatCurrency(landPayment.totalValue)}
                  />
                  <ReviewRow
                    label="Payment plan"
                    value={
                      landPaymentPlan
                        ? `${landPaymentPlan.name}${
                            landPaymentPlanCustom ? ' (custom)' : ''
                          }`
                        : '—'
                    }
                  />
                  <ReviewRow
                    label="Duration"
                    value={
                      landPaymentPlan?.months
                        ? `${landPaymentPlan.months} months`
                        : '—'
                    }
                  />
                  <ReviewRow
                    label="Cheque %"
                    value={
                      landPaymentPlan
                        ? `${landPaymentPlan.chequePaymentPercent}%`
                        : '—'
                    }
                  />
                  <ReviewRow
                    label="GST on cheque"
                    value={`${FIXED_CHEQUE_GST_PERCENT}%`}
                  />
                  {landPaymentPlan && landPayment.configured && (
                    <div className="col-span-full mt-1 border-t border-line pt-3">
                      <ChequeCashSplitCard
                        plan={landPaymentPlan}
                        land={landPayment}
                        compact
                      />
                    </div>
                  )}
                </ReviewSection>

                <ReviewSection title="Construction payment">
                  {!includeConstruction || !hasMinConstruction ? (
                    <p className="text-ink-muted">Skipped (optional)</p>
                  ) : (
                    <>
                      <ReviewRow
                        label="Booking date"
                        value={constructionPayment.bookingDate || '—'}
                      />
                      <ReviewRow
                        label="Plot"
                        value={constructionPayment.plotNumber || '—'}
                      />
                      <ReviewRow
                        label="SBU area"
                        value={
                          constructionPayment.sbuAreaSqYards
                            ? `${formatNumber(constructionPayment.sbuAreaSqYards)} sq.yd`
                            : '—'
                        }
                      />
                      <ReviewRow
                        label="Unit"
                        value={
                          constructionPayment.unitLabel ||
                          constructionPayment.unitType ||
                          '—'
                        }
                      />
                      <ReviewRow
                        label="Unit area"
                        value={
                          constructionPayment.unitAreaSqYards
                            ? `${formatNumber(constructionPayment.unitAreaSqYards)} sq.yd`
                            : '—'
                        }
                      />
                      <ReviewRow
                        label="Construction rate"
                        value={
                          constructionPayment.constructionRate
                            ? formatCurrency(
                                constructionPayment.constructionRate,
                              )
                            : '—'
                        }
                      />
                      <ReviewRow
                        label="Construction total"
                        value={formatCurrency(constructionPayment.totalValue)}
                      />
                      {constructionPayment.notes ? (
                        <ReviewRow
                          label="Notes"
                          value={constructionPayment.notes}
                        />
                      ) : null}
                      <ReviewRow
                        label="Payment plan"
                        value={
                          constructionPaymentPlan
                            ? `${constructionPaymentPlan.name}${
                                constructionPaymentPlanCustom
                                  ? ' (custom)'
                                  : ''
                              }`
                            : '—'
                        }
                      />
                      <ReviewRow
                        label="Duration"
                        value={
                          constructionPaymentPlan?.months
                            ? `${constructionPaymentPlan.months} months`
                            : '—'
                        }
                      />
                      <ReviewRow
                        label="Cheque %"
                        value={
                          constructionPaymentPlan
                            ? `${constructionPaymentPlan.chequePaymentPercent}%`
                            : '—'
                        }
                      />
                      <ReviewRow
                        label="GST on cheque"
                        value={`${FIXED_CHEQUE_GST_PERCENT}%`}
                      />
                      {constructionPaymentPlan && (
                        <div className="col-span-full mt-1 border-t border-line pt-3">
                          <ChequeCashSplitCard
                            plan={constructionPaymentPlan}
                            constructionAmount={constructionPayment.totalValue}
                            compact
                          />
                        </div>
                      )}
                    </>
                  )}
                </ReviewSection>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {formStep > 0 &&
              !(
                isAccountant &&
                formMode === 'add-construction' &&
                formStep === 1
              ) && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFormStep((s) => {
                    const next = s - 1
                    if (
                      isAccountant &&
                      formMode === 'add-construction' &&
                      next < 1
                    ) {
                      return 1
                    }
                    return next
                  })
                }
              >
                Previous
              </Button>
            )}
            {formStep < 2 ? (
              <Button type="button" onClick={goNext}>
                Continue to {BOOKING_STEPS[formStep + 1]}
              </Button>
            ) : (
              <Button type="button" onClick={handleSave}>
                {formMode === 'add-construction'
                  ? 'Save construction'
                  : editingId
                    ? 'Update booking'
                    : 'Save booking'}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetBookingForm()
                navigate('/bookings')
              }}
            >
              Cancel
            </Button>
            {formStep === 1 && (
              <p className="w-full text-xs text-ink-faint sm:ml-auto sm:w-auto">
                {paymentPlanChecklist.filter((i) => i.done).length}/
                {paymentPlanChecklist.length} ready
              </p>
            )}
          </div>
        </Card>
      )}

      {selectedPlot && scheme && (
        <>
          <LandPaymentDialog
            open={landDialogOpen}
            onClose={() => setLandDialogOpen(false)}
            bookingDate={bookingDate}
            plot={selectedPlot}
            scheme={scheme}
            initial={
              plotLines.find((l) => l.plotId === selectedPlot.id)?.landPayment
                .configured
                ? plotLines.find((l) => l.plotId === selectedPlot.id)!
                    .landPayment
                : null
            }
            onSave={(config) => {
              patchPlotLine(selectedPlot.id, { landPayment: config })
              if (config.bookingDate) setBookingDate(config.bookingDate)
              setLandDialogOpen(false)
              flash(`Land saved · Plot ${selectedPlot.plotNumber}`)
            }}
          />
          <ConstructionPaymentDialog
            open={constructionDialogOpen}
            onClose={() => setConstructionDialogOpen(false)}
            bookingDate={bookingDate}
            plot={selectedPlot}
            scheme={scheme}
            initial={
              plotLines.find((l) => l.plotId === selectedPlot.id)
                ?.constructionPayment.configured
                ? plotLines.find((l) => l.plotId === selectedPlot.id)!
                    .constructionPayment
                : null
            }
            onSave={(config) => {
              patchPlotLine(selectedPlot.id, {
                constructionPayment: { ...config, included: true },
              })
              if (config.bookingDate) setBookingDate(config.bookingDate)
              setConstructionDialogOpen(false)
              flash(
                `Construction saved · Plot ${selectedPlot.plotNumber}${
                  config.unitType
                    ? ` · ${config.unitType.toUpperCase()}`
                    : ''
                }`,
              )
            }}
          />
        </>
      )}

      {!showForm && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Bookings</h2>
              <p className="text-xs text-ink-muted">
                {filteredBookings.length === 0
                  ? `0 of ${bookings.length}`
                  : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(
                      currentPage * pageSize,
                      filteredBookings.length,
                    )} of ${filteredBookings.length}`}
                {filteredBookings.length !== bookings.length
                  ? ` (filtered from ${bookings.length})`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"
                  onClick={clearAllFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
              <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
                <button
                  type="button"
                  title="Compact list"
                  onClick={() => setListDensity('compact')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    listDensity === 'compact'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted'
                  }`}
                >
                  <Rows3 className="h-3.5 w-3.5" />
                  Compact
                </button>
                <button
                  type="button"
                  title="Comfortable cards"
                  onClick={() => setListDensity('comfortable')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    listDensity === 'comfortable'
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted'
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Cards
                </button>
              </div>
              <Select
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-auto min-w-[110px] py-1.5 text-xs"
              >
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
                <option value="50">50 / page</option>
              </Select>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-ink-faint" />
              <p className="mt-3 text-sm font-semibold text-ink">
                {bookings.length === 0 ? 'No bookings yet' : 'No matches'}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {bookings.length === 0
                  ? 'Create one from a lead or New Booking.'
                  : 'Try a different search or clear filters.'}
              </p>
            </div>
          ) : listDensity === 'compact' ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-2/70 text-[11px] uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Customer</th>
                      <th className="px-3 py-2.5 font-semibold">Scheme / Plot</th>
                      <th className="px-3 py-2.5 font-semibold">Plan</th>
                      <th className="px-3 py-2.5 font-semibold">Financials</th>
                      <th className="px-3 py-2.5 font-semibold">GST collection</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBookings.map((b) => {
                      const finance = financeByBooking.get(b.id) || EMPTY_BOOKING_FINANCE
                      const plans = planDetailsForBooking(b)
                      const canAddConstruction =
                        canAddConstructionToBooking(b)
                      const collectedPct =
                        finance.total > 0
                          ? Math.min(
                              100,
                              (finance.collected / finance.total) * 100,
                            )
                          : 0
                      const gstPct =
                        finance.gstTarget > 0
                          ? Math.min(
                              100,
                              (finance.gstCollected / finance.gstTarget) * 100,
                            )
                          : finance.gstPending > 0
                            ? 0
                            : 100
                      const handover = assessHandover(
                        b,
                        getInstallmentsByBooking(b.id),
                        otherCtx(b),
                        finance.gstPending,
                      )
                      const readyForHandover = handover.ready
                      const showConfigureConstruction =
                        canAddConstruction &&
                        (handover.requireConstructionConfig ||
                          handover.suggestMoreConstruction)
                      return (
                        <tr
                          key={b.id}
                          className="border-b border-line last:border-0 hover:bg-surface-2/40"
                        >
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-ink">
                              {b.customerName}
                            </div>
                            <div className="text-[11px] text-ink-muted">
                              <span className="font-mono text-ink-faint">
                                {b.bookingCode}
                              </span>
                              {' · '}
                              {b.customerPhone}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-ink-muted">
                            <div className="font-medium text-ink">
                              {schemeName(b.schemeId)}
                            </div>
                            <div>{plotLinesSummary(plots, normalizeBookingRecord(b).plotLines)}</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-ink-muted">
                            <div>
                              L · {plans.land?.name || '—'}
                              {plans.land
                                ? ` · ${plans.land.months}m`
                                : ''}
                            </div>
                            {plans.construction ? (
                              <div>
                                C · {plans.construction.name} ·{' '}
                                {plans.construction.months}m
                                {canAddConstruction ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openBookingEditor(b, {
                                        addConstruction: true,
                                      })
                                    }
                                    className="ml-1 font-semibold text-brand hover:underline"
                                  >
                                    + more
                                  </button>
                                ) : null}
                              </div>
                            ) : canAddConstruction ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openBookingEditor(b, {
                                    addConstruction: true,
                                  })
                                }
                                className="mt-0.5 font-semibold text-brand hover:underline"
                              >
                                + Construction
                              </button>
                            ) : (
                              <div className="text-ink-faint">C · —</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-sm font-semibold tabular-nums">
                              {formatCurrency(finance.total)}
                            </div>
                            <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-success"
                                style={{ width: `${collectedPct}%` }}
                              />
                            </div>
                            <div className="mt-0.5 text-[11px] tabular-nums text-ink-muted">
                              <span className="text-success">
                                {formatCurrency(finance.collected)}
                              </span>
                              {' / '}
                              <span className="text-warn">
                                {formatCurrency(finance.pending)} due
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {finance.gstTarget > 0 || finance.gstCollected > 0 ? (
                              <>
                                <div className="text-sm font-semibold tabular-nums">
                                  {formatCurrency(finance.gstCollected)}
                                </div>
                                <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-surface-2">
                                  <div
                                    className={`h-full rounded-full ${
                                      finance.gstPending > 0
                                        ? 'bg-warn'
                                        : 'bg-success'
                                    }`}
                                    style={{ width: `${gstPct}%` }}
                                  />
                                </div>
                                <div className="mt-0.5 text-[11px] tabular-nums text-ink-muted">
                                  of {formatCurrency(finance.gstTarget)}
                                  {finance.gstPending > 0 ? (
                                    <span className="block text-warn">
                                      {formatCurrency(finance.gstPending)} due
                                    </span>
                                  ) : (
                                    <span className="block text-success">
                                      Collected
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-ink-faint">No GST</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-1">
                              {canEditBookings ? (
                                <Select
                                  value={b.status}
                                  onChange={(e) =>
                                    applyBookingStatus(
                                      b.id,
                                      e.target.value as BookingStatus,
                                    )
                                  }
                                  className="min-w-[120px] py-1 text-xs"
                                >
                                  {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {BOOKING_STATUS_LABELS[s]}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <span
                                  className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${statusTone(b.status)}`}
                                >
                                  {BOOKING_STATUS_LABELS[b.status]}
                                </span>
                              )}
                              {isBookingHandedOver(b) ? (
                                <p className="text-[10px] font-medium text-success">
                                  Handed over
                                  {b.handoverDate
                                    ? ` · ${b.handoverDate}`
                                    : ''}
                                  {isAdmin && b.handoverByName
                                    ? ` · ${b.handoverByName}`
                                    : ''}
                                </p>
                              ) : readyForHandover ? (
                                <p className="text-[10px] font-semibold text-brand">
                                  Ready for handover
                                  {handover.suggestMoreConstruction
                                    ? ' · more construction optional'
                                    : ''}
                                </p>
                              ) : handover.requireConstructionConfig ? (
                                <p className="text-[10px] font-semibold text-warn">
                                  Configure construction
                                </p>
                              ) : handover.blockReason ? (
                                <p className="text-[10px] font-semibold text-ink-muted">
                                  {handover.blockReason.replace(/^Land paid — /, '')}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-0.5">
                              {canHandover && readyForHandover && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="!px-2 !py-1"
                                  onClick={() => setHandoverBookingId(b.id)}
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                  Hand over
                                </Button>
                              )}
                              {showConfigureConstruction && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    handover.requireConstructionConfig
                                      ? 'primary'
                                      : 'outline'
                                  }
                                  className="!px-2 !py-1"
                                  onClick={() =>
                                    openBookingEditor(b, {
                                      addConstruction: true,
                                    })
                                  }
                                >
                                  <Building2 className="h-3.5 w-3.5" />
                                  {handover.requireConstructionConfig
                                    ? 'Configure construction'
                                    : 'Add construction'}
                                </Button>
                              )}
                              {isAdmin && isBookingHandedOver(b) && (
                                <button
                                  type="button"
                                  title="Undo handover"
                                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink"
                                  onClick={() => undoHandover(b.id)}
                                >
                                  Undo
                                </button>
                              )}
                              {canEditBookings && (
                                <button
                                  type="button"
                                  title="Edit"
                                  className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
                                  onClick={() => openBookingEditor(b)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {canEditBookings && (
                                <button
                                  type="button"
                                  title="Delete"
                                  className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-danger"
                                  onClick={() => deleteBooking(b.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pagedBookings.map((b) => {
                const finance = financeByBooking.get(b.id) || EMPTY_BOOKING_FINANCE
                const plans = planDetailsForBooking(b)
                const collectedPct =
                  finance.total > 0
                    ? Math.min(100, (finance.collected / finance.total) * 100)
                    : 0
                const gstPctBar =
                  finance.gstTarget > 0
                    ? Math.min(
                        100,
                        (finance.gstCollected / finance.gstTarget) * 100,
                      )
                    : finance.gstPending > 0
                      ? 0
                      : 100
                const canAddConstruction = canAddConstructionToBooking(b)
                const handover = assessHandover(
                  b,
                  getInstallmentsByBooking(b.id),
                  otherCtx(b),
                  finance.gstPending,
                )
                const readyForHandover = handover.ready
                const showConfigureConstruction =
                  canAddConstruction &&
                  (handover.requireConstructionConfig ||
                    handover.suggestMoreConstruction)
                return (
                  <article
                    key={b.id}
                    className={`rounded-2xl border bg-surface p-4 shadow-[0_1px_0_rgba(21,36,31,0.04)] transition hover:border-line-strong ${
                      readyForHandover
                        ? 'border-brand/40'
                        : showConfigureConstruction
                          ? 'border-brand/25'
                          : 'border-line'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-ink">
                                {b.customerName}
                              </h3>
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${statusTone(b.status)}`}
                              >
                                {BOOKING_STATUS_LABELS[b.status]}
                              </span>
                              {isBookingHandedOver(b) ? (
                                <span className="rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                                  Handed over
                                </span>
                              ) : readyForHandover ? (
                                <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                                  Ready for handover
                                </span>
                              ) : handover.requireConstructionConfig ? (
                                <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                                  Configure construction
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              <span className="font-mono text-ink-faint">
                                {b.bookingCode}
                              </span>
                              {' · '}
                              {b.customerPhone}
                              {b.salesPerson ? ` · ${b.salesPerson}` : ''}
                            </p>
                            {isBookingHandedOver(b) && isAdmin && (
                              <p className="mt-1 text-[11px] text-ink-faint">
                                By {b.handoverByName || '—'}
                                {b.handoverDate ? ` · ${b.handoverDate}` : ''}
                              </p>
                            )}
                          </div>
                          <Select
                            value={b.status}
                            onChange={(e) =>
                              applyBookingStatus(
                                b.id,
                                e.target.value as BookingStatus,
                              )
                            }
                            className="w-auto min-w-[120px] py-1.5 text-xs"
                            disabled={!canEditBookings}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {BOOKING_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-xl bg-surface-2/60 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                              Property
                            </p>
                            <p className="mt-1 text-sm font-medium text-ink">
                              {schemeName(b.schemeId)}
                            </p>
                            <p className="text-xs text-ink-muted">
                              {plotLinesSummary(
                                plots,
                                normalizeBookingRecord(b).plotLines,
                              )}
                              {b.propertyRegistration !== false
                                ? ' · Reg. Yes'
                                : ' · Reg. No'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-surface-2/60 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                              Payment plan
                            </p>
                            <p className="mt-1 text-sm text-ink">
                              Land · {plans.land?.name || '—'}
                            </p>
                            {plans.construction ? (
                              <p className="mt-1 text-sm text-ink">
                                Const · {plans.construction.name}
                                {canAddConstruction ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openBookingEditor(b, {
                                        addConstruction: true,
                                      })
                                    }
                                    className="ml-2 text-[11px] font-semibold text-brand hover:underline"
                                  >
                                    + more
                                  </button>
                                ) : null}
                              </p>
                            ) : canAddConstruction ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openBookingEditor(b, {
                                    addConstruction: true,
                                  })
                                }
                                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-brand/50 bg-brand-soft/50 px-2.5 py-1.5 text-[11px] font-semibold text-brand"
                              >
                                <Plus className="h-3 w-3" />
                                Add construction
                              </button>
                            ) : (
                              <p className="mt-1 text-xs text-ink-faint">
                                Construction —
                              </p>
                            )}
                          </div>
                          <div className="rounded-xl bg-surface-2/60 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                              Financials
                            </p>
                            <p className="mt-1 text-lg font-semibold tabular-nums">
                              {formatCurrency(finance.total)}
                            </p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
                              <div
                                className="h-full rounded-full bg-success"
                                style={{ width: `${collectedPct}%` }}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] tabular-nums">
                              <span className="text-success">
                                Collected {formatCurrency(finance.collected)}
                              </span>
                              <span className="text-warn">
                                Pending {formatCurrency(finance.pending)}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-xl bg-surface-2/60 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                              GST collection
                            </p>
                            {finance.gstTarget > 0 || finance.gstCollected > 0 ? (
                              <>
                                <p className="mt-1 text-lg font-semibold tabular-nums">
                                  {formatCurrency(finance.gstCollected)}
                                </p>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
                                  <div
                                    className={`h-full rounded-full ${
                                      finance.gstPending > 0
                                        ? 'bg-warn'
                                        : 'bg-success'
                                    }`}
                                    style={{ width: `${gstPctBar}%` }}
                                  />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] tabular-nums">
                                  <span className="text-ink-muted">
                                    of {formatCurrency(finance.gstTarget)}
                                  </span>
                                  {finance.gstPending > 0 ? (
                                    <span className="text-warn">
                                      {formatCurrency(finance.gstPending)} due
                                    </span>
                                  ) : (
                                    <span className="text-success">Collected</span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className="mt-1 text-sm text-ink-faint">No GST</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-row gap-1.5 lg:flex-col">
                        {canHandover && readyForHandover && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setHandoverBookingId(b.id)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Hand over
                          </Button>
                        )}
                        {showConfigureConstruction && (
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              handover.requireConstructionConfig
                                ? 'primary'
                                : 'outline'
                            }
                            onClick={() =>
                              openBookingEditor(b, { addConstruction: true })
                            }
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            {handover.requireConstructionConfig
                              ? 'Configure construction'
                              : 'Add construction'}
                          </Button>
                        )}
                        {isAdmin && isBookingHandedOver(b) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => undoHandover(b.id)}
                          >
                            Undo handover
                          </Button>
                        )}
                        {canEditBookings && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openBookingEditor(b)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        )}
                        {canEditBookings && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteBooking(b.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {filteredBookings.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-muted">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true
                    return (
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - currentPage) <= 1
                    )
                  })
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0) {
                      const prev = arr[idx - 1]
                      if (typeof prev === 'number' && p - prev > 1) {
                        acc.push('ellipsis')
                      }
                    }
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span
                        key={`e-${idx}`}
                        className="px-1 text-xs text-ink-faint"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`min-w-8 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                          p === currentPage
                            ? 'bg-brand text-brand-ink'
                            : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {handoverBooking && user && (
        <HandoverDialog
          booking={handoverBooking}
          propertyLabel={bookingPropertyLabel(handoverBooking)}
          actorName={user.name}
          onClose={() => setHandoverBookingId(null)}
          onConfirm={confirmHandover}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 text-ink-faint hover:bg-surface hover:text-ink"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function resolveBookingPlanDetails(
  booking: BookingRecord,
  schemePlans: SchemePaymentPlan[],
) {
  const landMaster =
    schemePlans.find((p) => p.id === booking.landPaymentPlanId) ||
    schemePlans.find((p) => p.id === booking.paymentPlanId) ||
    schemePlans[0]
  const constructionMaster =
    schemePlans.find((p) => p.id === booking.constructionPaymentPlanId) ||
    schemePlans[0]

  const land = landMaster
    ? booking.landPaymentPlanCustom && booking.landPaymentPlanOverride
      ? {
          name: booking.landPaymentPlanOverride.name || landMaster.name,
          months: booking.landPaymentPlanOverride.months || landMaster.months,
          chequePercent:
            booking.landPaymentPlanOverride.chequePaymentPercent ||
            landMaster.chequePaymentPercent,
          custom: true as const,
        }
      : {
          name: landMaster.name,
          months: landMaster.months,
          chequePercent: landMaster.chequePaymentPercent,
          custom: false as const,
        }
    : null

  const hasConstruction = bookingHasConstruction(booking)
  const construction =
    hasConstruction && constructionMaster
      ? booking.constructionPaymentPlanCustom &&
        booking.constructionPaymentPlanOverride
        ? {
            name:
              booking.constructionPaymentPlanOverride.name ||
              constructionMaster.name,
            months:
              booking.constructionPaymentPlanOverride.months ||
              constructionMaster.months,
            chequePercent:
              booking.constructionPaymentPlanOverride.chequePaymentPercent ||
              constructionMaster.chequePaymentPercent,
            custom: true as const,
          }
        : {
            name: constructionMaster.name,
            months: constructionMaster.months,
            chequePercent: constructionMaster.chequePaymentPercent,
            custom: false as const,
          }
      : null

  return {
    land,
    construction,
    dueDate:
      booking.landInstallmentDueDate ||
      booking.constructionInstallmentDueDate ||
      '',
  }
}

function ReviewSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-ink">{value}</dd>
    </div>
  )
}

function ChequeCashSplitCard({
  plan,
  land,
  constructionAmount,
  compact,
  title,
}: {
  plan: SchemePaymentPlan
  /** Land: % split on A only; development always cash */
  land?: LandPaymentConfig | null
  /** Construction: % split on full D */
  constructionAmount?: number
  compact?: boolean
  title?: string
}) {
  const months = Number(plan.months) || 0
  const chequePct = Number(plan.chequePaymentPercent) || 0
  const gstPct = Number(FIXED_CHEQUE_GST_PERCENT)
  const split: DealPayableSplit = land
    ? landCashChequeSplit(land, chequePct, gstPct)
    : constructionCashChequeSplit(
        Math.max(0, Number(constructionAmount) || 0),
        chequePct,
        gstPct,
      )

  return (
    <div
      className={`rounded-xl border border-line ${compact ? '' : 'bg-surface-2/50 px-4 py-3'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title || plan.name} · {plan.name} · {months || '—'} mo
      </p>
      <dl className="mt-2 space-y-1 text-xs sm:text-sm">
        {land && (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">
                Land value A (basic + premiums)
              </dt>
              <dd className="tabular-nums">
                {formatCurrency(split.splitBase)}
              </dd>
            </div>
            {split.development > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Development (100% cash)</dt>
                <dd className="tabular-nums">
                  {formatCurrency(split.development)}
                </dd>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">
            {land ? 'EMI base V' : 'Plan amount D'}
          </dt>
          <dd className="tabular-nums">{formatCurrency(split.planAmount)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">
            Cheque ({split.chequePercent}% of {land ? 'A' : 'D'}) + GST{' '}
            {gstPct}%
          </dt>
          <dd className="tabular-nums">
            {formatCurrency(split.chequeBase)} + {formatCurrency(split.chequeGst)}{' '}
            = {formatCurrency(split.chequeTotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-muted">
            Cash
            {land
              ? ` (${split.cashPercent}% of A + development)`
              : ` (${split.cashPercent}%)`}{' '}
            — no GST
          </dt>
          <dd className="tabular-nums">{formatCurrency(split.cashAmount)}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-line pt-1.5 font-semibold">
          <dt>Payable total</dt>
          <dd className="tabular-nums">{formatCurrency(split.payableTotal)}</dd>
        </div>
      </dl>
    </div>
  )
}
