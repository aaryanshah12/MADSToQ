import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from '@/crm/router'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Clock,
  KeyRound,
  Lock,
  Search,
  Wallet,
} from 'lucide-react'
import { useBookings } from '../context/BookingContext'
import { useAuth } from '../context/AuthContext'
import { useOtherPayments } from '../context/OtherPaymentContext'
import { usePayments } from '../context/PaymentContext'
import { usePlots } from '../context/PlotContext'
import { useSchemes } from '../context/SchemeContext'
import { formatCurrency } from '../lib/schemes'
import { buildHandoverOtherContext } from '../lib/handoverOther'
import { USER_ROLE_LABELS } from '../types/auth'
import {
  CATEGORY_LABELS,
  PAYMENT_MODE_LABELS,
  PLAN_DURATION_LABELS,
  assessHandover,
  categoryTotals,
  handoverBlockReason,
  isHandoverReady,
  type InstallmentRecord,
  type PaymentMode,
  type PlanDuration,
} from '../types/payments'
import { bookingFinancialSummary } from '../lib/bookingFinance'
import { bookingPlotIds, todayISO, type BookingRecord } from '../types/sales'
import { buildScheduleInputFromBooking, scheduleMatchesBooking } from '../lib/bookingPaymentSchedule'
import { quotaForBookingCategory } from '../lib/paymentBuckets'
import { CollectPaymentDialog } from '../components/payments/CollectPaymentDialog'
import { LumpSumCollectDialog } from '../components/payments/LumpSumCollectDialog'
import { ReceiptDetailDialog } from '../components/payments/ReceiptDetailDialog'
import { DueDetailDialog } from '../components/payments/DueDetailDialog'
import { TokenCollectedNote } from '../components/payments/TokenCollectedNote'
import { HandoverDialog } from '../components/booking/HandoverDialog'
import { Button, Card, Field, Input, Select, Textarea } from '../components/ui/Form'

function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDueDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Calendar days from due date until today (0 if not overdue). */
function overdueDays(dueDate: string, today: string): number {
  if (!dueDate || dueDate >= today) return 0
  const [y1, m1, d1] = dueDate.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.max(0, Math.round((b - a) / 86400000))
}

const OVERDUE_FILTER = 'overdue'
const TODAY_FILTER = 'today'
const HISTORY_FILTER = 'history'

/** Current month + next 11 months */
function upcomingMonthOptions(count = 12) {
  const now = new Date()
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    keys.push(currentMonthKey(d))
  }
  return keys
}

type DueSortKey =
  | 'dueDate'
  | 'client'
  | 'salesPerson'
  | 'broker'
  | 'property'
  | 'amount'
  | 'overdueDays'

type DueSortDir = 'asc' | 'desc'

type DuePart = {
  installment: InstallmentRecord
  balance: number
  locked: boolean
}

type DueRow = {
  key: string
  booking: BookingRecord
  dueDate: string
  parts: DuePart[]
  /** Sum of all part balances */
  balance: number
  /** Unlocked balances only (collectible now) */
  collectibleBalance: number
  /** True when every unpaid part is locked */
  locked: boolean
  /** True when at least one part is locked */
  hasLocked: boolean
  overdue: boolean
  /** Days past due (0 if not overdue) */
  overdueDays: number
}

function groupDueRows(
  installments: InstallmentRecord[],
  selectedMonth: string,
  bookingById: Map<string, BookingRecord>,
  today: string,
): DueRow[] {
  const groups = new Map<string, DueRow>()
  const current = currentMonthKey()
  const todayOnly = selectedMonth === TODAY_FILTER
  const overdueOnly = selectedMonth === OVERDUE_FILTER
  // On current month, also include past-due installments from earlier months
  const includePastOverdue = selectedMonth === current

  for (const inst of installments) {
    const balance = Math.max(0, inst.amount - inst.paidAmount)
    if (balance <= 0) continue

    const isOverdue = inst.dueDate < today
    const isDueToday = inst.dueDate === today
    const inSelectedMonth =
      !todayOnly &&
      !overdueOnly &&
      inst.dueDate.startsWith(selectedMonth)

    if (todayOnly) {
      if (!isDueToday) continue
    } else if (overdueOnly) {
      if (!isOverdue) continue
    } else if (includePastOverdue) {
      if (!inSelectedMonth && !isOverdue) continue
    } else if (!inSelectedMonth) {
      continue
    }

    const b = bookingById.get(inst.bookingId)
    if (!b) continue
    if (
      b.status !== 'booked' &&
      b.status !== 'reserved' &&
      b.status !== 'completed'
    ) {
      continue
    }

    const locked = false
    const key = `${inst.bookingId}|${inst.dueDate}`
    const existing = groups.get(key)
    const days = overdueDays(inst.dueDate, today)

    if (existing) {
      existing.parts.push({ installment: inst, balance, locked })
      existing.balance += balance
      if (!locked) existing.collectibleBalance += balance
      existing.hasLocked = existing.hasLocked || locked
      existing.locked = existing.parts.every((p) => p.locked)
      continue
    }

    groups.set(key, {
      key,
      booking: b,
      dueDate: inst.dueDate,
      parts: [{ installment: inst, balance, locked }],
      balance,
      collectibleBalance: locked ? 0 : balance,
      locked,
      hasLocked: locked,
      overdue: isOverdue,
      overdueDays: days,
    })
  }

  return Array.from(groups.values()).map((row) => {
    row.parts.sort((a, b) => {
      if (a.installment.category !== b.installment.category) {
        return a.installment.category === 'land' ? -1 : 1
      }
      return a.installment.sequence - b.installment.sequence
    })
    row.locked = row.parts.every((p) => p.locked)
    row.hasLocked = row.parts.some((p) => p.locked)
    row.collectibleBalance = row.parts
      .filter((p) => !p.locked)
      .reduce((s, p) => s + p.balance, 0)
    row.overdue = row.dueDate < today
    row.overdueDays = overdueDays(row.dueDate, today)
    return row
  })
}

function sortDueRows(
  rows: DueRow[],
  sortKey: DueSortKey,
  sortDir: DueSortDir,
  schemeNameOf: (id: string) => string,
): DueRow[] {
  const dir = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'dueDate':
        cmp = a.dueDate.localeCompare(b.dueDate)
        break
      case 'client':
        cmp = a.booking.customerName.localeCompare(b.booking.customerName)
        break
      case 'salesPerson':
        cmp = (a.booking.salesPerson || '').localeCompare(
          b.booking.salesPerson || '',
        )
        break
      case 'broker': {
        const aBroker = a.booking.viaBroker
          ? a.booking.broker?.fullName || 'Broker'
          : 'Direct'
        const bBroker = b.booking.viaBroker
          ? b.booking.broker?.fullName || 'Broker'
          : 'Direct'
        cmp = aBroker.localeCompare(bBroker)
        break
      }
      case 'property':
        cmp = schemeNameOf(a.booking.schemeId).localeCompare(
          schemeNameOf(b.booking.schemeId),
        )
        break
      case 'amount':
        cmp = a.balance - b.balance
        break
      case 'overdueDays':
        cmp = a.overdueDays - b.overdueDays
        break
      default:
        cmp = 0
    }
    if (cmp !== 0) return cmp * dir
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    return a.booking.customerName.localeCompare(b.booking.customerName)
  })
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: DueSortDir
  onClick: () => void
  align?: 'left' | 'right'
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      className={`px-2 py-2.5 font-semibold ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition hover:bg-surface-2 hover:text-ink ${
          active ? 'text-ink' : 'text-ink-faint'
        } ${align === 'right' ? 'ml-auto flex-row-reverse' : ''}`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3 shrink-0 opacity-70" />
      </button>
    </th>
  )
}


