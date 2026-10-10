'use client'

import { useEffect, useMemo, useState } from 'react'

export type QcInstrument = {
  id: string
  code: string
  name: string
  type: string
}

export type QcLogEntry = {
  id: string
  subject_id?: string
  instrument_id: string
  instrument_type: string | null
  instrument_code: string | null
  instrument_name: string | null
  entry_date: string
  sample_name: string
  remarks: string | null
  payload: Record<string, unknown>
}

type Props = {
  instruments: QcInstrument[]
  sampleDefault: string
  existing?: QcLogEntry | null
  lockType?: boolean
  /** Hide these instrument types from the Test type dropdown (already entered). */
  excludeTypes?: string[]
  /** Finished-goods checks that are complies / does not comply, not instrument readings. */
  extraTypes?: string[]
  onSave: (data: {
    id?: string
    instrument_id?: string
    result_kind?: 'description' | 'identification'
    entry_date: string
    sample_name: string
    remarks?: string
    payload: Record<string, unknown>
  }) => Promise<void>
  onCancel?: () => void
  saving?: boolean
}


export const FG_COA_CHECK_TYPES = ['description', 'identification'] as const

export const QC_TYPE_LABEL: Record<string, string> = {
  description: 'Description',
  identification: 'Identification (By GC)',
  density: 'Density',
  boiling_point: 'Boiling point',
  karl_fisher: 'Karl Fisher',
  gc: 'GC',
}

function compliesLabel(payload: Record<string, unknown>) {
  if (payload.complies === true) return 'Complies'
  if (payload.complies === false) return 'Does not comply'
  return ''
}

function num(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="font-mono text-[10px] uppercase text-muted">
      {children}
      {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
    </span>
  )
}

