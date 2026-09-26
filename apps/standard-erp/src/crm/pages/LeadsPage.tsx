import { useEffect, useMemo, useState, Fragment } from 'react'
import { Link, useNavigate, useSearchParams } from '@/crm/router'
import {
  Bell,
  Check,
  ChevronDown,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useSchemes } from '../context/SchemeContext'
import { usePlots } from '../context/PlotContext'
import { useLeads } from '../context/LeadContext'
import { useAuth } from '../context/AuthContext'
import { useBrokers } from '../context/BrokerContext'
import { addLocalDays, todayLocalISO } from '../lib/dates'
import {
  leadSearchHaystack,
  parseLeadSmartQuery,
} from '../lib/leadFilters'
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  SOCIAL_PLATFORM_LABELS,
  createEmptyLeadSourceDetails,
  leadSourceSummary,
  type LeadRecord,
  type LeadSource,
  type LeadSourceDetails,
  type LeadStatus,
  type SocialPlatform,
} from '../types/sales'
import {
  Button,
  Card,
  Field,
  Input,
  MultiSelectDropdown,
  Select,
  Textarea,
} from '../components/ui/Form'

const PIPELINE_STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'site_visit',
  'negotiation',
  'lost',
]
const SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]

const FOLLOW_UP_CHOICES = [
  { days: 1, label: 'Tomorrow' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In 1 week' },
  { days: 14, label: 'In 2 weeks' },
] as const

type ListFilter = 'all' | 'due'

function formatFollowUpDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
}