export function PaymentsPage() {
  const [params, setParams] = useSearchParams()
  const { bookings, updateBooking, getBooking } = useBookings()
  const { user } = useAuth()
  const canCollect = user?.role !== 'sales'
  const canHandover = user?.role === 'admin' || user?.role === 'accountant'
  const { schemes, getScheme } = useSchemes()
  const { plots } = usePlots()
  const { receipts: otherReceipts } = useOtherPayments()
  const {
    installments,
    receipts: allReceipts,
    getPlanByBooking,
    getInstallmentsByBooking,
    getReceiptsByBooking,
    createPlan,
    ensureConstructionSchedule,
    deletePlanForBooking,
    recordPayment,
    recordLumpSum,
  } = usePayments()

  const otherCtx = (b: BookingRecord) =>
    buildHandoverOtherContext(b, getScheme(b.schemeId), plots, otherReceipts)

  const financeFor = (
    b: BookingRecord,
    inst = getInstallmentsByBooking(b.id),
  ) =>
    bookingFinancialSummary(
      b,
      inst,
      getReceiptsByBooking(b.id),
      getScheme(b.schemeId),
    )

  const collector = user
    ? {
        collectedByUserId: user.id,
        collectedByName: user.name,
        collectedByRole: USER_ROLE_LABELS[user.role],
      }
    : {}

  const [handoverPromptBookingId, setHandoverPromptBookingId] = useState<
    string | null
  >(null)
  const [handoverBookingId, setHandoverBookingId] = useState<string | null>(
    null,
  )

  const checkHandoverAfterPayment = (
    bookingId: string,
    paidNow: number,
    /** When known (lump sum), the installment ids that just received money. */
    touchedInstallmentIds?: string[],
  ) => {
    const b = getBooking(bookingId) || bookings.find((x) => x.id === bookingId)
    if (!b || !canHandover) return
    if (b.handoverAt || b.status === 'cancelled') return

    const current = getInstallmentsByBooking(bookingId)
    // Context may not have flushed this payment yet — simulate applying it.
    let projected = current
    if (paidNow > 0 && current.some((i) => i.paidAmount + 0.001 < i.amount)) {
      let left = Math.round(paidNow)
      const prefer = new Set(touchedInstallmentIds || [])
      const order = [...current].sort((a, b) => {
        if (prefer.size) {
          const ap = prefer.has(a.id) ? 0 : 1
          const bp = prefer.has(b.id) ? 0 : 1
          if (ap !== bp) return ap - bp
        }
        if (a.category !== b.category) {
          return a.category === 'land' ? -1 : 1
        }
        return a.sequence - b.sequence
      })
      const paidMap = new Map(current.map((i) => [i.id, i.paidAmount]))
      for (const inst of order) {
        if (left <= 0) break
        const paid = paidMap.get(inst.id) || 0
        const bal = Math.max(0, Math.round(inst.amount) - Math.round(paid))
        if (bal <= 0) continue
        const apply = Math.min(bal, left)
        paidMap.set(inst.id, paid + apply)
        left -= apply
      }
      projected = current.map((i) => ({
        ...i,
        paidAmount: paidMap.get(i.id) ?? i.paidAmount,
      }))
    }

    if (isHandoverReady(b, projected, otherCtx(b), financeFor(b, projected).gstPending)) {
      setHandoverPromptBookingId(bookingId)
      return
    }

    // Fallback: money formula (progress bar) — covers edge cases without a schedule
    const finance = financeFor(b, current)
    if (finance.total <= 0) return
    const coversBalance =
      (finance.pending <= 0 || paidNow + 0.001 >= finance.pending) &&
      finance.gstPending <= 0
    if (coversBalance) setHandoverPromptBookingId(bookingId)
  }

  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === 'booked' ||
          b.status === 'reserved' ||
          b.status === 'completed',
      ),
    [bookings],
  )

  // Backfill / resync EMI schedules one booking at a time (createPlan is not batch-safe)
  useEffect(() => {
    const needsConstruction = activeBookings.find((b) => {
      const input = buildScheduleInputFromBooking(b, getScheme(b.schemeId))
      if (!input || input.constructionAmount <= 0) return false
      const inst = getInstallmentsByBooking(b.id)
      return !inst.some((i) => i.category === 'construction')
    })
    if (needsConstruction) {
      const input = buildScheduleInputFromBooking(
        needsConstruction,
        getScheme(needsConstruction.schemeId),
      )
      if (input) ensureConstructionSchedule(input)
      return
    }

    const needsSync = activeBookings.find((b) => {
      const inst = getInstallmentsByBooking(b.id)
      if (inst.some((i) => i.paidAmount > 0)) return false
      if (inst.length === 0) {
        return Boolean(buildScheduleInputFromBooking(b, getScheme(b.schemeId)))
      }
      return !scheduleMatchesBooking(b, getScheme(b.schemeId), inst)
    })
    if (!needsSync) return
    const input = buildScheduleInputFromBooking(
      needsSync,
      getScheme(needsSync.schemeId),
    )
    if (input) createPlan(input)
  }, [
    activeBookings,
    createPlan,
    ensureConstructionSchedule,
    getInstallmentsByBooking,
    getScheme,
    installments,
  ])

  const monthOptions = useMemo(() => upcomingMonthOptions(12), [])
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey())
  const [sortKey, setSortKey] = useState<DueSortKey>('dueDate')
  const [sortDir, setSortDir] = useState<DueSortDir>('asc')
  const [listQuery, setListQuery] = useState('')

  const toggleSort = (key: DueSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'amount' ? 'desc' : 'asc')
  }

  const bookingId = params.get('booking') || ''
  const booking = bookingId
    ? bookings.find((b) => b.id === bookingId)
    : undefined
  const plan = bookingId ? getPlanByBooking(bookingId) : undefined
  const bookingInstallments = bookingId
    ? getInstallmentsByBooking(bookingId)
    : []
  const receipts = bookingId ? getReceiptsByBooking(bookingId) : []
  const landTotals = categoryTotals(bookingInstallments, 'land')
  const constructionTotals = categoryTotals(bookingInstallments, 'construction')

  const quoted = Number(booking?.quotedPrice || 0)
  const bookingPaid = Number(booking?.bookingAmount || 0)
  const remainingAfterBooking = Math.max(0, quoted - bookingPaid)

  const [planDuration, setPlanDuration] = useState<PlanDuration>('12')
  const [customMonths, setCustomMonths] = useState('18')
  const [landAmount, setLandAmount] = useState('')
  const [constructionAmount, setConstructionAmount] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [payInstallmentId, setPayInstallmentId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState<PaymentMode>('upi')
  const [payDate, setPayDate] = useState(todayISO())
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collectOpen, setCollectOpen] = useState(false)
  const [collectBooking, setCollectBooking] = useState<BookingRecord | null>(
    null,
  )
  const [collectInstallmentId, setCollectInstallmentId] = useState('')
  const [collectOverdueDays, setCollectOverdueDays] = useState(0)
  const [lumpSumOpen, setLumpSumOpen] = useState(false)
  const [lumpSumBookingId, setLumpSumBookingId] = useState<string | undefined>()
  const [lumpSumScopeIds, setLumpSumScopeIds] = useState<string[] | undefined>()
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null)
  const [viewDueKey, setViewDueKey] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const bookingById = useMemo(() => {
    const map = new Map(bookings.map((b) => [b.id, b]))
    return map
  }, [bookings])

  const today = todayISO()

  const dueRows = useMemo(
    () => groupDueRows(installments, selectedMonth, bookingById, today),
    [installments, selectedMonth, bookingById, today],
  )

  const schemeName = (id: string) =>
    schemes.find((s) => s.id === id)?.schemeName || '—'
  const plotLabel = (id: string) => {
    const p = plots.find((x) => x.id === id)
    return p ? `Plot ${p.plotNumber}` : '—'
  }
  const bookingPlotsLabel = (b: BookingRecord) => {
    const ids = bookingPlotIds(b)
    if (!ids.length) return '—'
    return ids.map(plotLabel).join(', ')
  }

  const filteredDueRows = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return dueRows
    return dueRows.filter((row) => {
      const b = row.booking
      const plotNums = bookingPlotIds(b)
        .map((id) => plots.find((p) => p.id === id)?.plotNumber)
        .filter(Boolean)
      const scheme = schemes.find((s) => s.id === b.schemeId)
      const haystack = [
        b.customerName,
        b.customerPhone,
        b.bookingCode,
        b.salesPerson,
        b.broker?.fullName,
        ...plotNums,
        ...plotNums.map((n) => `plot ${n}`),
        scheme?.schemeName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [dueRows, listQuery, plots, schemes])

  const sortedDueRows = useMemo(
    () => sortDueRows(filteredDueRows, sortKey, sortDir, schemeName),
    [filteredDueRows, sortKey, sortDir, schemes],
  )

  const isOverdueView = selectedMonth === OVERDUE_FILTER
  const isTodayView = selectedMonth === TODAY_FILTER
  const isHistoryView = selectedMonth === HISTORY_FILTER
  const isMonthView = !isOverdueView && !isTodayView && !isHistoryView
  const currentMonth = currentMonthKey()
  const listTitle = isHistoryView
    ? 'Payment history'
    : isOverdueView
      ? 'Overdue'
      : isTodayView
        ? `Today · ${formatDueDate(today)}`
        : monthLabel(selectedMonth)

  const installmentById = useMemo(() => {
    const map = new Map(installments.map((i) => [i.id, i]))
    return map
  }, [installments])

  const historyRows = useMemo(() => {
    const rows = allReceipts
      .map((receipt) => {
        const booking = bookingById.get(receipt.bookingId)
        if (!booking) return null
        return {
          receipt,
          booking,
          installment: installmentById.get(receipt.installmentId),
        }
      })
      .filter(Boolean) as Array<{
      receipt: (typeof allReceipts)[number]
      booking: BookingRecord
      installment: InstallmentRecord | undefined
    }>

    const q = listQuery.trim().toLowerCase()
    const filtered = !q
      ? rows
      : rows.filter(({ receipt, booking }) => {
          const plotNums = bookingPlotIds(booking)
            .map((id) => plots.find((p) => p.id === id)?.plotNumber)
            .filter(Boolean)
          const scheme = schemes.find((s) => s.id === booking.schemeId)
          const hay = [
            booking.customerName,
            booking.customerPhone,
            booking.bookingCode,
            ...plotNums,
            ...plotNums.map((n) => `plot ${n}`),
            scheme?.schemeName,
            receipt.reference,
            PAYMENT_MODE_LABELS[receipt.mode],
            receipt.instrument?.chequeNumber,
            receipt.instrument?.utrNumber,
            receipt.instrument?.upiTxnId,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return hay.includes(q)
        })

    return filtered.sort((a, b) => {
      if (a.receipt.paidOn !== b.receipt.paidOn) {
        return b.receipt.paidOn.localeCompare(a.receipt.paidOn)
      }
      return b.receipt.createdAt.localeCompare(a.receipt.createdAt)
    })
  }, [allReceipts, bookingById, installmentById, listQuery, plots, schemes])

  const historySummary = useMemo(() => {
    const total = historyRows.reduce(
      (s, r) =>
        s +
        Math.round(Number(r.receipt.amount) || 0) +
        Math.round(Number(r.receipt.gstAmount) || 0),
      0,
    )
    const byMode = historyRows.reduce(
      (acc, r) => {
        const gross =
          Math.round(Number(r.receipt.amount) || 0) +
          Math.round(Number(r.receipt.gstAmount) || 0)
        acc[r.receipt.mode] = (acc[r.receipt.mode] || 0) + gross
        return acc
      },
      {} as Partial<Record<PaymentMode, number>>,
    )
    return {
      count: historyRows.length,
      total,
      cash: byMode.cash || 0,
      gstBucket:
        (byMode.cheque || 0) +
        (byMode.upi || 0) +
        (byMode.neft || 0) +
        (byMode.other || 0),
    }
  }, [historyRows])

  const queueCounts = useMemo(() => {
    const todayRows = groupDueRows(
      installments,
      TODAY_FILTER,
      bookingById,
      today,
    )
    const overdueRows = groupDueRows(
      installments,
      OVERDUE_FILTER,
      bookingById,
      today,
    )
    const monthRows = groupDueRows(
      installments,
      currentMonth,
      bookingById,
      today,
    )
    return {
      today: todayRows.length,
      overdue: overdueRows.length,
      month: monthRows.length,
      history: allReceipts.length,
      overdueAmount: overdueRows
        .filter((r) => r.collectibleBalance > 0)
        .reduce((s, r) => s + r.collectibleBalance, 0),
    }
  }, [installments, bookingById, today, currentMonth, allReceipts.length])

  const setView = (next: string) => {
    setSelectedMonth(next)
    if (next === OVERDUE_FILTER) {
      setSortKey('overdueDays')
      setSortDir('desc')
    } else {
      setSortKey('dueDate')
      setSortDir('asc')
    }
  }

  const monthSummary = useMemo(() => {
    const collectibleRows = filteredDueRows.filter(
      (r) => r.collectibleBalance > 0,
    )
    const overdueRows = collectibleRows.filter((r) => r.overdue)
    const oldestDays = overdueRows.reduce(
      (max, r) => Math.max(max, r.overdueDays),
      0,
    )
    return {
      count: filteredDueRows.length,
      collectible: collectibleRows.length,
      totalDue: collectibleRows.reduce((s, r) => s + r.collectibleBalance, 0),
      overdueCount: overdueRows.length,
      overdueAmount: overdueRows.reduce((s, r) => s + r.collectibleBalance, 0),
      oldestDays,
      lockedParts: filteredDueRows.filter((r) => r.hasLocked).length,
    }
  }, [filteredDueRows])

  useEffect(() => {
    if (!booking || plan) return
    const quote = Number(booking.quotedPrice || 0)
    const advance = Number(booking.bookingAmount || 0)
    const remaining = Math.max(0, quote - advance)
    const landDefault = remaining > 0 ? Math.round(remaining * 0.6) : 0
    const constDefault =
      remaining > 0 ? Math.max(0, remaining - landDefault) : 0
    setLandAmount(landDefault ? String(landDefault) : '')
    setConstructionAmount(constDefault ? String(constDefault) : '')
    setStartDate(
      booking.landInstallmentDueDate ||
        booking.constructionInstallmentDueDate ||
        booking.bookingDate ||
        todayISO(),
    )
  }, [booking, plan])

  const openCollect = (row: DueRow) => {
    if (!canCollect) {
      flash('Only accounts or admin can collect payments')
      return
    }
    const collectibleParts = row.parts.filter((p) => !p.locked && p.balance > 0)
    if (collectibleParts.length === 0) {
      flash('Nothing collectible on this installment')
      return
    }
    // Same-day land + construction (or multiple EMIs) → collect both together
    if (collectibleParts.length > 1) {
      setLumpSumBookingId(row.booking.id)
      setLumpSumScopeIds(collectibleParts.map((p) => p.installment.id))
      setLumpSumOpen(true)
      setError(null)
      return
    }
    setCollectBooking(row.booking)
    setCollectInstallmentId(collectibleParts[0].installment.id)
    setCollectOverdueDays(row.overdueDays)
    setError(null)
    setCollectOpen(true)
  }

  const openLumpSum = (preferredBookingId?: string) => {
    setLumpSumBookingId(preferredBookingId)
    setLumpSumScopeIds(undefined)
    setLumpSumOpen(true)
  }

  const closeLumpSum = () => {
    setLumpSumOpen(false)
    setLumpSumBookingId(undefined)
    setLumpSumScopeIds(undefined)
  }

  const closeCollect = () => {
    setCollectOpen(false)
    setCollectBooking(null)
    setCollectInstallmentId('')
    setCollectOverdueDays(0)
  }

  const handleCollectSubmit = (input: {
    installmentId: string
    amount: number
    gstAmount: number
    paidOn: string
    mode: PaymentMode
    instrument: import('../types/payments').PaymentInstrumentDetails
    notes: string
  }) => {
    if (!canCollect) {
      flash('Only accounts or admin can collect payments')
      return
    }
    try {
      recordPayment({
        installmentId: input.installmentId,
        amount: input.amount,
        gstAmount: input.gstAmount,
        paidOn: input.paidOn,
        mode: input.mode,
        instrument: input.instrument,
        notes: input.notes,
        ...collector,
      })
      closeCollect()
      flash(
        input.gstAmount > 0
          ? `Payment recorded · EMI ${formatCurrency(input.amount)} + GST ${formatCurrency(input.gstAmount)}`
          : 'Payment recorded',
      )
      const inst = installments.find((i) => i.id === input.installmentId)
      if (inst) {
        checkHandoverAfterPayment(inst.bookingId, input.amount, [
          input.installmentId,
        ])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
      flash(e instanceof Error ? e.message : 'Payment failed')
    }
  }

  const lumpSumOptions = useMemo(() => {
    return activeBookings
      .map((b) => {
        const inst = getInstallmentsByBooking(b.id)
        const unpaid = inst.reduce(
          (s, i) => s + Math.max(0, i.amount - i.paidAmount),
          0,
        )
        if (unpaid <= 0) return null
        const bookingReceipts = getReceiptsByBooking(b.id)
        const scheme = getScheme(b.schemeId)
        return {
          booking: b,
          propertyLabel: `${schemeName(b.schemeId)} · ${bookingPlotsLabel(b)}`,
          installments: inst,
          landQuota: quotaForBookingCategory(
            b,
            'land',
            inst,
            bookingReceipts,
            scheme,
          ),
          constructionQuota: quotaForBookingCategory(
            b,
            'construction',
            inst,
            bookingReceipts,
            scheme,
          ),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) =>
        a.booking.customerName.localeCompare(b.booking.customerName),
      )
  }, [
    activeBookings,
    getInstallmentsByBooking,
    getReceiptsByBooking,
    getScheme,
    installments,
    allReceipts,
    schemes,
    plots,
  ])

  const handleLumpSumSubmit = (input: {
    bookingId: string
    allocations: { installmentId: string; amount: number; gstAmount: number }[]
    amount: number
    paidOn: string
    mode: PaymentMode
    instrument: import('../types/payments').PaymentInstrumentDetails
    notes: string
  }) => {
    if (!canCollect) {
      flash('Only accounts or admin can collect payments')
      return
    }
    try {
      const receipts = recordLumpSum({
        bookingId: input.bookingId,
        allocations: input.allocations,
        paidOn: input.paidOn,
        mode: input.mode,
        instrument: input.instrument,
        notes: input.notes,
        ...collector,
      })
      const gstTotal = input.allocations.reduce(
        (s, a) => s + (a.gstAmount || 0),
        0,
      )
      const principalTotal = input.allocations.reduce((s, a) => s + a.amount, 0)
      setLumpSumOpen(false)
      setLumpSumBookingId(undefined)
      setLumpSumScopeIds(undefined)
      flash(
        gstTotal > 0
          ? `Lump sum recorded · EMI ${formatCurrency(principalTotal)} + GST ${formatCurrency(gstTotal)} · ${receipts.length} EMI${receipts.length === 1 ? '' : 's'}`
          : `Lump sum recorded · ${receipts.length} EMI${receipts.length === 1 ? '' : 's'}`,
      )
      checkHandoverAfterPayment(
        input.bookingId,
        principalTotal,
        input.allocations.map((a) => a.installmentId),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lump sum failed')
      flash(e instanceof Error ? e.message : 'Lump sum failed')
    }
  }

  const handleCreatePlan = () => {
    if (!canCollect) {
      flash('Only accounts or admin can manage payment plans')
      return
    }
    if (!bookingId) return
    const land = Number(landAmount)
    const construction = Number(constructionAmount)
    if (!Number.isFinite(land) || land < 0) {
      setError('Enter a valid land amount')
      return
    }
    if (!Number.isFinite(construction) || construction < 0) {
      setError('Enter a valid construction amount')
      return
    }
    if (land <= 0 && construction <= 0) {
      setError('At least one of land or construction amount is required')
      return
    }
    if (planDuration === 'custom' && Number(customMonths) < 1) {
      setError('Custom months must be at least 1')
      return
    }

    createPlan({
      bookingId,
      planDuration,
      customMonths: Number(customMonths) || 1,
      landAmount: land,
      constructionAmount: construction,
      startDate,
      constructionStartDate: construction > 0 ? startDate : undefined,
    })
    setError(null)
    flash('Payment plan created')
  }

  const handlePay = () => {
    setError(null)
    if (!canCollect) {
      setError('Only accounts or admin can collect payments')
      return
    }
    if (!payInstallmentId) {
      setError('Select an installment')
      return
    }
    const amount = Number(payAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid payment amount')
      return
    }
    try {
      recordPayment({
        installmentId: payInstallmentId,
        amount,
        paidOn: payDate,
        mode: payMode,
        reference: payRef,
        notes: payNotes,
        ...collector,
      })
      setPayAmount('')
      setPayRef('')
      setPayNotes('')
      setPayInstallmentId('')
      flash('Payment recorded')
      const inst = installments.find((i) => i.id === payInstallmentId)
      if (inst) {
        checkHandoverAfterPayment(inst.bookingId, amount, [payInstallmentId])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
    }
  }

  const readyForHandoverBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        b.status !== 'cancelled' &&
        isHandoverReady(
          b,
          getInstallmentsByBooking(b.id),
          otherCtx(b),
          financeFor(b).gstPending,
        ),
    )
  }, [
    bookings,
    getInstallmentsByBooking,
    getScheme,
    allReceipts,
    installments,
    otherReceipts,
    plots,
  ])

  const blockedHandoverHints = useMemo(() => {
    return bookings
      .map((b) => {
        const gate = assessHandover(
          b,
          getInstallmentsByBooking(b.id),
          otherCtx(b),
          financeFor(b).gstPending,
        )
        if (!gate.landPaid || gate.ready) return null
        return {
          booking: b,
          reason:
            gate.blockReason ||
            handoverBlockReason(
              b,
              getInstallmentsByBooking(b.id),
              otherCtx(b),
              financeFor(b).gstPending,
            ),
          requireConstructionConfig: gate.requireConstructionConfig,
          suggestMoreConstruction: gate.suggestMoreConstruction,
        }
      })
      .filter(Boolean) as {
      booking: BookingRecord
      reason: string | null
      requireConstructionConfig: boolean
      suggestMoreConstruction: boolean
    }[]
  }, [
    bookings,
    getInstallmentsByBooking,
    getScheme,
    allReceipts,
    installments,
    otherReceipts,
    plots,
  ])

  if (activeBookings.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <div className="py-8 text-center">
            <Wallet className="mx-auto h-10 w-10 text-brand" />
            <h1 className="mt-3 font-display text-2xl">No bookings yet</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Create a booking and payment plan first to see pending dues.
            </p>
            <Link to="/bookings" className="mt-5 inline-block">
              <Button>Go to Bookings</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const selectedPayRow = dueRows.find((r) =>
    r.parts.some((p) => p.installment.id === payInstallmentId),
  )
  const selectedPayPart = selectedPayRow?.parts.find(
    (p) => p.installment.id === payInstallmentId,
  )

  const collectInstallment = collectInstallmentId
    ? installments.find((i) => i.id === collectInstallmentId)
    : undefined
  const collectBalance = collectInstallment
    ? Math.max(0, collectInstallment.amount - collectInstallment.paidAmount)
    : 0
  const collectQuota =
    collectOpen && collectBooking && collectInstallment
      ? quotaForBookingCategory(
          collectBooking,
          collectInstallment.category,
          installments,
          getReceiptsByBooking(collectBooking.id),
          getScheme(collectBooking.schemeId),
        )
      : null
  const historyDetail = historyDetailId
    ? historyRows.find((r) => r.receipt.id === historyDetailId)
    : undefined

  const handoverPromptBooking = handoverPromptBookingId
    ? bookings.find((b) => b.id === handoverPromptBookingId)
    : undefined
  const handoverBooking = handoverBookingId
    ? bookings.find((b) => b.id === handoverBookingId)
    : undefined

  const confirmHandover = (input: { handoverDate: string; note: string }) => {
    if (!handoverBookingId || !user) return
    const booking = bookings.find((b) => b.id === handoverBookingId)
    if (!booking) return
    if (
      !isHandoverReady(
        booking,
        getInstallmentsByBooking(booking.id),
        otherCtx(booking),
        financeFor(booking).gstPending,
      )
    ) {
      flash(
        'Land, construction, GST, and other payments must be complete before handover',
      )
      setHandoverBookingId(null)
      setHandoverPromptBookingId(null)
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
    setHandoverPromptBookingId(null)
    flash('Plot handed over — booking completed, plot sold')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              Collections
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
              Pending Payments
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              {canCollect
                ? 'Collect what’s due — start with this month, jump to today or overdue.'
                : 'View what’s due — payment collection is handled by accounts.'}
            </p>
          </div>
          {canCollect && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => openLumpSum()}
              disabled={lumpSumOptions.length === 0}
            >
              <Wallet className="h-4 w-4" />
              Collect lump sum
            </Button>
          )}
        </div>

        {canHandover && readyForHandoverBookings.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-brand/30 bg-brand-soft/40 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Ready for handover
                </p>
                <p className="text-xs text-ink-muted">
                  Fully paid deals waiting for plot handover
                  {handoverPromptBooking
                    ? ' · just cleared with your last payment'
                    : ''}
                </p>
              </div>
              <span className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-ink">
                {readyForHandoverBookings.length}
              </span>
            </div>
            <ul className="space-y-2">
              {readyForHandoverBookings.map((b) => {
                const justPaid = b.id === handoverPromptBookingId
                const gate = assessHandover(
                  b,
                  getInstallmentsByBooking(b.id),
                  otherCtx(b),
                  financeFor(b).gstPending,
                )
                return (
                  <li
                    key={b.id}
                    className={`flex flex-col gap-2 rounded-xl border bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                      justPaid
                        ? 'border-brand/50 shadow-sm'
                        : 'border-line'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {b.customerName}
                        {justPaid && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-brand">
                            Just paid
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {b.bookingCode} · {schemeName(b.schemeId)} ·{' '}
                        {bookingPlotsLabel(b)}
                        {gate.suggestMoreConstruction
                          ? ' · more construction optional'
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {gate.suggestMoreConstruction && (
                        <Link
                          to="/bookings"
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2"
                        >
                          Add construction
                        </Link>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setHandoverBookingId(b.id)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Hand over plot
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {canHandover &&
          handoverPromptBooking &&
          !readyForHandoverBookings.some(
            (b) => b.id === handoverPromptBooking.id,
          ) && (
            <div className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Last payment cleared this deal — ready for handover
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {handoverPromptBooking.customerName} ·{' '}
                  {handoverPromptBooking.bookingCode} ·{' '}
                  {schemeName(handoverPromptBooking.schemeId)} ·{' '}
                  {bookingPlotsLabel(handoverPromptBooking)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setHandoverBookingId(handoverPromptBooking.id)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Hand over plot
              </Button>
            </div>
          )}

        {canHandover &&
          readyForHandoverBookings.length === 0 &&
          blockedHandoverHints.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                Almost ready for handover
              </p>
              <ul className="mt-2 space-y-2">
                {blockedHandoverHints.map(
                  ({
                    booking: b,
                    reason,
                    requireConstructionConfig,
                  }) => (
                    <li
                      key={b.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="text-xs text-ink-muted">
                        <span className="font-semibold text-ink">
                          {b.customerName}
                        </span>
                        {' · '}
                        {b.bookingCode}
                        {reason ? ` — ${reason}` : ''}
                      </p>
                      {requireConstructionConfig && (
                        <Link
                          to="/bookings"
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-brand-ink"
                        >
                          Configure construction
                        </Link>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="inline-flex rounded-xl bg-surface-2 p-1"
              role="tablist"
              aria-label="Payment queue"
            >
              {(
                [
                  {
                    id: currentMonth,
                    label: 'This month',
                    count: queueCounts.month,
                    active: isMonthView && selectedMonth === currentMonth,
                  },
                  {
                    id: TODAY_FILTER,
                    label: 'Today',
                    count: queueCounts.today,
                    active: isTodayView,
                  },
                  {
                    id: OVERDUE_FILTER,
                    label: 'Overdue',
                    count: queueCounts.overdue,
                    active: isOverdueView,
                  },
                  {
                    id: HISTORY_FILTER,
                    label: 'History',
                    count: queueCounts.history,
                    active: isHistoryView,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={tab.active}
                  onClick={() => setView(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    tab.active
                      ? tab.id === OVERDUE_FILTER
                        ? 'bg-danger text-white shadow-sm'
                        : 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                      tab.active
                        ? tab.id === OVERDUE_FILTER
                          ? 'bg-white/20 text-white'
                          : 'bg-surface-2 text-ink-muted'
                        : 'bg-surface text-ink-faint'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {!isHistoryView && (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-ink-faint sm:inline">
                  Or pick a month
                </span>
                <div className="relative min-w-[180px] flex-1 sm:flex-none">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                  <Select
                    value={isMonthView ? selectedMonth : currentMonth}
                    onChange={(e) => setView(e.target.value)}
                    className="h-9 pl-9 text-xs"
                    aria-label="Select due month"
                  >
                    {monthOptions.map((key, index) => (
                      <option key={key} value={key}>
                        {monthLabel(key)}
                        {index === 0 ? ' (current)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder={
                isHistoryView
                  ? 'Search receipts by client, plot, UTR, cheque…'
                  : 'Search client name or plot number…'
              }
              className="pl-9"
              aria-label="Search"
            />
          </div>
        </div>
      </div>

      {isHistoryView ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Receipts
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                {historySummary.count}
              </p>
              <p className="text-xs text-ink-muted">Collected payments</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Total collected
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-brand">
                {formatCurrency(historySummary.total)}
              </p>
              <p className="text-xs text-ink-muted">All modes</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                Split
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                Cash {formatCurrency(historySummary.cash)}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
                Cheque/UPI/NEFT {formatCurrency(historySummary.gstBucket)}
              </p>
            </div>
          </div>

          <Card
            title="Payment history"
            description="All installment collections recorded in the system."
          >
            {historyRows.length === 0 ? (
              <div className="py-10 text-center">
                <Wallet className="mx-auto h-8 w-8 text-ink-faint" />
                <p className="mt-3 text-sm font-semibold text-ink">
                  {listQuery.trim() ? 'No matches' : 'No payments collected yet'}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {listQuery.trim()
                    ? `No receipts match “${listQuery.trim()}”.`
                    : 'Use Collect on a pending installment to record the first payment.'}
                </p>
                {listQuery.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setListQuery('')}
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="px-2 py-2.5 font-semibold">Paid on</th>
                      <th className="px-2 py-2.5 font-semibold">Client</th>
                      <th className="px-2 py-2.5 font-semibold">Property</th>
                      <th className="px-2 py-2.5 font-semibold">Installment</th>
                      <th className="px-2 py-2.5 font-semibold">Mode</th>
                      <th className="px-2 py-2.5 font-semibold">Reference</th>
                      <th className="px-2 py-2.5 text-right font-semibold">
                        Amount
                      </th>
                      <th className="px-2 py-2.5 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map(({ receipt, booking, installment }) => (
                      <tr
                        key={receipt.id}
                        className="border-b border-line last:border-0 hover:bg-surface-2/40"
                      >
                        <td className="px-2 py-3 align-top whitespace-nowrap">
                          <div className="font-semibold tabular-nums text-ink">
                            {formatDueDate(receipt.paidOn)}
                          </div>
                        </td>
                        <td className="px-2 py-3 align-top">
                          <div className="font-semibold text-ink">
                            {booking.customerName}
                          </div>
                          <div className="font-mono text-[11px] text-ink-faint">
                            {booking.bookingCode}
                          </div>
                        </td>
                        <td className="px-2 py-3 align-top text-ink-muted">
                          <div className="font-medium text-ink">
                            {schemeName(booking.schemeId)}
                          </div>
                          <div className="text-[11px]">
                            {bookingPlotsLabel(booking)}
                          </div>
                        </td>
                        <td className="px-2 py-3 align-top">
                          <div className="font-medium text-ink">
                            {installment?.label || 'Installment'}
                          </div>
                          <div className="text-[11px] text-ink-muted">
                            {CATEGORY_LABELS[receipt.category]}
                          </div>
                        </td>
                        <td className="px-2 py-3 align-top text-ink-muted">
                          {PAYMENT_MODE_LABELS[receipt.mode]}
                        </td>
                        <td className="px-2 py-3 align-top text-ink-muted">
                          {receipt.reference || '—'}
                          {receipt.instrument?.bankName ? (
                            <div className="text-[11px] text-ink-faint">
                              {receipt.instrument.bankName}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 align-top text-right">
                          <div className="font-semibold tabular-nums text-brand">
                            {formatCurrency(
                              Math.round(Number(receipt.amount) || 0) +
                                Math.round(Number(receipt.gstAmount) || 0),
                            )}
                          </div>
                          {Math.round(Number(receipt.gstAmount) || 0) > 0 ? (
                            <div className="text-[11px] text-ink-faint">
                              EMI {formatCurrency(receipt.amount)} + GST
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setHistoryDetailId(receipt.id)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setView(isMonthView ? selectedMonth : currentMonth)}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            isMonthView
              ? 'border-brand/40 bg-brand-soft/50'
              : 'border-line bg-surface hover:border-brand/30'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            {isTodayView
              ? 'Due today'
              : isOverdueView
                ? 'In this view'
                : `In ${listTitle}`}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
            {monthSummary.count}
          </p>
          <p className="text-xs text-ink-muted">
            {monthSummary.collectible} collectible
            {monthSummary.lockedParts > 0
              ? ` · ${monthSummary.lockedParts} locked`
              : ''}
          </p>
        </button>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Collectible now
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-warn">
            {formatCurrency(monthSummary.totalDue)}
          </p>
          <p className="text-xs text-ink-muted">Unlocked balances only</p>
        </div>
        <button
          type="button"
          onClick={() => setView(OVERDUE_FILTER)}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            isOverdueView
              ? 'border-danger/40 bg-danger/5'
              : 'border-line bg-surface hover:border-danger/30'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Overdue
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-danger">
            {isOverdueView ? monthSummary.overdueCount : queueCounts.overdue}
          </p>
          <p className="text-xs text-ink-muted">
            {(isOverdueView
              ? monthSummary.overdueCount
              : queueCounts.overdue) > 0
              ? `${formatCurrency(
                  isOverdueView
                    ? monthSummary.overdueAmount
                    : queueCounts.overdueAmount,
                )}${
                  monthSummary.oldestDays > 0 && isOverdueView
                    ? ` · oldest ${monthSummary.oldestDays}d`
                    : ''
                }`
              : 'None past due'}
          </p>
        </button>
      </div>

      <Card
        title={listTitle}
        description={
          isOverdueView
            ? 'Past-due unpaid installments — collect these first.'
            : isTodayView
              ? 'Installments due today.'
              : 'This month’s dues, plus any overdue from earlier months.'
        }
      >
        {filteredDueRows.length === 0 ? (
          <div className="py-10 text-center">
            <Wallet className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-3 text-sm font-semibold text-ink">
              {listQuery.trim()
                ? 'No matches'
                : isOverdueView
                  ? 'No overdue installments'
                  : isTodayView
                    ? 'Nothing due today'
                    : 'No pending installments'}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {listQuery.trim()
                ? `No dues match “${listQuery.trim()}”. Try another client or plot.`
                : isOverdueView
                  ? 'You’re all caught up on past dues.'
                  : isTodayView
                    ? 'Check This month or Overdue for other queues.'
                    : `Nothing in ${listTitle}. Try Today or another month.`}
            </p>
            {!isMonthView && !listQuery.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setView(currentMonth)}
              >
                Back to this month
              </Button>
            )}
            {listQuery.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setListQuery('')}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <SortHeader
                    label="Client"
                    active={sortKey === 'client'}
                    dir={sortDir}
                    onClick={() => toggleSort('client')}
                  />
                  <SortHeader
                    label="Property"
                    active={sortKey === 'property'}
                    dir={sortDir}
                    onClick={() => toggleSort('property')}
                  />
                  <th className="px-2 py-2.5 font-semibold">Installment</th>
                  <SortHeader
                    label="Amount"
                    active={sortKey === 'amount'}
                    dir={sortDir}
                    onClick={() => toggleSort('amount')}
                    align="right"
                  />
                  <SortHeader
                    label="Due date"
                    active={sortKey === 'dueDate'}
                    dir={sortDir}
                    onClick={() => toggleSort('dueDate')}
                  />
                  <SortHeader
                    label="Status"
                    active={sortKey === 'overdueDays'}
                    dir={sortDir}
                    onClick={() => toggleSort('overdueDays')}
                  />
                  <th className="px-2 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {sortedDueRows.map((row) => {
                  const b = row.booking
                  const collectible = row.parts.find(
                    (p) => !p.locked && p.balance > 0,
                  )
                  const dueToday = row.dueDate === today
                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-line last:border-0 ${
                        row.overdue && row.collectibleBalance > 0
                          ? 'bg-danger/[0.04]'
                          : dueToday
                            ? 'bg-brand-soft/30'
                            : 'hover:bg-surface-2/40'
                      }`}
                    >
                      <td className="px-2 py-3 align-top">
                        <div className="font-semibold text-ink">
                          {b.customerName}
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {b.customerPhone || '—'}
                          {b.salesPerson ? ` · ${b.salesPerson}` : ''}
                        </div>
                        <div className="font-mono text-[11px] text-ink-faint">
                          {b.bookingCode}
                          {b.viaBroker
                            ? ` · ${b.broker?.fullName || 'Broker'}`
                            : ' · Direct'}
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top text-ink-muted">
                        <div className="font-medium text-ink">
                          {schemeName(b.schemeId)}
                        </div>
                        <div className="text-[11px]">{bookingPlotsLabel(b)}</div>
                      </td>
                      <td className="px-2 py-3 align-top">
                        <div className="space-y-1">
                          {row.parts.map((part) => (
                            <div
                              key={part.installment.id}
                              className="flex items-baseline gap-1.5"
                            >
                              <span className="font-medium text-ink">
                                {part.installment.label}
                              </span>
                              {part.locked ? (
                                <Lock className="h-3 w-3 shrink-0 text-ink-faint" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top text-right">
                        <div className="font-semibold tabular-nums text-warn">
                          {formatCurrency(
                            row.collectibleBalance > 0
                              ? row.collectibleBalance
                              : row.balance,
                          )}
                        </div>
                        {row.hasLocked &&
                          row.balance > row.collectibleBalance && (
                            <div className="text-[11px] text-ink-faint">
                              +{formatCurrency(row.balance - row.collectibleBalance)}{' '}
                              locked
                            </div>
                          )}
                      </td>
                      <td className="px-2 py-3 align-top whitespace-nowrap">
                        <div className="font-semibold tabular-nums text-ink">
                          {formatDueDate(row.dueDate)}
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top">
                        {row.overdue && row.collectibleBalance > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-1 text-[11px] font-semibold text-danger">
                            <AlertCircle className="h-3 w-3" />
                            {row.overdueDays}d overdue
                          </span>
                        ) : dueToday ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand">
                            <Clock className="h-3 w-3" />
                            Due today
                          </span>
                        ) : row.hasLocked && row.collectibleBalance <= 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-faint">
                            Upcoming
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setViewDueKey(row.key)}
                          >
                            View
                          </Button>
                          {canCollect && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={!collectible}
                              onClick={() => openCollect(row)}
                            >
                              Collect
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </>
      )}

      {canCollect && (payInstallmentId || booking) && (
        <Card
          title="Record payment"
          description={
            selectedPayPart && selectedPayRow
              ? `${selectedPayRow.booking.customerName} · ${selectedPayPart.installment.label} · due ${selectedPayRow.dueDate}`
              : booking
                ? `${booking.customerName} · ${booking.bookingCode}`
                : 'Select a due installment to collect'
          }
          action={
            bookingId ? (
              <button
                type="button"
                className="text-xs font-semibold text-ink-muted hover:text-ink"
                onClick={() => {
                  setParams({})
                  setPayInstallmentId('')
                }}
              >
                Clear selection
              </button>
            ) : undefined
          }
        >
          {booking && !plan && (
            <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft/40 px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                No payment plan on this booking
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Create a schedule before collecting installments.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Plan duration">
                  <Select
                    value={planDuration}
                    onChange={(e) =>
                      setPlanDuration(e.target.value as PlanDuration)
                    }
                  >
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="custom">Custom</option>
                  </Select>
                </Field>
                {planDuration === 'custom' && (
                  <Field label="Custom months">
                    <Input
                      type="number"
                      min="1"
                      value={customMonths}
                      onChange={(e) => setCustomMonths(e.target.value)}
                    />
                  </Field>
                )}
                <Field label="First installment due">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="Land amount (₹)">
                  <Input
                    type="number"
                    min="0"
                    value={landAmount}
                    onChange={(e) => setLandAmount(e.target.value)}
                  />
                </Field>
                <Field label="Construction amount (₹)">
                  <Input
                    type="number"
                    min="0"
                    value={constructionAmount}
                    onChange={(e) => setConstructionAmount(e.target.value)}
                  />
                </Field>
              </div>
              {quoted > 0 && (
                <p className="mt-3 text-xs text-ink-muted">
                  Quote {formatCurrency(quoted)} − booking{' '}
                  {formatCurrency(bookingPaid)} ={' '}
                  {formatCurrency(remainingAfterBooking)} left to schedule.
                </p>
              )}
              <div className="mt-3">
                <Button type="button" onClick={handleCreatePlan}>
                  Create plan & schedule
                </Button>
              </div>
            </div>
          )}

          {booking && plan && (
            <>
              {bookingPaid > 0 ? (
                <div className="mb-4">
                  <TokenCollectedNote
                    amount={bookingPaid}
                    mode={booking.bookingAmountMode}
                  />
                </div>
              ) : null}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
                  <p className="text-[11px] font-semibold uppercase text-ink-faint">
                    Land · {PLAN_DURATION_LABELS[plan.planDuration]}
                  </p>
                  <Progress paid={landTotals.paid} due={landTotals.due} />
                </div>
                <div className="rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
                  <p className="text-[11px] font-semibold uppercase text-ink-faint">
                    Construction
                  </p>
                  <Progress
                    paid={constructionTotals.paid}
                    due={constructionTotals.due}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Installment" className="lg:col-span-2">
                  <Select
                    value={payInstallmentId}
                    onChange={(e) => {
                      setPayInstallmentId(e.target.value)
                      const inst = bookingInstallments.find(
                        (i) => i.id === e.target.value,
                      )
                      if (inst) {
                        setPayAmount(
                          String(Math.max(0, inst.amount - inst.paidAmount)),
                        )
                      }
                    }}
                  >
                    <option value="">Select installment</option>
                    {bookingInstallments
                      .filter((i) => i.paidAmount < i.amount)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label} · due {i.dueDate} · bal{' '}
                          {formatCurrency(i.amount - i.paidAmount)}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Amount">
                  <Input
                    type="number"
                    min="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </Field>
                <Field label="Paid on">
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </Field>
                <Field label="Mode">
                  <Select
                    value={payMode}
                    onChange={(e) =>
                      setPayMode(e.target.value as PaymentMode)
                    }
                  >
                    {(Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map(
                      (m) => (
                        <option key={m} value={m}>
                          {PAYMENT_MODE_LABELS[m]}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>
                <Field label="Reference">
                  <Input
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="UTR / cheque no."
                  />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Notes">
                    <Textarea
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={handlePay}>
                  Record payment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (
                      confirm(
                        'Reset plan and all payments for this booking?',
                      )
                    ) {
                      deletePlanForBooking(bookingId)
                      flash('Plan reset')
                    }
                  }}
                >
                  Reset plan
                </Button>
              </div>

              {receipts.length > 0 && (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Recent receipts
                  </p>
                  <ul className="mt-2 divide-y divide-line">
                    {receipts.slice(0, 5).map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                      >
                        <span>
                          {formatCurrency(
                            Math.round(Number(r.amount) || 0) +
                              Math.round(Number(r.gstAmount) || 0),
                          )}{' '}
                          · {CATEGORY_LABELS[r.category]}
                          {Math.round(Number(r.gstAmount) || 0) > 0
                            ? ' · incl. GST'
                            : ''}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {r.paidOn} · {PAYMENT_MODE_LABELS[r.mode]}
                          {r.reference ? ` · ${r.reference}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {historyDetail && (
        <ReceiptDetailDialog
          open
          onClose={() => setHistoryDetailId(null)}
          receipt={historyDetail.receipt}
          booking={historyDetail.booking}
          installment={historyDetail.installment}
          propertyLabel={`${schemeName(historyDetail.booking.schemeId)} · ${bookingPlotsLabel(historyDetail.booking)}`}
        />
      )}

      {viewDueKey &&
        (() => {
          const row = sortedDueRows.find((r) => r.key === viewDueKey)
          if (!row) return null
          const bookingInst = getInstallmentsByBooking(row.booking.id)
          const bookingReceipts = getReceiptsByBooking(row.booking.id)
          return (
            <DueDetailDialog
              open
              onClose={() => setViewDueKey(null)}
              booking={row.booking}
              propertyLabel={`${schemeName(row.booking.schemeId)} · ${bookingPlotsLabel(row.booking)}`}
              dueDate={row.dueDate}
              parts={row.parts}
              balance={row.balance}
              collectibleBalance={row.collectibleBalance}
              overdue={row.overdue}
              overdueDays={row.overdueDays}
              installments={bookingInst}
              receipts={bookingReceipts}
              canCollect={canCollect}
              onCollect={() => {
                setViewDueKey(null)
                openCollect(row)
              }}
            />
          )
        })()}

      {canCollect &&
        collectOpen &&
        collectBooking &&
        collectInstallment &&
        collectQuota &&
        collectBalance > 0 && (
          <CollectPaymentDialog
            open={collectOpen}
            onClose={closeCollect}
            onSubmit={handleCollectSubmit}
            booking={collectBooking}
            installment={collectInstallment}
            balance={collectBalance}
            propertyLabel={`${schemeName(collectBooking.schemeId)} · ${bookingPlotsLabel(collectBooking)}`}
            overdueDays={collectOverdueDays}
            quota={collectQuota}
            collectedByLabel={
              user
                ? `${user.name} · ${USER_ROLE_LABELS[user.role]}`
                : undefined
            }
          />
        )}

      {canCollect && lumpSumOpen && (
        <LumpSumCollectDialog
          open={lumpSumOpen}
          onClose={closeLumpSum}
          onSubmit={handleLumpSumSubmit}
          options={lumpSumOptions}
          initialBookingId={lumpSumBookingId || bookingId || undefined}
          scopeInstallmentIds={lumpSumScopeIds}
          collectedByLabel={
            user
              ? `${user.name} · ${USER_ROLE_LABELS[user.role]}`
              : undefined
          }
        />
      )}

      {handoverBooking && user && (
        <HandoverDialog
          booking={handoverBooking}
          propertyLabel={`${schemeName(handoverBooking.schemeId)} · ${bookingPlotsLabel(handoverBooking)}`}
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

function Progress({
  paid,
  due,
  locked,
}: {
  paid: number
  due: number
  locked?: boolean
}) {
  const pct = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0
  return (
    <div className={`mt-1 ${locked ? 'opacity-60' : ''}`}>
      <div className="flex justify-between text-xs">
        <span className="text-ink-muted">Paid {formatCurrency(paid)}</span>
        <span className="font-semibold">
          of {formatCurrency(due)} · {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/70">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
