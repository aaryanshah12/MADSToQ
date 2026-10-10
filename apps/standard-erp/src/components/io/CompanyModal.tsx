'use client'
import { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { saveCompany, ensureCountry, ensureState, ensureCity } from '@madstoq/io-system/api'
import type { IOCompany, CompanyType } from '@madstoq/io-system/types'
import { X, Save } from 'lucide-react'
import { useIOFactory } from '@/contexts/IOFactoryContext'

interface Props {
  editing?: IOCompany | null
  defaultType?: CompanyType
  factoryId?: string | null
  lockCountry?: boolean
  lockCountryName?: string
  onClose: () => void
  onSaved: (company: IOCompany) => void
}

const TYPES: { value: CompanyType; label: string }[] = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'both',     label: 'Both'     },
]

const PERSON_TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'M/s', 'Shri', 'Smt.'] as const

function initialPersonFields(editing?: IOCompany | null) {
  if (editing?.person_title) {
    return { person_title: editing.person_title, person_name: editing.person_name ?? '' }
  }
  const full = (editing?.person_name ?? '').trim()
  if (!full) return { person_title: '', person_name: '' }
  for (const t of PERSON_TITLES) {
    if (full.startsWith(`${t} `)) {
      return { person_title: t, person_name: full.slice(t.length + 1).trim() }
    }
  }
  return { person_title: '', person_name: full }
}

type ComboOption = { id: string; label: string; subLabel?: string }

async function fetchGeoStates(countryName: string) {
  const res = await fetch(`/api/geo/states?country=${encodeURIComponent(countryName)}`)
  const list = await res.json()
  return (list ?? []).map((s: { name: string }) => ({ name: s.name }))
}

async function fetchGeoCities(countryName: string, stateName: string) {
  const res = await fetch(`/api/geo/cities?country=${encodeURIComponent(countryName)}&state=${encodeURIComponent(stateName)}`)
  const list = await res.json()
  return (list ?? []).map((c: { name: string }) => ({ name: c.name }))
}

function ComboSearch({
  label,
  placeholder,
  disabled,
  valueId,
  valueLabel,
  query,
  setQuery,
  options,
  onSelect,
  maxItems = 40,
}: {
  label: string
  placeholder: string
  disabled?: boolean
  valueId: string
  valueLabel: string
  query: string
  setQuery: (v: string) => void
  options: ComboOption[]
  onSelect: (id: string) => void | Promise<void>
  maxItems?: number
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const blurTimeout = useRef<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, maxItems)
    return options
      .filter(o => o.label.toLowerCase().includes(q))
      .slice(0, maxItems)
  }, [options, query, maxItems])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest?.('[data-combo-root="1"]')) return
      if (target.closest?.('[data-combo-menu="1"]')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  useLayoutEffect(() => {
    if (!open || disabled) {
      setMenuPosition(null)
      return
    }

    const updateMenuPosition = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return

      const gap = 4
      const viewportPadding = 12
      const preferredHeight = 220
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const maxHeight = Math.min(preferredHeight, Math.max(96, spaceBelow - gap))

      setMenuPosition({
        top: rect.bottom + gap,
        left: Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - rect.width - viewportPadding)),
        width: rect.width,
        maxHeight,
      })
    }

    updateMenuPosition()
    const raf = requestAnimationFrame(updateMenuPosition)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, disabled, filtered.length])

  const displayValue = query || valueLabel

  const menu = open && !disabled && menuPosition ? (
    <div
      data-combo-menu="1"
      className="fixed z-[100] overflow-hidden rounded-xl border border-border shadow-lg"
      style={{
        background: 'var(--color-panel)',
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
      }}
    >
      <div className="overflow-y-auto" style={{ maxHeight: menuPosition.maxHeight }}>
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted">{options.length === 0 ? 'Loading options…' : 'No matches'}</div>
        ) : (
          filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onMouseDown={async e => {
                e.preventDefault()
                await onSelect(o.id)
                setQuery('')
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-layer-sm transition-colors border-b border-border last:border-b-0"
            >
              <div className="text-sm text-primary font-medium">{o.label}</div>
              {o.subLabel && <div className="text-[11px] text-muted mt-0.5">{o.subLabel}</div>}
            </button>
          ))
        )}
      </div>
    </div>
  ) : null

  return (
    <div data-combo-root="1" className="relative min-w-0">
      <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          value={displayValue}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onBlur={() => {
            if (blurTimeout.current) window.clearTimeout(blurTimeout.current)
            blurTimeout.current = window.setTimeout(() => setOpen(false), 150)
          }}
          placeholder={placeholder}
          className="input w-full pr-9"
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            if (disabled) return
            setQuery('')
            setOpen(o => !o)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
          disabled={disabled}
          aria-label="Toggle options"
        >
          <span className="text-sm">{open ? '▴' : '▾'}</span>
        </button>
      </div>

      {/* Hidden input to keep old id-based form state */}
      <input type="hidden" value={valueId} readOnly />

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}