function formatContactedAt(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOpenLead(lead: LeadRecord) {
  return lead.status !== 'converted' && lead.status !== 'lost'
}

function followUpState(
  lead: LeadRecord,
  today: string,
): 'none' | 'upcoming' | 'today' | 'overdue' {
  if (!lead.followUpOn || !isOpenLead(lead)) return 'none'
  if (lead.followUpOn < today) return 'overdue'
  if (lead.followUpOn === today) return 'today'
  return 'upcoming'
}

function statusTone(status: LeadStatus) {
  switch (status) {
    case 'new':
      return 'bg-sky-500/10 text-sky-800 ring-sky-500/20'
    case 'contacted':
      return 'bg-surface-2 text-ink ring-line'
    case 'site_visit':
      return 'bg-violet-500/10 text-violet-800 ring-violet-500/20'
    case 'negotiation':
      return 'bg-amber-500/10 text-amber-900 ring-amber-500/25'
    case 'converted':
      return 'bg-success-soft text-success ring-success/20'
    case 'lost':
      return 'bg-danger/10 text-danger ring-danger/20'
    default:
      return 'bg-surface-2 text-ink-muted ring-line'
  }
}

function followUpBadgeClass(state: ReturnType<typeof followUpState>) {
  if (state === 'overdue') return 'bg-danger text-white'
  if (state === 'today') return 'bg-brand text-brand-ink'
  if (state === 'upcoming') return 'bg-surface-2 text-ink-muted'
  return ''
}

function FollowUpDialog({
  lead,
  today,
  onClose,
  onSave,
  onClear,
}: {
  lead: LeadRecord
  today: string
  onClose: () => void
  onSave: (date: string, note: string) => void
  onClear: () => void
}) {
  const [date, setDate] = useState(lead.followUpOn || addLocalDays(today, 3))
  const [note, setNote] = useState(lead.followUpNote || '')
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<number | null>(
    lead.followUpOn ? null : 3,
  )

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!date) {
      setError('Pick a date')
      return
    }
    if (!note.trim()) {
      setError('Follow-up note is required')
      return
    }
    setError(null)
    onSave(date, note.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Call back later
            </p>
            <h2 className="mt-1 font-display text-xl text-ink">{lead.name}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              When should sales contact them again?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {FOLLOW_UP_CHOICES.map((c) => {
              const active = selectedDays === c.days
              return (
                <button
                  key={c.days}
                  type="button"
                  onClick={() => {
                    setSelectedDays(c.days)
                    setDate(addLocalDays(today, c.days))
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? 'border-brand bg-brand-soft text-ink'
                      : 'border-line hover:border-brand/40'
                  }`}
                >
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {formatFollowUpDate(addLocalDays(today, c.days))}
                  </p>
                </button>
              )
            })}
          </div>

          <Field label="Or pick a date" required>
            <Input
              type="date"
              value={date}
              min={today}
              onChange={(e) => {
                setSelectedDays(null)
                setDate(e.target.value)
                setError(null)
              }}
            />
          </Field>

          <Field
            label="Follow-up note"
            required
            error={error && !note.trim() ? error : undefined}
          >
            <Textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError(null)
              }}
              placeholder="What to discuss / why they asked to wait…"
              rows={3}
            />
          </Field>

          {error && note.trim() ? (
            <p className="text-xs font-medium text-danger">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={submit}>
              Set reminder
            </Button>
            {lead.followUpOn && (
              <Button type="button" variant="outline" onClick={onClear}>
                Clear
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MarkCalledDialog({
  lead,
  today,
  isAdmin,
  onClose,
  onDone,
  onDoneAndRemind,
}: {
  lead: LeadRecord
  today: string
  isAdmin: boolean
  onClose: () => void
  onDone: (note: string) => void
  onDoneAndRemind: (note: string, nextDate: string, nextNote: string) => void
}) {
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'done' | 'remind'>('done')
  const [nextDate, setNextDate] = useState(addLocalDays(today, 3))
  const [nextNote, setNextNote] = useState('')
  const [selectedDays, setSelectedDays] = useState<number | null>(3)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!note.trim()) {
      setError('Call outcome is required')
      return
    }
    if (mode === 'remind') {
      if (!nextDate) {
        setError('Pick the next reminder date')
        return
      }
      setError(null)
      // Reuse call outcome as reminder context when no separate note is entered
      onDoneAndRemind(note.trim(), nextDate, nextNote.trim() || note.trim())
      return
    }
    setError(null)
    onDone(note.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Mark called
            </p>
            <h2 className="mt-1 font-display text-xl text-ink">{lead.name}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {isAdmin
                ? `Log that this lead was contacted${
                    lead.followUpOn
                      ? ` · reminder was ${formatFollowUpDate(lead.followUpOn)}`
                      : ''
                  }.`
                : `Record the call outcome${
                    lead.followUpOn
                      ? ` · reminder was ${formatFollowUpDate(lead.followUpOn)}`
                      : ''
                  }.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {lead.followUpNote?.trim() && (
            <div className="rounded-xl border border-line bg-surface-2/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Reminder note
              </p>
              <p className="mt-1 text-sm text-ink">{lead.followUpNote.trim()}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-ink">After this call</p>
            <div
              className="grid grid-cols-2 gap-2"
              role="tablist"
              aria-label="After this call"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'done'}
                onClick={() => {
                  setMode('done')
                  setError(null)
                }}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                  mode === 'done'
                    ? 'border-brand bg-brand-soft text-ink'
                    : 'border-line text-ink-muted hover:border-brand/40 hover:text-ink'
                }`}
              >
                Called — done
                <span className="mt-0.5 block text-[11px] font-normal text-ink-faint">
                  No next reminder
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'remind'}
                onClick={() => {
                  setMode('remind')
                  setError(null)
                }}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                  mode === 'remind'
                    ? 'border-brand bg-brand-soft text-ink'
                    : 'border-line text-ink-muted hover:border-brand/40 hover:text-ink'
                }`}
              >
                + Next reminder
                <span className="mt-0.5 block text-[11px] font-normal text-ink-faint">
                  Schedule follow-up
                </span>
              </button>
            </div>
          </div>

          <Field
            label="Call outcome"
            required
            error={
              error === 'Call outcome is required' ? error : undefined
            }
          >
            <Textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError(null)
              }}
              placeholder="What did they say? Interested / asked for price / call again…"
              rows={3}
            />
          </Field>

          {mode === 'remind' && (
            <div className="space-y-3 rounded-xl border border-brand/25 bg-brand-soft/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                Next reminder
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FOLLOW_UP_CHOICES.map((c) => {
                  const active = selectedDays === c.days
                  return (
                    <button
                      key={c.days}
                      type="button"
                      onClick={() => {
                        setSelectedDays(c.days)
                        setNextDate(addLocalDays(today, c.days))
                        setError(null)
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? 'border-brand bg-surface text-ink'
                          : 'border-line bg-surface hover:border-brand/40'
                      }`}
                    >
                      <p className="text-sm font-semibold">{c.label}</p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {formatFollowUpDate(addLocalDays(today, c.days))}
                      </p>
                    </button>
                  )
                })}
              </div>
              <Field label="Or pick a date" required>
                <Input
                  type="date"
                  value={nextDate}
                  min={today}
                  onChange={(e) => {
                    setSelectedDays(null)
                    setNextDate(e.target.value)
                    setError(null)
                  }}
                />
              </Field>
              <Field
                label="Follow-up note"
                hint="Optional — call outcome is used if left blank"
              >
                <Textarea
                  value={nextNote}
                  onChange={(e) => {
                    setNextNote(e.target.value)
                    setError(null)
                  }}
                  placeholder="Anything extra for next time (optional)…"
                  rows={2}
                />
              </Field>
            </div>
          )}

          {error && error !== 'Call outcome is required' ? (
            <p className="text-xs font-medium text-danger">{error}</p>
          ) : null}

          <p className="text-[11px] text-ink-faint">
            {mode === 'done'
              ? 'Completing removes this lead from Call today.'
              : 'Call is logged, then the next reminder is set.'}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={submit}>
              <Check className="h-4 w-4" />
              {mode === 'remind' ? 'Save call + reminder' : 'Save call'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LeadsPage() {
  const navigate = useNavigate()
  const { schemes } = useSchemes()
  const { user } = useAuth()
  const canManageSchemes = user?.role === 'admin'
  const isAdmin = user?.role === 'admin'
  const canTakeLeads = user?.role !== 'accountant'
  const { getPlotsByScheme } = usePlots()
  const { brokers, getBroker } = useBrokers()
  const { leads, saveLead, updateLead, deleteLead } = useLeads()
  const [params, setParams] = useSearchParams()
  const schemeFilter = params.get('scheme') ?? ''
  const listFilter = (params.get('view') as ListFilter) || 'all'

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [schemeId, setSchemeId] = useState(schemes[0]?.id ?? '')
  const [plotId, setPlotId] = useState('')
  const [source, setSource] = useState<LeadSource>('walk_in')
  const [sourceDetails, setSourceDetails] = useState<LeadSourceDetails>(() =>
    createEmptyLeadSourceDetails(),
  )
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [followUpLeadId, setFollowUpLeadId] = useState<string | null>(null)
  const [markCalledLeadId, setMarkCalledLeadId] = useState<string | null>(null)
  const [listQuery, setListQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([])
  const [sourceFilter, setSourceFilter] = useState<LeadSource[]>([])
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const setDetail = <K extends keyof LeadSourceDetails>(
    key: K,
    value: LeadSourceDetails[K],
  ) => setSourceDetails((prev) => ({ ...prev, [key]: value }))

  const today = todayLocalISO()

  const plots = useMemo(
    () => getPlotsByScheme(schemeId),
    [getPlotsByScheme, schemeId],
  )

  const schemeLeads = useMemo(() => {
    return schemeFilter
      ? leads.filter((l) => l.schemeId === schemeFilter)
      : leads
  }, [leads, schemeFilter])

  const dueCount = useMemo(() => {
    return schemeLeads.filter((l) => {
      const s = followUpState(l, today)
      return s === 'overdue' || s === 'today'
    }).length
  }, [schemeLeads, today])

  const schemeName = (id: string) =>
    schemes.find((s) => s.id === id)?.schemeName ||
    schemes.find((s) => s.id === id)?.schemeCode ||
    '—'

  const plotLabel = (sid: string, pid: string | null) => {
    if (!pid) return '—'
    const p = getPlotsByScheme(sid).find((x) => x.id === pid)
    return p ? `Plot ${p.plotNumber}` : '—'
  }

  const setView = (view: ListFilter) => {
    const next = new URLSearchParams(params)
    if (view === 'all') next.delete('view')
    else next.set('view', view)
    setParams(next)
  }

  const smartQuery = useMemo(() => parseLeadSmartQuery(listQuery), [listQuery])

  const statusFilterOptions = useMemo(() => {
    const all: LeadStatus[] = [
      'new',
      'contacted',
      'site_visit',
      'negotiation',
      'converted',
      'lost',
    ]
    return all.map((s) => ({
      value: s,
      label: LEAD_STATUS_LABELS[s],
      count: schemeLeads.filter((l) => l.status === s).length,
    }))
  }, [schemeLeads])

  const sourceFilterOptions = useMemo(() => {
    return SOURCES.map((s) => ({
      value: s,
      label: LEAD_SOURCE_LABELS[s],
      count: schemeLeads.filter((l) => l.source === s).length,
    }))
  }, [schemeLeads])

  const filtered = useMemo(() => {
    let list = schemeLeads

    if (listFilter === 'due' || smartQuery.due === 'any') {
      list = list.filter((l) => {
        const s = followUpState(l, today)
        return s === 'overdue' || s === 'today'
      })
    } else if (smartQuery.due === 'today') {
      list = list.filter((l) => followUpState(l, today) === 'today')
    } else if (smartQuery.due === 'overdue') {
      list = list.filter((l) => followUpState(l, today) === 'overdue')
    } else if (smartQuery.due === 'upcoming') {
      list = list.filter((l) => followUpState(l, today) === 'upcoming')
    }

    const effectiveStatuses =
      statusFilter.length > 0
        ? statusFilter
        : smartQuery.status
          ? [smartQuery.status]
          : []
    if (effectiveStatuses.length > 0) {
      list = list.filter((l) => effectiveStatuses.includes(l.status))
    }

    const effectiveSources =
      sourceFilter.length > 0
        ? sourceFilter
        : smartQuery.source
          ? [smartQuery.source]
          : []
    if (effectiveSources.length > 0) {
      list = list.filter((l) => effectiveSources.includes(l.source))
    }

    if (smartQuery.plot) {
      const needle = smartQuery.plot.toLowerCase()
      list = list.filter((l) => {
        if (!l.plotId) return false
        const p = getPlotsByScheme(l.schemeId).find((x) => x.id === l.plotId)
        if (!p) return false
        return (
          String(p.plotNumber).toLowerCase().includes(needle) ||
          p.id.toLowerCase().includes(needle)
        )
      })
    }

    if (smartQuery.textTokens.length > 0) {
      list = list.filter((l) => {
        const hay = leadSearchHaystack(
          l,
          schemeName(l.schemeId),
          plotLabel(l.schemeId, l.plotId),
        )
        return smartQuery.textTokens.every((t) => hay.includes(t))
      })
    }

    return [...list].sort((a, b) => {
      const rank = (l: LeadRecord) => {
        const s = followUpState(l, today)
        if (s === 'overdue') return 0
        if (s === 'today') return 1
        if (s === 'upcoming') return 2
        return 3
      }
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      if (a.followUpOn && b.followUpOn) {
        const d = a.followUpOn.localeCompare(b.followUpOn)
        if (d !== 0) return d
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [
    schemeLeads,
    listFilter,
    today,
    statusFilter,
    sourceFilter,
    smartQuery,
    getPlotsByScheme,
    schemes,
  ])

  const activeFilterCount = [
    statusFilter.length > 0,
    sourceFilter.length > 0,
    Boolean(listQuery.trim()),
    listFilter === 'due',
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setListQuery('')
    setStatusFilter([])
    setSourceFilter([])
    setView('all')
  }

  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [listQuery, statusFilter, sourceFilter, listFilter, schemeFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage, pageSize])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const resetForm = () => {
    setName('')
    setPhone('')
    setEmail('')
    setPlotId('')
    setSource('walk_in')
    setSourceDetails(createEmptyLeadSourceDetails())
    setNotes('')
    setShowForm(false)
  }

  const handleCreate = () => {
    if (!canTakeLeads) {
      flash('Accounts cannot create leads')
      return
    }
    if (!name.trim() || !phone.trim() || !schemeId) {
      flash('Name, phone, and scheme are required')
      return
    }
    if (source === 'referral' && !sourceDetails.referredByName.trim()) {
      flash('Enter who referred this lead')
      return
    }
    if (source === 'social' && !sourceDetails.socialPlatform) {
      flash('Select the social platform')
      return
    }
    if (source === 'broker' && !sourceDetails.brokerId && !sourceDetails.brokerName.trim()) {
      flash('Select or enter the broker')
      return
    }
    if (source === 'other' && !sourceDetails.otherDetail.trim()) {
      flash('Specify the lead source')
      return
    }

    const details = createEmptyLeadSourceDetails(sourceDetails)
    if (source === 'broker' && details.brokerId) {
      const b = getBroker(details.brokerId)
      if (b) details.brokerName = b.fullName
    }

    saveLead({
      schemeId,
      plotId: plotId || null,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      source,
      sourceDetails: details,
      status: 'new',
      notes: notes.trim(),
      followUpOn: null,
      followUpNote: '',
      lastContactedAt: null,
      lastContactedById: null,
      lastContactedByName: '',
      lastContactNote: '',
    })
    resetForm()
    flash('Lead created')
  }

  const saveFollowUp = (date: string, note: string) => {
    if (!followUpLeadId) return
    const lead = leads.find((l) => l.id === followUpLeadId)
    updateLead(followUpLeadId, {
      followUpOn: date,
      followUpNote: note,
      ...(lead?.status === 'new' ? { status: 'contacted' as const } : {}),
    })
    setFollowUpLeadId(null)
    flash(`Call back on ${formatFollowUpDate(date)}`)
  }

  const clearFollowUp = (id: string) => {
    updateLead(id, { followUpOn: null, followUpNote: '' })
    setFollowUpLeadId(null)
    flash('Reminder cleared')
  }

  const applyCallLogged = (leadId: string, note: string) => {
    if (!user) return
    const lead = leads.find((l) => l.id === leadId)
    updateLead(leadId, {
      followUpOn: null,
      followUpNote: '',
      lastContactedAt: new Date().toISOString(),
      lastContactedById: user.id,
      lastContactedByName: user.name,
      lastContactNote: note,
      ...(lead?.status === 'new' ? { status: 'contacted' as const } : {}),
    })
  }

  const completeCall = (note: string) => {
    if (!markCalledLeadId) return
    applyCallLogged(markCalledLeadId, note)
    setMarkCalledLeadId(null)
    flash('Call logged')
  }

  const completeCallAndRemind = (
    note: string,
    nextDate: string,
    nextNote: string,
  ) => {
    if (!markCalledLeadId || !user) return
    const lead = leads.find((l) => l.id === markCalledLeadId)
    updateLead(markCalledLeadId, {
      lastContactedAt: new Date().toISOString(),
      lastContactedById: user.id,
      lastContactedByName: user.name,
      lastContactNote: note,
      followUpOn: nextDate,
      followUpNote: nextNote,
      ...(lead?.status === 'new' ? { status: 'contacted' as const } : {}),
    })
    setMarkCalledLeadId(null)
    flash(`Call logged · next reminder ${formatFollowUpDate(nextDate)}`)
  }

  if (schemes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <div className="py-8 text-center">
            <UserPlus className="mx-auto h-10 w-10 text-brand" />
            <h1 className="mt-3 font-display text-2xl">No schemes yet</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {canManageSchemes
                ? 'Publish a scheme and import plots before capturing leads.'
                : 'Ask an admin to create a scheme before capturing leads.'}
            </p>
            {canManageSchemes && (
              <Link to="/schemes/new" className="mt-5 inline-block">
                <Button>Create Scheme</Button>
              </Link>
            )}
          </div>
        </Card>
      </div>
    )
  }

  const followUpLead = followUpLeadId
    ? leads.find((l) => l.id === followUpLeadId)
    : undefined
  const markCalledLead = markCalledLeadId
    ? leads.find((l) => l.id === markCalledLeadId)
    : undefined

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Sales Pipeline
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
            Leads
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={schemeFilter}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('scheme', e.target.value)
              else next.delete('scheme')
              setParams(next)
            }}
            className="min-w-[180px]"
          >
            <option value="">All schemes</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.schemeName || s.schemeCode}
              </option>
            ))}
          </Select>
          {canTakeLeads && (
            <Button type="button" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Search name, phone, note… or status:new · source:referral · due:today"
              className="pl-9"
            />
          </div>
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

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-line bg-surface-2/40 p-1"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={listFilter === 'all'}
              onClick={() => setView('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                listFilter === 'all'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              All ({schemeLeads.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={listFilter === 'due'}
              onClick={() => setView('due')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                listFilter === 'due'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              Call today
              {dueCount > 0 && (
                <span className="rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-danger">
                  {dueCount}
                </span>
              )}
              <span className="hidden text-[10px] font-medium text-ink-faint sm:inline">
                · pending
              </span>
            </button>
          </div>

          <MultiSelectDropdown
            label="Status"
            allLabel="All"
            values={statusFilter}
            onChange={(next) => {
              setListQuery((q) =>
                q
                  .replace(/\bstatus:\w+/gi, '')
                  .replace(
                    /\b(new|contacted|contact|site_visit|sitevisit|visit|negotiation|negotiate|converted|booked|lost)\b/gi,
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
            label="Source"
            allLabel="All"
            values={sourceFilter}
            onChange={(next) => {
              setListQuery((q) =>
                q
                  .replace(/\bsource:\w+/gi, '')
                  .replace(
                    /\b(walk_in|walkin|walk|referral|referred|website|web|social|broker|other)\b/gi,
                    '',
                  )
                  .replace(/\s{2,}/g, ' ')
                  .trim(),
              )
              setSourceFilter(next)
            }}
            options={sourceFilterOptions}
          />

          <div className="ml-auto hidden gap-3 text-xs text-ink-muted sm:flex">
            <button
              type="button"
              className="hover:text-ink"
              onClick={() => {
                setStatusFilter(['new'])
                setListQuery((q) =>
                  q.replace(/\bstatus:\w+/gi, '').replace(/\s{2,}/g, ' ').trim(),
                )
              }}
            >
              New{' '}
              <strong className="tabular-nums text-ink">
                {schemeLeads.filter((l) => l.status === 'new').length}
              </strong>
            </button>
            <button
              type="button"
              className="hover:text-ink"
              onClick={() => {
                setStatusFilter(['contacted'])
                setListQuery((q) =>
                  q.replace(/\bstatus:\w+/gi, '').replace(/\s{2,}/g, ' ').trim(),
                )
              }}
            >
              Contacted{' '}
              <strong className="tabular-nums text-ink">
                {schemeLeads.filter((l) => l.status === 'contacted').length}
              </strong>
            </button>
            <button
              type="button"
              className="hover:text-ink"
              onClick={() => {
                setStatusFilter(['converted'])
                setListQuery((q) =>
                  q.replace(/\bstatus:\w+/gi, '').replace(/\s{2,}/g, ' ').trim(),
                )
              }}
            >
              Converted{' '}
              <strong className="tabular-nums text-ink">
                {schemeLeads.filter((l) => l.status === 'converted').length}
              </strong>
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <p className="text-xs text-ink-muted">
            Tips: <code className="rounded bg-surface-2 px-1">status:negotiation</code>{' '}
            <code className="rounded bg-surface-2 px-1">source:broker</code>{' '}
            <code className="rounded bg-surface-2 px-1">plot:12</code>{' '}
            <code className="rounded bg-surface-2 px-1">due:overdue</code> — or type
            any name, phone, referrer, or note text.
          </p>
        )}

        {(activeFilterCount > 0 || filtered.length !== schemeLeads.length) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-muted">
              Showing{' '}
              <strong className="tabular-nums text-ink">{filtered.length}</strong> of{' '}
              {schemeLeads.length}
            </span>
            {listQuery.trim() && (
              <LeadFilterChip
                label={`Search: ${listQuery.trim()}`}
                onClear={() => setListQuery('')}
              />
            )}
            {listFilter === 'due' && (
              <LeadFilterChip
                label="Call today"
                onClear={() => setView('all')}
              />
            )}
            {statusFilter.map((s) => (
              <LeadFilterChip
                key={s}
                label={LEAD_STATUS_LABELS[s]}
                onClear={() =>
                  setStatusFilter((prev) => prev.filter((x) => x !== s))
                }
              />
            ))}
            {sourceFilter.map((s) => (
              <LeadFilterChip
                key={s}
                label={LEAD_SOURCE_LABELS[s]}
                onClear={() =>
                  setSourceFilter((prev) => prev.filter((x) => x !== s))
                }
              />
            ))}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {canTakeLeads && showForm && (
        <Card
          title="New lead"
          description="Contact + scheme first. Extra fields appear based on source."
        >
          <div className="space-y-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Contact
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Full name" required>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Customer name"
                  />
                </Field>
                <Field label="Phone" required>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Mobile number"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Interest
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Scheme" required>
                  <Select
                    value={schemeId}
                    onChange={(e) => {
                      setSchemeId(e.target.value)
                      setPlotId('')
                    }}
                  >
                    {schemes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.schemeName || s.schemeCode}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Interested plot">
                  <Select
                    value={plotId}
                    onChange={(e) => setPlotId(e.target.value)}
                  >
                    <option value="">Any / not decided</option>
                    {plots
                      .filter((p) => p.status === 'available')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          Plot {p.plotNumber}
                          {p.blockName ? ` · ${p.blockName}` : ''}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Source" required>
                  <Select
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value as LeadSource)
                      setSourceDetails(createEmptyLeadSourceDetails())
                    }}
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_SOURCE_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface-2/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {LEAD_SOURCE_LABELS[source]} details
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {source === 'walk_in' &&
                  'Where they visited and who spoke to them.'}
                {source === 'referral' &&
                  'Who introduced this customer to you.'}
                {source === 'website' &&
                  'Which page or campaign they came from.'}
                {source === 'social' &&
                  'Platform and profile / ad they responded to.'}
                {source === 'broker' &&
                  'Pick from broker master or type the name.'}
                {source === 'other' && 'Describe how this lead came in.'}
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {source === 'walk_in' && (
                  <>
                    <Field label="Site / office">
                      <Input
                        value={sourceDetails.walkInLocation}
                        onChange={(e) =>
                          setDetail('walkInLocation', e.target.value)
                        }
                        placeholder="e.g. Site office, Head office"
                      />
                    </Field>
                    <Field label="Attended by">
                      <Input
                        value={sourceDetails.walkInAttendedBy}
                        onChange={(e) =>
                          setDetail('walkInAttendedBy', e.target.value)
                        }
                        placeholder="Sales person name"
                      />
                    </Field>
                  </>
                )}

                {source === 'referral' && (
                  <>
                    <Field label="Referred by" required>
                      <Input
                        value={sourceDetails.referredByName}
                        onChange={(e) =>
                          setDetail('referredByName', e.target.value)
                        }
                        placeholder="Person or company name"
                      />
                    </Field>
                    <Field label="Referrer phone">
                      <Input
                        value={sourceDetails.referredByPhone}
                        onChange={(e) =>
                          setDetail('referredByPhone', e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </Field>
                  </>
                )}

                {source === 'website' && (
                  <Field label="Page / campaign" className="sm:col-span-2">
                    <Input
                      value={sourceDetails.websitePage}
                      onChange={(e) =>
                        setDetail('websitePage', e.target.value)
                      }
                      placeholder="e.g. nisarg landing page, Google Ads"
                    />
                  </Field>
                )}

                {source === 'social' && (
                  <>
                    <Field label="Platform" required>
                      <Select
                        value={sourceDetails.socialPlatform}
                        onChange={(e) =>
                          setDetail(
                            'socialPlatform',
                            e.target.value as SocialPlatform | '',
                          )
                        }
                      >
                        <option value="">Select platform</option>
                        {(
                          Object.keys(
                            SOCIAL_PLATFORM_LABELS,
                          ) as SocialPlatform[]
                        ).map((p) => (
                          <option key={p} value={p}>
                            {SOCIAL_PLATFORM_LABELS[p]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Handle / ad / post">
                      <Input
                        value={sourceDetails.socialHandle}
                        onChange={(e) =>
                          setDetail('socialHandle', e.target.value)
                        }
                        placeholder="@handle or campaign name"
                      />
                    </Field>
                  </>
                )}

                {source === 'broker' && (
                  <>
                    <Field label="Broker from master" className="sm:col-span-2">
                      <Select
                        value={sourceDetails.brokerId || ''}
                        onChange={(e) => {
                          const id = e.target.value || null
                          const b = id ? getBroker(id) : undefined
                          setSourceDetails((prev) => ({
                            ...prev,
                            brokerId: id,
                            brokerName: b?.fullName || prev.brokerName,
                          }))
                        }}
                      >
                        <option value="">Choose broker (optional)</option>
                        {[...brokers]
                          .sort((a, b) => a.fullName.localeCompare(b.fullName))
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.fullName}
                              {b.firmName ? ` · ${b.firmName}` : ''}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Field
                      label="Or type broker name"
                      required={!sourceDetails.brokerId}
                      className="sm:col-span-2"
                    >
                      <Input
                        value={sourceDetails.brokerName}
                        onChange={(e) =>
                          setDetail('brokerName', e.target.value)
                        }
                        placeholder="If not in master list"
                        disabled={Boolean(sourceDetails.brokerId)}
                      />
                    </Field>
                  </>
                )}

                {source === 'other' && (
                  <Field label="Please specify" required className="sm:col-span-2">
                    <Input
                      value={sourceDetails.otherDetail}
                      onChange={(e) =>
                        setDetail('otherDetail', e.target.value)
                      }
                      placeholder="How did this lead come in?"
                    />
                  </Field>
                )}
              </div>
            </div>

            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Budget, timeline, anything useful…"
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={handleCreate}>
              Save lead
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/40 px-3 py-2.5 sm:px-4">
          <p className="text-xs text-ink-muted sm:text-sm">
            {filtered.length === 0
              ? 'No leads'
              : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(
                  currentPage * pageSize,
                  filtered.length,
                )} of ${filtered.length}`}
            {filtered.length !== schemeLeads.length
              ? ` · filtered from ${schemeLeads.length}`
              : ''}
          </p>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Clear filters
              </button>
            )}
            <Select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="min-w-[100px] py-1.5 text-xs"
            >
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Bell className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-3 text-sm font-medium text-ink">
              {listFilter === 'due'
                ? 'Nothing due today'
                : activeFilterCount > 0
                  ? 'No matches'
                  : 'No leads yet'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
              {listFilter === 'due'
                ? 'Set a call-back from a lead when they ask to be contacted later.'
                : activeFilterCount > 0
                  ? 'Try clearing search or filters.'
                  : canTakeLeads
                    ? 'Add one with New Lead to start your pipeline.'
                    : 'Leads will appear here once sales adds them.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-line bg-surface-2/90 text-[10px] uppercase tracking-wide text-ink-faint backdrop-blur">
                  <tr>
                    <th className="w-8 px-2 py-2.5 sm:px-3" aria-label="Expand" />
                    <th className="px-2 py-2.5 font-semibold sm:px-3">Lead</th>
                    <th className="hidden px-2 py-2.5 font-semibold md:table-cell sm:px-3">
                      Follow-up
                    </th>
                    <th className="hidden px-2 py-2.5 font-semibold lg:table-cell sm:px-3">
                      Property
                    </th>
                    <th className="px-2 py-2.5 font-semibold sm:px-3">Status</th>
                    <th className="px-2 py-2.5 text-right font-semibold sm:px-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageLeads.map((lead) => {
                    const state = followUpState(lead, today)
                    const pendingCall = state === 'today' || state === 'overdue'
                    const sourceExtra = leadSourceSummary(
                      lead.source,
                      lead.sourceDetails || createEmptyLeadSourceDetails(),
                    )
                    const note = lead.followUpNote?.trim() || ''
                    const expanded = expandedId === lead.id
                    const rowBg =
                      state === 'overdue'
                        ? 'bg-danger/[0.04]'
                        : state === 'today'
                          ? 'bg-brand-soft/30'
                          : 'bg-surface'
                    const lastCall =
                      lead.lastContactedAt && lead.lastContactedByName
                        ? `Called by ${lead.lastContactedByName} · ${formatContactedAt(lead.lastContactedAt)}`
                        : null

                    return (
                      <Fragment key={lead.id}>
                        <tr
                          className={`border-b border-line last:border-0 hover:bg-surface-2/40 ${rowBg}`}
                        >
                          <td className="px-1 py-2 sm:px-2">
                            <button
                              type="button"
                              className="rounded-md p-1 text-ink-faint hover:bg-surface-2 hover:text-ink"
                              aria-expanded={expanded}
                              aria-label={
                                expanded ? 'Collapse details' : 'Expand details'
                              }
                              onClick={() =>
                                setExpandedId(expanded ? null : lead.id)
                              }
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition ${
                                  expanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-2 py-2 sm:px-3">
                            <div className="flex min-w-0 items-start gap-2">
                              {state !== 'none' && (
                                <span
                                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                    state === 'overdue'
                                      ? 'bg-danger'
                                      : state === 'today'
                                        ? 'bg-brand'
                                        : 'bg-ink-faint'
                                  }`}
                                  title={
                                    state === 'overdue'
                                      ? 'Overdue'
                                      : state === 'today'
                                        ? 'Due today'
                                        : 'Upcoming'
                                  }
                                />
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="font-semibold text-ink">
                                    {lead.name}
                                  </span>
                                  <span className="text-[11px] text-ink-faint">
                                    {LEAD_SOURCE_LABELS[lead.source]}
                                    {sourceExtra ? ` · ${sourceExtra}` : ''}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                                  <a
                                    href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                                    className="inline-flex items-center gap-1 hover:text-brand"
                                  >
                                    <Phone className="h-3 w-3 text-ink-faint" />
                                    {lead.phone}
                                  </a>
                                  {lead.email ? (
                                    <span className="hidden truncate sm:inline">
                                      {lead.email}
                                    </span>
                                  ) : null}
                                </div>
                                {/* Mobile follow-up + note peek */}
                                <div className="mt-1 space-y-0.5 md:hidden">
                                  {pendingCall && lead.followUpOn && (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span
                                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${followUpBadgeClass(state)}`}
                                      >
                                        <Bell className="h-2.5 w-2.5" />
                                        {state === 'overdue'
                                          ? `Overdue · ${formatFollowUpDate(lead.followUpOn)}`
                                          : 'Call today'}
                                      </span>
                                      {isAdmin && (
                                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                          Not called yet
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {!pendingCall && isAdmin && lastCall && (
                                    <p className="line-clamp-1 text-[11px] text-success">
                                      {lastCall}
                                    </p>
                                  )}
                                  {!pendingCall &&
                                    !isAdmin &&
                                    lead.lastContactNote?.trim() && (
                                      <p className="line-clamp-1 text-[11px] text-ink-muted">
                                        {lead.lastContactNote.trim()}
                                      </p>
                                    )}
                                  {note && pendingCall && (
                                    <p className="line-clamp-1 text-[11px] text-ink-muted">
                                      {note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden max-w-[240px] px-2 py-2 md:table-cell sm:px-3">
                            {pendingCall && lead.followUpOn ? (
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${followUpBadgeClass(state)}`}
                                  >
                                    <Bell className="h-2.5 w-2.5" />
                                    {state === 'overdue'
                                      ? `Overdue · ${formatFollowUpDate(lead.followUpOn)}`
                                      : 'Call today'}
                                  </span>
                                  {isAdmin && (
                                    <span className="inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                      Not called yet
                                    </span>
                                  )}
                                </div>
                                {note ? (
                                  <p className="mt-1 line-clamp-1 text-xs text-ink-muted">
                                    {note}
                                  </p>
                                ) : null}
                              </div>
                            ) : lastCall ? (
                              <div>
                                {isAdmin ? (
                                  <>
                                    <span className="inline-flex items-center gap-1 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
                                      <Check className="h-2.5 w-2.5" />
                                      Contacted
                                    </span>
                                    <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                                      {lastCall}
                                    </p>
                                  </>
                                ) : lead.lastContactNote?.trim() ? (
                                  <p className="line-clamp-2 text-xs text-ink-muted">
                                    {lead.lastContactNote.trim()}
                                  </p>
                                ) : (
                                  <span className="text-xs text-ink-faint">—</span>
                                )}
                                {isAdmin && lead.lastContactNote?.trim() ? (
                                  <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">
                                    {lead.lastContactNote.trim()}
                                  </p>
                                ) : null}
                              </div>
                            ) : state === 'upcoming' && lead.followUpOn ? (
                              <div>
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${followUpBadgeClass(state)}`}
                                >
                                  <Bell className="h-2.5 w-2.5" />
                                  {formatFollowUpDate(lead.followUpOn)}
                                </span>
                                {note ? (
                                  <p className="mt-1 line-clamp-1 text-xs text-ink-muted">
                                    {note}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="hidden px-2 py-2 lg:table-cell sm:px-3">
                            <div className="text-xs font-medium text-ink">
                              {schemeName(lead.schemeId)}
                            </div>
                            <div className="text-[11px] text-ink-faint">
                              {lead.plotId
                                ? plotLabel(lead.schemeId, lead.plotId)
                                : 'No plot'}
                            </div>
                          </td>
                          <td className="px-2 py-2 sm:px-3">
                            {lead.status === 'converted' || !canTakeLeads ? (
                              <span
                                className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusTone(lead.status)}`}
                              >
                                {LEAD_STATUS_LABELS[lead.status]}
                              </span>
                            ) : (
                              <Select
                                value={lead.status}
                                onChange={(e) =>
                                  updateLead(lead.id, {
                                    status: e.target.value as LeadStatus,
                                    ...(e.target.value === 'lost' ||
                                    e.target.value === 'converted'
                                      ? { followUpOn: null, followUpNote: '' }
                                      : {}),
                                  })
                                }
                                className="min-w-[118px] py-1 text-xs"
                              >
                                {PIPELINE_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {LEAD_STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </td>
                          <td className="px-2 py-2 sm:px-3">
                            {canTakeLeads ? (
                              <div className="flex items-center justify-end gap-0.5">
                                {pendingCall && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="!px-2 !py-1"
                                    onClick={() => setMarkCalledLeadId(lead.id)}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Mark called
                                  </Button>
                                )}
                                {isOpenLead(lead) && (
                                  <button
                                    type="button"
                                    title="Set next reminder"
                                    onClick={() => setFollowUpLeadId(lead.id)}
                                    className={`rounded-lg p-1.5 ${
                                      pendingCall
                                        ? 'text-brand hover:bg-brand-soft'
                                        : 'text-ink-muted hover:bg-surface-2 hover:text-brand'
                                    }`}
                                  >
                                    <Bell className="h-4 w-4" />
                                  </button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={pendingCall ? 'outline' : 'primary'}
                                  className="!px-2.5 !py-1"
                                  disabled={
                                    lead.status === 'lost' ||
                                    lead.status === 'converted'
                                  }
                                  onClick={() =>
                                    navigate(
                                      `/bookings/new?lead=${lead.id}${
                                        lead.plotId
                                          ? `&plot=${lead.plotId}`
                                          : ''
                                      }&scheme=${lead.schemeId}`,
                                    )
                                  }
                                >
                                  Book
                                </Button>
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-ink-muted hover:bg-danger/5 hover:text-danger"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Delete lead “${lead.name}”? This cannot be undone.`,
                                      )
                                    ) {
                                      deleteLead(lead.id)
                                    }
                                  }}
                                  aria-label={`Delete ${lead.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-ink-faint">—</span>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-line bg-surface-2/50">
                            <td colSpan={6} className="px-4 py-3 sm:px-6">
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                                    {isAdmin ? 'Call status' : 'Call outcome'}
                                  </p>
                                  {isAdmin ? (
                                    pendingCall ? (
                                      <p className="mt-1 text-sm font-medium text-amber-900">
                                        Not called yet — still in Call today
                                      </p>
                                    ) : lastCall ? (
                                      <p className="mt-1 text-sm text-ink">
                                        {lastCall}
                                      </p>
                                    ) : (
                                      <p className="mt-1 text-sm italic text-ink-faint">
                                        No call logged yet
                                      </p>
                                    )
                                  ) : null}
                                  {lead.lastContactNote?.trim() ? (
                                    <p
                                      className={`text-sm text-ink-muted ${isAdmin ? 'mt-1' : 'mt-1'}`}
                                    >
                                      {lead.lastContactNote.trim()}
                                    </p>
                                  ) : !isAdmin ? (
                                    <p className="mt-1 text-sm italic text-ink-faint">
                                      —
                                    </p>
                                  ) : null}
                                  {canTakeLeads && pendingCall && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMarkCalledLeadId(lead.id)
                                      }
                                      className="mt-1.5 text-xs font-semibold text-brand hover:underline"
                                    >
                                      Mark called
                                    </button>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                                    Follow-up note
                                  </p>
                                  <p className="mt-1 text-sm text-ink">
                                    {note || (
                                      <span className="italic text-ink-faint">
                                        None set
                                      </span>
                                    )}
                                  </p>
                                  {canTakeLeads && isOpenLead(lead) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setFollowUpLeadId(lead.id)
                                      }
                                      className="mt-1.5 text-xs font-semibold text-brand hover:underline"
                                    >
                                      Edit reminder
                                    </button>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                                    Lead notes
                                  </p>
                                  <p className="mt-1 text-sm text-ink-muted">
                                    {lead.notes?.trim() || (
                                      <span className="italic text-ink-faint">
                                        —
                                      </span>
                                    )}
                                  </p>
                                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                                    Property
                                  </p>
                                  <p className="mt-1 text-sm text-ink">
                                    {schemeName(lead.schemeId)}
                                  </p>
                                  <p className="text-xs text-ink-muted">
                                    {lead.plotId
                                      ? plotLabel(lead.schemeId, lead.plotId)
                                      : 'No plot selected'}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5 sm:px-4">
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
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1,
                    )
                    .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push('…')
                      }
                      acc.push(p)
                      return acc
                    }, [])
                    .map((p, i) =>
                      p === '…' ? (
                        <span
                          key={`e-${i}`}
                          className="px-1 text-xs text-ink-faint"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-semibold ${
                            p === currentPage
                              ? 'bg-brand text-brand-ink'
                              : 'text-ink-muted hover:bg-surface-2'
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
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {followUpLead && (
        <FollowUpDialog
          lead={followUpLead}
          today={today}
          onClose={() => setFollowUpLeadId(null)}
          onSave={saveFollowUp}
          onClear={() => clearFollowUp(followUpLead.id)}
        />
      )}

      {markCalledLead && user && (
        <MarkCalledDialog
          lead={markCalledLead}
          today={today}
          isAdmin={isAdmin}
          onClose={() => setMarkCalledLeadId(null)}
          onDone={completeCall}
          onDoneAndRemind={completeCallAndRemind}
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

function LeadFilterChip({
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
