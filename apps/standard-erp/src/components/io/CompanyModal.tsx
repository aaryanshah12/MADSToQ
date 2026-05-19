'use client'
import { useMemo, useRef, useState, useEffect } from 'react'
import { saveCompany, ensureCountry, ensureState, ensureCity } from '@madstoq/io-system/api'
import type { IOCompany, IOCountry, IOState, IOCity, CompanyType } from '@madstoq/io-system/types'
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

type ComboOption = { id: string; label: string; subLabel?: string }

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
  const blurTimeout = useRef<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = options
      .filter(o => !q || o.label.toLowerCase().startsWith(q))
      .slice(0, maxItems)
    // If no query, still show some options (like a combo dropdown)
    return base
  }, [options, query, maxItems])

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest?.('[data-combo-root="1"]')) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  const displayValue = query || valueLabel

  return (
    <div data-combo-root="1" className="relative">
      <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          value={displayValue}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (blurTimeout.current) window.clearTimeout(blurTimeout.current)
            blurTimeout.current = window.setTimeout(() => setOpen(false), 150)
          }}
          placeholder={placeholder}
          className="input w-full pr-9"
          disabled={disabled}
        />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => !disabled && setOpen(o => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
          disabled={disabled}
          aria-label="Toggle options"
        >
          <span className="text-sm">{open ? '▴' : '▾'}</span>
        </button>
      </div>

      {/* Hidden input to keep old id-based form state */}
      <input type="hidden" value={valueId} readOnly />

      {open && !disabled && (
        <div className="absolute z-[80] mt-2 w-full rounded-xl border border-border shadow-lg overflow-hidden"
          style={{ background: 'var(--color-panel)' }}>
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted">No matches</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={async () => {
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
      )}
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
    person_name:  editing?.person_name   ?? '',
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

  async function onCountrySelect(countryName: string, code?: string) {
    // Ensure this country exists in DB and store its id
    const saved = await ensureCountry(countryName, code ?? null)
    setForm(f => ({ ...f, country_id: String(saved.id), state_id: '', city_id: '' }))
    setCountryLabel(countryName)
    setStateLabel('')
    setCityLabel('')
    setStates([]); setCities([])

    // Fetch states from web (not DB)
    try {
      const res = await fetch(`/api/geo/states?country=${encodeURIComponent(countryName)}`)
      const list = await res.json()
      setStates((list ?? []).map((s: any) => ({ name: s.name })))
    } catch (e) { console.error(e) }
  }

  async function onStateSelect(stateName: string) {
    const cid = form.country_id ? parseInt(form.country_id) : null
    if (!cid) return
    const countryName = countryLabel
    if (!countryName) return

    const saved = await ensureState(stateName, cid, null)
    setForm(f => ({ ...f, state_id: String(saved.id), city_id: '' }))
    setStateLabel(stateName)
    setCityLabel('')
    setCities([])

    // Fetch cities from web (not DB)
    try {
      const res = await fetch(`/api/geo/cities?country=${encodeURIComponent(countryName)}&state=${encodeURIComponent(stateName)}`)
      const list = await res.json()
      setCities((list ?? []).map((c: any) => ({ name: c.name })))
    } catch (e) { console.error(e) }
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="rounded-2xl shadow-2xl w-full max-w-lg my-6 border border-border"
        style={{ background: 'var(--color-panel)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-primary">{editing ? 'Edit Company' : 'Add Company'}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors"><X size={18}/></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Company Name *</label>
            <input value={form.company_name} onChange={f('company_name')} placeholder="Enter company name" className="input w-full" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Type</label>
              <select value={form.company_type} onChange={f('company_type')} className="input w-full">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Contact Person</label>
              <input value={form.person_name} onChange={f('person_name')} placeholder="Name" className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Mobile</label>
              <input value={form.mobile} onChange={f('mobile')} placeholder="+91 99999 99999" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={form.email} onChange={f('email')} placeholder="email@company.com" className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
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
              }}
              maxItems={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Address</label>
              <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                rows={2} placeholder="Full address" className="input w-full resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Pincode</label>
              <input value={form.pincode} onChange={f('pincode')} placeholder="Pincode" className="input w-full" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-inputer">
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