export default function CompanyModal({
  editing,
  defaultType = 'supplier',
  factoryId: factoryIdProp,
  lockCountry = false,
  lockCountryName,
  onClose,
  onSaved,
}: Props) {
  const { factoryId: ctxFactoryId, factories } = useIOFactory()
  const factoryId = factoryIdProp ?? (factories.length === 1 ? ctxFactoryId : null)
  // Note: These arrays are only for showing web results.
  // Selected ids saved into `form` are DB ids (from ensureCountry/ensureState/ensureCity).
  const [countries, setCountries] = useState<Array<{ name: string; code?: string | null }>>([])
  const [states, setStates]       = useState<Array<{ name: string }>>([])
  const [cities, setCities]       = useState<Array<{ name: string }>>([])
  const [saving, setSaving]       = useState(false)
  const [countryQuery, setCountryQuery] = useState('')
  const [stateQuery, setStateQuery]     = useState('')
  const [cityQuery, setCityQuery]       = useState('')
  const [countryLabel, setCountryLabel] = useState(editing?.country?.name ?? '')
  const [stateLabel, setStateLabel]     = useState(editing?.state?.name ?? '')
  const [cityLabel, setCityLabel]       = useState(editing?.city?.name ?? '')

  const [form, setForm] = useState({
    company_name: editing?.company_name  ?? '',
    company_type: (editing?.company_type ?? defaultType) as CompanyType,
    ...initialPersonFields(editing),
    mobile:       editing?.mobile        ?? '',
    email:        editing?.email         ?? '',
    address:      editing?.address       ?? '',
    pincode:      editing?.pincode       ?? '',
    country_id:   editing?.country_id?.toString() ?? '',
    state_id:     editing?.state_id?.toString()   ?? '',
    city_id:      editing?.city_id?.toString()     ?? '',
  })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/geo/countries')
        const list = await res.json()
        setCountries((list ?? []).map((c: any) => ({ name: c.name, code: c.code ?? null })))
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  useEffect(() => {
    if (!lockCountry || !lockCountryName) return
    if (form.country_id) return
    const c = countries.find(x => x.name.toLowerCase() === lockCountryName.toLowerCase())
    if (!c) return
    ;(async () => {
      await onCountrySelect(c.name, c.code ?? undefined)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockCountry, lockCountryName, countries])

  useEffect(() => {
    const countryName = countryLabel || editing?.country?.name
    if (!form.country_id || !countryName) {
      setStates([])
      return
    }

    let cancelled = false
    fetchGeoStates(countryName)
      .then(list => { if (!cancelled) setStates(list) })
      .catch(e => console.error(e))

    return () => { cancelled = true }
  }, [form.country_id, countryLabel, editing?.country?.name])

  useEffect(() => {
    const countryName = countryLabel || editing?.country?.name
    const stateName = stateLabel || editing?.state?.name
    if (!form.state_id || !countryName || !stateName) {
      setCities([])
      return
    }

    let cancelled = false
    fetchGeoCities(countryName, stateName)
      .then(list => { if (!cancelled) setCities(list) })
      .catch(e => console.error(e))

    return () => { cancelled = true }
  }, [form.state_id, stateLabel, countryLabel, editing?.state?.name, editing?.country?.name])

  async function onCountrySelect(countryName: string, code?: string) {
    const saved = await ensureCountry(countryName, code ?? null)
    setForm(f => ({ ...f, country_id: String(saved.id), state_id: '', city_id: '' }))
    setCountryLabel(countryName)
    setStateLabel('')
    setCityLabel('')
    setStateQuery('')
    setCityQuery('')
  }

  async function onStateSelect(stateName: string) {
    const cid = form.country_id ? parseInt(form.country_id) : null
    if (!cid) return

    const saved = await ensureState(stateName, cid, null)
    setForm(f => ({ ...f, state_id: String(saved.id), city_id: '' }))
    setStateLabel(stateName)
    setCityLabel('')
    setCityQuery('')
  }

  const countryOptions: ComboOption[] = useMemo(
    () => countries.map(c => ({ id: c.name, label: c.name, subLabel: c.code ? `Code: ${c.code}` : undefined })),
    [countries]
  )
  const stateOptions: ComboOption[] = useMemo(
    () => states.map(s => ({ id: s.name, label: s.name })),
    [states]
  )
  const cityOptions: ComboOption[] = useMemo(
    () => cities.map(c => ({ id: c.name, label: c.name })),
    [cities]
  )

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  async function handleSave() {
    if (!form.company_name.trim()) { alert('Company name is required'); return }
    setSaving(true)
    try {
      const saved = await saveCompany({
        id:           editing?.id,
        factory_id:   editing ? editing.factory_id : (factoryId ?? null),
        company_name: form.company_name.trim(),
        company_type: form.company_type,
        person_title: form.person_title || null,
        person_name:  form.person_name  || null,
        mobile:       form.mobile       || null,
        email:        form.email        || null,
        address:      form.address      || null,
        pincode:      form.pincode      || null,
        country_id:   form.country_id ? parseInt(form.country_id) : null,
        state_id:     form.state_id   ? parseInt(form.state_id)   : null,
        city_id:      form.city_id    ? parseInt(form.city_id)     : null,
        is_active:    true,
      })
      onSaved(saved)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
      <div className="rounded-2xl shadow-2xl w-full max-w-lg min-w-0 my-4 sm:my-6 border border-border overflow-hidden"
        style={{ background: 'var(--color-panel)' }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-primary">{editing ? 'Edit Company' : 'Add Company'}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors"><X size={18}/></button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 min-w-0">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Company Name *</label>
            <input value={form.company_name} onChange={f('company_name')} placeholder="Enter company name" className="input w-full" autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Type</label>
            <select value={form.company_type} onChange={f('company_type')} className="input w-full sm:max-w-xs">
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Contact Person</label>
            <div className="flex flex-nowrap items-stretch gap-2 w-full min-w-0">
              <select
                value={form.person_title}
                onChange={f('person_title')}
                className="input !w-[5.25rem] !min-w-[5.25rem] !max-w-[5.25rem] shrink-0 flex-none px-2"
                aria-label="Contact title"
              >
                <option value="">—</option>
                {PERSON_TITLES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                value={form.person_name}
                onChange={f('person_name')}
                placeholder="Name"
                className="input !w-auto min-w-0 flex-1 basis-0 grow"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Mobile</label>
              <input value={form.mobile} onChange={f('mobile')} placeholder="+91 99999 99999" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={form.email} onChange={f('email')} placeholder="email@company.com" className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
            <ComboSearch
              label="Country"
              placeholder={lockCountry && lockCountryName ? lockCountryName : 'Type to search…'}
              disabled={lockCountry}
              valueId={form.country_id}
              valueLabel={countryLabel}
              query={countryQuery}
              setQuery={setCountryQuery}
              options={countryOptions}
              onSelect={async (id) => {
                const picked = countries.find(c => c.name === id)
                await onCountrySelect(id, picked?.code ?? undefined)
              }}
              maxItems={60}
            />
            <ComboSearch
              label="State"
              placeholder={!form.country_id ? 'Select country first' : 'Type to search…'}
              disabled={!form.country_id}
              valueId={form.state_id}
              valueLabel={stateLabel}
              query={stateQuery}
              setQuery={setStateQuery}
              options={stateOptions}
              onSelect={async (id) => {
                await onStateSelect(id)
              }}
              maxItems={80}
            />
            <ComboSearch
              label="City"
              placeholder={!form.state_id ? 'Select state first' : 'Type to search…'}
              disabled={!form.state_id}
              valueId={form.city_id}
              valueLabel={cityLabel}
              query={cityQuery}
              setQuery={setCityQuery}
              options={cityOptions}
              onSelect={async (id) => {
                const sid = form.state_id ? parseInt(form.state_id) : null
                if (!sid) return
                const saved = await ensureCity(id, sid)
                setForm(prev => ({ ...prev, city_id: String(saved.id) }))
                setCityLabel(id)
                setCityQuery('')
              }}
              maxItems={80}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Address</label>
            <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              rows={2} placeholder="Full address" className="input w-full resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Pincode</label>
            <input value={form.pincode} onChange={f('pincode')} placeholder="Pincode" className="input w-full sm:max-w-xs" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-4 border-t border-border">
          <button onClick={onClose} className="btn btn-ghost w-full sm:w-auto justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-inputer w-full sm:w-auto justify-center">
            {saving
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
              : <Save size={14}/>}
            {editing ? 'Update' : 'Add Company'}
          </button>
        </div>
      </div>
    </div>
  )
}