export default function QcLabResultForm({
  instruments,
  sampleDefault,
  existing,
  lockType,
  excludeTypes,
  extraTypes,
  onSave,
  onCancel,
  saving,
}: Props) {
  const byType = useMemo(() => {
    const m = new Map<string, QcInstrument[]>()
    for (const i of instruments) {
      const list = m.get(i.type) ?? []
      list.push(i)
      m.set(i.type, list)
    }
    return m
  }, [instruments])

  const excluded = useMemo(
    () => new Set((excludeTypes ?? []).filter(Boolean)),
    [excludeTypes],
  )

  const types = useMemo(() => {
    const all = [...byType.keys()]
    const extra = (extraTypes ?? []).filter((t) => !all.includes(t))
    if (lockType || existing) {
      const locked = existing?.instrument_type
      if (locked && !all.includes(locked) && !extra.includes(locked)) extra.push(locked)
      return [...all, ...extra]
    }
    return [
      ...all.filter((t) => !excluded.has(t)),
      ...extra.filter((t) => !excluded.has(t)),
    ]
  }, [byType, excluded, extraTypes, existing, lockType])

  const initialType =
    existing?.instrument_type ||
    types[0] ||
    [...byType.keys()].find((t) => !excluded.has(t)) ||
    instruments[0]?.type ||
    'density'

  const [type, setType] = useState(initialType)
  const typeInstruments = byType.get(type) ?? []
  const [instrumentId, setInstrumentId] = useState(
    existing?.instrument_id || typeInstruments[0]?.id || '',
  )
  const [entryDate, setEntryDate] = useState(
    existing?.entry_date || new Date().toISOString().slice(0, 10),
  )
  const [sampleName, setSampleName] = useState(existing?.sample_name || sampleDefault)
  const [remarks, setRemarks] = useState(existing?.remarks || '')
  const p = existing?.payload ?? {}

  const [tare, setTare] = useState(String(p.tare_g ?? ''))
  const [gross, setGross] = useState(String(p.gross_g ?? ''))
  const [volume, setVolume] = useState(String(p.volume_ml ?? ''))
  const [resultC, setResultC] = useState(String(p.result_c ?? ''))
  const [wf1, setWf1] = useState(String(p.water_factor_1 ?? ''))
  const [wf2, setWf2] = useState(String(p.water_factor_2 ?? ''))
  const [wf3, setWf3] = useState(String(p.water_factor_3 ?? ''))
  const [inject, setInject] = useState(String(p.inject_volume_ml ?? ''))
  const [kfDensity, setKfDensity] = useState(String(p.density ?? ''))
  const [resultPct, setResultPct] = useState(String(p.result_pct ?? ''))
  const [method, setMethod] = useState(String(p.method ?? ''))
  const [fileNo, setFileNo] = useState(String(p.file_no ?? ''))
  const [rtMin, setRtMin] = useState(String(p.rt_min ?? ''))
  const [pct, setPct] = useState(String(p.percentage ?? ''))
  const [complies, setComplies] = useState(
    p.complies === true ? 'yes' : p.complies === false ? 'no' : '',
  )
  const qualitative = type === 'description' || type === 'identification'

  const netPreview =
    type === 'density' && tare !== '' && gross !== ''
      ? (num(gross) - num(tare)).toFixed(3)
      : null
  const densityPreview =
    type === 'density' && netPreview != null && num(volume) > 0
      ? (Number(netPreview) / num(volume)).toFixed(4)
      : null
  const avgPreview =
    type === 'karl_fisher' && wf1 !== '' && wf2 !== '' && wf3 !== ''
      ? ((num(wf1) + num(wf2) + num(wf3)) / 3).toFixed(4)
      : null

  useEffect(() => {
    if (lockType || existing) return
    if (types.length === 0) return
    if (!types.includes(type)) {
      const next = types[0]
      setType(next)
      const list = byType.get(next) ?? []
      setInstrumentId(list[0]?.id || '')
    }
  }, [types, type, lockType, existing, byType])

  function onTypeChange(next: string) {
    setType(next)
    const list = byType.get(next) ?? []
    setInstrumentId(list[0]?.id || '')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const isCheck = type === 'description' || type === 'identification'
    if (!isCheck && !instrumentId) return
    if (isCheck && complies !== 'yes' && complies !== 'no') return
    let payload: Record<string, unknown> = {}
    if (isCheck) {
      payload = { complies: complies === 'yes' }
    } else if (type === 'density') {
      payload = { tare_g: num(tare), gross_g: num(gross), volume_ml: num(volume) }
    } else if (type === 'boiling_point') {
      payload = { result_c: num(resultC) }
    } else if (type === 'karl_fisher') {
      payload = {
        water_factor_1: num(wf1),
        water_factor_2: num(wf2),
        water_factor_3: num(wf3),
        inject_volume_ml: inject === '' ? undefined : num(inject),
        density: kfDensity === '' ? undefined : num(kfDensity),
        result_pct: resultPct === '' ? undefined : num(resultPct),
      }
    } else if (type === 'gc') {
      payload = {
        method: method || undefined,
        file_no: fileNo || undefined,
        rt_min: rtMin === '' ? undefined : num(rtMin),
        percentage: pct === '' ? undefined : num(pct),
      }
    }
    await onSave({
      id: existing?.id,
      instrument_id: isCheck ? undefined : instrumentId,
      result_kind: isCheck ? (type as 'description' | 'identification') : undefined,
      entry_date: entryDate,
      sample_name: sampleName,
      remarks: remarks || undefined,
      payload,
    })
  }

  if (!lockType && !existing && types.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          All test types already have results. Edit or delete an existing result to change it.
        </p>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <FieldLabel required>Test type</FieldLabel>
          <select
            className="input-field chemist-focus mt-1 disabled:opacity-70"
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            required
            disabled={lockType}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {QC_TYPE_LABEL[t] || t}
              </option>
            ))}
          </select>
        </label>
        {qualitative ? (
          <label className="block text-xs">
            <FieldLabel required>Result</FieldLabel>
            <select
              className="input-field chemist-focus mt-1"
              value={complies}
              onChange={(e) => setComplies(e.target.value)}
              required
            >
              <option value="">Select</option>
              <option value="yes">Complies</option>
              <option value="no">Does not comply</option>
            </select>
          </label>
        ) : (
        <label className="block text-xs">
          <FieldLabel required>Instrument</FieldLabel>
          <select
            className="input-field chemist-focus mt-1"
            value={instrumentId}
            onChange={(e) => setInstrumentId(e.target.value)}
            required
          >
            {typeInstruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name}
              </option>
            ))}
          </select>
        </label>
        )}
        <label className="block text-xs">
          <FieldLabel required>Date</FieldLabel>
          <input
            type="date"
            className="input-field chemist-focus mt-1"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs">
          <FieldLabel required>Sample name</FieldLabel>
          <input
            className="input-field chemist-focus mt-1"
            value={sampleName}
            onChange={(e) => setSampleName(e.target.value)}
            required
          />
        </label>
      </div>

      {type === 'density' && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <FieldLabel required>Tare (g)</FieldLabel>
              <input type="number" step="any" className="input-field chemist-focus mt-1" value={tare} onChange={(e) => setTare(e.target.value)} required />
            </label>
            <label className="block text-xs">
              <FieldLabel required>Gross (g)</FieldLabel>
              <input type="number" step="any" className="input-field chemist-focus mt-1" value={gross} onChange={(e) => setGross(e.target.value)} required />
            </label>
            <label className="block text-xs">
              <FieldLabel required>Volume (ml)</FieldLabel>
              <input type="number" step="any" className="input-field chemist-focus mt-1" value={volume} onChange={(e) => setVolume(e.target.value)} required />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
            <label className="block text-xs">
              <FieldLabel>Net (g)</FieldLabel>
              <input
                type="text"
                className="input-field mt-1 bg-surface/60 text-primary tabular-nums"
                value={netPreview ?? '—'}
                readOnly
                tabIndex={-1}
                aria-live="polite"
              />
            </label>
            <label className="block text-xs">
              <FieldLabel>Density</FieldLabel>
              <input
                type="text"
                className="input-field mt-1 bg-surface/60 text-primary tabular-nums font-medium"
                value={densityPreview ?? '—'}
                readOnly
                tabIndex={-1}
                aria-live="polite"
              />
            </label>
          </div>
        </div>
      )}

      {type === 'boiling_point' && (
        <label className="block text-xs max-w-xs">
          <FieldLabel required>Result (°C)</FieldLabel>
          <input type="number" step="any" className="input-field chemist-focus mt-1" value={resultC} onChange={(e) => setResultC(e.target.value)} required />
        </label>
      )}

      {type === 'karl_fisher' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs">
            <FieldLabel required>Water factor 1</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={wf1} onChange={(e) => setWf1(e.target.value)} required />
          </label>
          <label className="block text-xs">
            <FieldLabel required>Water factor 2</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={wf2} onChange={(e) => setWf2(e.target.value)} required />
          </label>
          <label className="block text-xs">
            <FieldLabel required>Water factor 3</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={wf3} onChange={(e) => setWf3(e.target.value)} required />
          </label>
          <label className="block text-xs">
            <FieldLabel>Inject vol (ml)</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={inject} onChange={(e) => setInject(e.target.value)} />
          </label>
          <label className="block text-xs">
            <FieldLabel>Density</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={kfDensity} onChange={(e) => setKfDensity(e.target.value)} />
          </label>
          <label className="block text-xs">
            <FieldLabel required>Result (%)</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={resultPct} onChange={(e) => setResultPct(e.target.value)} required />
          </label>
          <p className="sm:col-span-3 text-xs text-muted">Average factor {avgPreview ?? '—'}</p>
        </div>
      )}

      {type === 'gc' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            <FieldLabel>Method</FieldLabel>
            <input className="input-field chemist-focus mt-1" value={method} onChange={(e) => setMethod(e.target.value)} />
          </label>
          <label className="block text-xs">
            <FieldLabel>File no</FieldLabel>
            <input className="input-field chemist-focus mt-1" value={fileNo} onChange={(e) => setFileNo(e.target.value)} />
          </label>
          <label className="block text-xs">
            <FieldLabel required>R.T. (min)</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={rtMin} onChange={(e) => setRtMin(e.target.value)} required />
          </label>
          <label className="block text-xs">
            <FieldLabel required>Percentage (%)</FieldLabel>
            <input type="number" step="any" className="input-field chemist-focus mt-1" value={pct} onChange={(e) => setPct(e.target.value)} required />
          </label>
        </div>
      )}

      <label className="block text-xs">
        <FieldLabel>Remark</FieldLabel>
        <input className="input-field chemist-focus mt-1" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || (qualitative ? complies !== 'yes' && complies !== 'no' : !instrumentId)}
          className="btn btn-chemist h-9 disabled:opacity-40"
        >
          {saving ? 'Saving…' : existing ? 'Update result' : 'Save result'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost h-9" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export function formatPayloadSummary(type: string | null, payload: Record<string, unknown>) {
  if (!type) return JSON.stringify(payload)
  if (type === 'description' || type === 'identification') return compliesLabel(payload) || '—'
  if (type === 'density') {
    const dens = payload.density
    const densStr =
      dens != null && dens !== '' ? Number(dens).toFixed(4) : '—'
    return `Net ${payload.net_g ?? '—'} g · Density ${densStr}`
  }
  if (type === 'boiling_point') return `${payload.result_c ?? '—'} °C`
  if (type === 'karl_fisher') {
    const avg =
      payload.average_factor != null && payload.average_factor !== ''
        ? Number(payload.average_factor).toFixed(4)
        : '—'
    const pct =
      payload.result_pct != null && payload.result_pct !== ''
        ? `${payload.result_pct}%`
        : 'not entered'
    return `Avg factor ${avg} · Result ${pct}`
  }
  if (type === 'gc') {
    const pct =
      payload.percentage != null && payload.percentage !== ''
        ? `${payload.percentage}%`
        : 'not entered'
    return `RT ${payload.rt_min ?? '—'} min · ${pct}`
  }
  return JSON.stringify(payload)
}

export function payloadDetailRows(
  type: string | null,
  payload: Record<string, unknown>,
): { label: string; value: string }[] {
  if (!type) return []
  if (type === 'density') {
    return [
      { label: 'Tare', value: `${payload.tare_g ?? '—'} g` },
      { label: 'Gross', value: `${payload.gross_g ?? '—'} g` },
      { label: 'Volume', value: `${payload.volume_ml ?? '—'} ml` },
      { label: 'Net', value: `${payload.net_g ?? '—'} g` },
      {
        label: 'Density',
        value:
          payload.density != null && payload.density !== ''
            ? String(Number(payload.density).toFixed(4))
            : '—',
      },
    ]
  }
  if (type === 'boiling_point') {
    return [{ label: 'Result', value: `${payload.result_c ?? '—'} °C` }]
  }
  if (type === 'karl_fisher') {
    return [
      { label: 'Factor 1', value: String(payload.water_factor_1 ?? '—') },
      { label: 'Factor 2', value: String(payload.water_factor_2 ?? '—') },
      { label: 'Factor 3', value: String(payload.water_factor_3 ?? '—') },
      {
        label: 'Average',
        value:
          payload.average_factor != null
            ? Number(payload.average_factor).toFixed(4)
            : '—',
      },
      {
        label: 'Inject vol',
        value:
          payload.inject_volume_ml != null && payload.inject_volume_ml !== ''
            ? `${payload.inject_volume_ml} ml`
            : '—',
      },
      {
        label: 'Result',
        value:
          payload.result_pct != null && payload.result_pct !== ''
            ? `${payload.result_pct} %`
            : '—',
      },
    ]
  }
  if (type === 'gc') {
    return [
      { label: 'Method', value: String(payload.method || '—') },
      { label: 'File no', value: String(payload.file_no || '—') },
      { label: 'R.T.', value: `${payload.rt_min ?? '—'} min` },
      {
        label: 'Percentage',
        value:
          payload.percentage != null && payload.percentage !== ''
            ? `${payload.percentage} %`
            : '—',
      },
    ]
  }
  return []
}
