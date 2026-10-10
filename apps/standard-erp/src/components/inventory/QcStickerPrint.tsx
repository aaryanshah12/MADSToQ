'use client'

import { useEffect, useState } from 'react'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import { qcLabApi } from '@/lib/api'
import {
  addYearsIso,
  defaultPackDrumCount,
  formatStickerDmy,
  generatePackLabels,
  isoToInputDate,
  packQtyFromSnapshot,
  parsePackStickerJob,
  parseStickerJson,
  purityFromGcPayload,
  type PackQcStickerData,
  type PackStickerJob,
  type RmQcStickerData,
} from '@/lib/qc-sticker'

type QcLogLite = {
  instrument_type?: string | null
  instrument?: { type?: string | null } | string | null
  payload?: unknown
}

export type RmStickerSubject = {
  id: string
  status: string
  material_type: string
  receipt_number: string
  vendor_name: string
  received_qty: number
  unit: string
  received_date?: string | null
  qc_at?: string | null
  sticker_data?: unknown
}

export type PackStickerSubject = {
  id: string
  qc_status: string
  product_name?: string | null
  batch_no: string
  mfg_date?: string | null
  purity?: number | null
  qc_snapshot?: {
    product_name?: string
    finished_products?: Array<{ qty?: number; requires_qc?: boolean }>
  } | null
  sticker_data?: unknown
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

export function QcRmStickerDrawer({
  receipt,
  logs,
  factoryId,
  saving,
  onClose,
  onPrint,
}: {
  receipt: RmStickerSubject
  logs?: QcLogLite[]
  factoryId?: string
  saving?: boolean
  onClose: () => void
  onPrint: (sticker: RmQcStickerData) => Promise<boolean>
}) {
  const saved = parseStickerJson<RmQcStickerData>(receipt.sticker_data)
  const [gcLogs, setGcLogs] = useState<QcLogLite[]>(logs ?? [])
  const gcPurity = purityFromGcPayload(gcLogs)
  const [form, setForm] = useState<RmQcStickerData>(() => ({
    material_name: saved?.material_name || receipt.material_type,
    lot_no: saved?.lot_no || receipt.receipt_number,
    supplier: saved?.supplier || receipt.vendor_name,
    purity: gcPurity || saved?.purity || '',
    total_qty: saved?.total_qty || `${receipt.received_qty} ${receipt.unit}`,
    inward_date: saved?.inward_date || isoToInputDate(receipt.received_date),
    mfg_date: saved?.mfg_date || '',
    exp_date: saved?.exp_date || '',
    sampling_date:
      saved?.sampling_date || isoToInputDate(receipt.qc_at) || isoToInputDate(receipt.received_date),
    release_date:
      saved?.release_date || isoToInputDate(receipt.qc_at) || isoToInputDate(new Date().toISOString()),
  }))

  useEffect(() => {
    setGcLogs(logs ?? [])
  }, [logs])

  useEffect(() => {
    if (!factoryId || !receipt.id) return
    void qcLabApi.listLogs(factoryId, receipt.id, 'rm').then((res) => {
      setGcLogs((res.entries ?? []) as QcLogLite[])
    })
  }, [factoryId, receipt.id])

  useEffect(() => {
    const pct = purityFromGcPayload(gcLogs)
    if (!pct) return
    setForm((f) => (f.purity === pct ? f : { ...f, purity: pct }))
  }, [gcLogs])

  function set(key: keyof RmQcStickerData, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <MgmtDrawer
      layer="nested"
      eyebrow="RM QC"
      title="Print QC sticker"
      subtitle={receipt.status === 'approved_printed' ? 'Already printed once. Reprint keeps this lot Printed.' : 'First print marks this lot Printed.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            className="btn btn-owner"
            onClick={() => void onPrint(form)}
          >
            {saving ? 'Printing…' : 'Print sticker'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Material name" htmlFor="rm-sticker-material">
          <input id="rm-sticker-material" className="input-field" value={form.material_name} onChange={(e) => set('material_name', e.target.value)} />
        </Field>
        <Field label="Lot no" htmlFor="rm-sticker-lot">
          <input id="rm-sticker-lot" className="input-field" value={form.lot_no} onChange={(e) => set('lot_no', e.target.value)} />
        </Field>
        <Field label="Supplier" htmlFor="rm-sticker-supplier">
          <input id="rm-sticker-supplier" className="input-field" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
        </Field>
        <Field label="Purity % (GC)" htmlFor="rm-sticker-purity">
          <input
            id="rm-sticker-purity"
            className="input-field"
            value={form.purity}
            readOnly={Boolean(gcPurity)}
            onChange={(e) => set('purity', e.target.value)}
          />
        </Field>
        <Field label="Total qty" htmlFor="rm-sticker-qty">
          <input id="rm-sticker-qty" className="input-field" value={form.total_qty} onChange={(e) => set('total_qty', e.target.value)} />
        </Field>
        <Field label="Inward date" htmlFor="rm-sticker-inward">
          <input id="rm-sticker-inward" type="date" className="input-field" value={form.inward_date} onChange={(e) => set('inward_date', e.target.value)} />
        </Field>
        <Field label="Mfg date" htmlFor="rm-sticker-mfg">
          <input id="rm-sticker-mfg" type="date" className="input-field" value={form.mfg_date} onChange={(e) => set('mfg_date', e.target.value)} />
        </Field>
        <Field label="Exp date" htmlFor="rm-sticker-exp">
          <input id="rm-sticker-exp" type="date" className="input-field" value={form.exp_date} onChange={(e) => set('exp_date', e.target.value)} />
        </Field>
        <Field label="Sampling" htmlFor="rm-sticker-sampling">
          <input id="rm-sticker-sampling" type="date" className="input-field" value={form.sampling_date} onChange={(e) => set('sampling_date', e.target.value)} />
        </Field>
        <Field label="Date release" htmlFor="rm-sticker-release">
          <input id="rm-sticker-release" type="date" className="input-field" value={form.release_date} onChange={(e) => set('release_date', e.target.value)} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">
        Sticker dates print as {form.inward_date ? formatStickerDmy(form.inward_date) : 'DD-MM-YY'}.
      </p>
    </MgmtDrawer>
  )
}

export function QcPackStickerDrawer({
  batch,
  logs,
  factoryId,
  saving,
  onClose,
  onPrint,
}: {
  batch: PackStickerSubject
  logs?: QcLogLite[]
  factoryId?: string
  saving?: boolean
  onClose: () => void
  onPrint: (job: PackStickerJob) => Promise<boolean>
}) {
  const saved = parsePackStickerJob(batch.sticker_data)
  const product =
    saved?.product_name ||
    batch.product_name ||
    batch.qc_snapshot?.product_name ||
    ''
  const mfg = saved?.mfg_date || isoToInputDate(batch.mfg_date)
  const qtyFromBatch = packQtyFromSnapshot(batch.qc_snapshot)
  const [gcLogs, setGcLogs] = useState<QcLogLite[]>(logs ?? [])
  const gcPurity = purityFromGcPayload(gcLogs)
  const [form, setForm] = useState({
    product_name: product,
    purity:
      gcPurity ||
      saved?.purity ||
      (batch.purity != null ? String(batch.purity) : ''),
    batch_no: saved?.batch_no || batch.batch_no,
    mfg_date: mfg,
    retest_date: saved?.retest_date || addYearsIso(mfg, 1),
    drum_count: saved?.drum_count || String(defaultPackDrumCount(qtyFromBatch)),
    tare_kg: saved?.tare_kg || '',
    total_net_kg: saved?.total_net_kg || (qtyFromBatch > 0 ? String(qtyFromBatch) : ''),
  })

  useEffect(() => {
    setGcLogs(logs ?? [])
  }, [logs])

  useEffect(() => {
    if (!factoryId || !batch.id) return
    void qcLabApi.listLogs(factoryId, batch.id, 'fg').then((res) => {
      setGcLogs((res.entries ?? []) as QcLogLite[])
    })
  }, [factoryId, batch.id])

  useEffect(() => {
    const pct = purityFromGcPayload(gcLogs)
    if (!pct) return
    setForm((f) => (f.purity === pct ? f : { ...f, purity: pct }))
  }, [gcLogs])

  const tareNum = form.tare_kg === '' ? null : Number(form.tare_kg)
  const labels = generatePackLabels({
    product_name: form.product_name,
    purity: form.purity,
    batch_no: form.batch_no,
    mfg_date: form.mfg_date,
    retest_date: form.retest_date,
    total_net_kg: Number(form.total_net_kg) || 0,
    drum_count: Number(form.drum_count) || 1,
    tare_kg: tareNum != null && Number.isFinite(tareNum) ? tareNum : null,
  })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <MgmtDrawer
      layer="nested"
      eyebrow="SFG / FG"
      title="Generate label stickers"
      subtitle={
        batch.qc_status === 'approved_printed'
          ? 'Already printed once. Reprint keeps this lot Printed.'
          : `Generates ${labels.length} drum label${labels.length === 1 ? '' : 's'}. First print marks this lot Printed.`
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || labels.length === 0}
            className="btn btn-owner"
            onClick={() =>
              void onPrint({
                ...form,
                labels,
              })
            }
          >
            {saving
              ? 'Generating…'
              : `Generate ${labels.length} label${labels.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Product name" htmlFor="pack-sticker-name">
          <input
            id="pack-sticker-name"
            className="input-field uppercase"
            value={form.product_name}
            onChange={(e) => set('product_name', e.target.value)}
          />
        </Field>
        <Field label="Batch no" htmlFor="pack-sticker-batch">
          <input
            id="pack-sticker-batch"
            className="input-field"
            value={form.batch_no}
            onChange={(e) => set('batch_no', e.target.value)}
          />
        </Field>
        <Field label="Purity % (GC)" htmlFor="pack-sticker-purity">
          <input
            id="pack-sticker-purity"
            className="input-field"
            value={form.purity}
            readOnly={Boolean(gcPurity)}
            onChange={(e) => set('purity', e.target.value)}
          />
        </Field>
        <Field label="No. of drums" htmlFor="pack-sticker-drums">
          <input
            id="pack-sticker-drums"
            type="number"
            min={1}
            className="input-field"
            value={form.drum_count}
            onChange={(e) => set('drum_count', e.target.value)}
          />
        </Field>
        <Field label="Mfg date" htmlFor="pack-sticker-mfg">
          <input
            id="pack-sticker-mfg"
            type="date"
            className="input-field"
            value={form.mfg_date}
            onChange={(e) => {
              const next = e.target.value
              setForm((f) => ({
                ...f,
                mfg_date: next,
                retest_date: f.retest_date || addYearsIso(next, 1),
              }))
            }}
          />
        </Field>
        <Field label="Retest date" htmlFor="pack-sticker-retest">
          <input
            id="pack-sticker-retest"
            type="date"
            className="input-field"
            value={form.retest_date}
            onChange={(e) => set('retest_date', e.target.value)}
          />
        </Field>
        <Field label="Total net (KGS)" htmlFor="pack-sticker-total">
          <input
            id="pack-sticker-total"
            className="input-field"
            value={form.total_net_kg}
            onChange={(e) => set('total_net_kg', e.target.value)}
          />
        </Field>
        <Field label="Tare wt / drum (KGS)" htmlFor="pack-sticker-tw">
          <input
            id="pack-sticker-tw"
            className="input-field"
            value={form.tare_kg}
            onChange={(e) => set('tare_kg', e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <p className="border-b border-border bg-layer-sm px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted">
          Drum labels
        </p>
        <ul className="divide-y divide-border text-sm">
          {labels.map((label) => (
            <li key={label.drum_no} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="font-medium">Drum {label.drum_no}</span>
              <span className="tabular-nums text-muted">
                G.W {label.gross_kg || '—'} · T.W {label.tare_kg || '—'} · N.W {label.net_kg || '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </MgmtDrawer>
  )
}

export function PrintStickerButton({
  printed,
  generate,
  onClick,
  className,
}: {
  printed?: boolean
  generate?: boolean
  onClick: () => void
  className?: string
}) {
  const label = generate
    ? printed
      ? 'Reprint'
      : 'Generate'
    : printed
      ? 'Reprint'
      : 'Print'
  return (
    <button type="button" className={className ?? 'btn w-full border border-text bg-panel text-primary'} onClick={onClick}>
      {label}
    </button>
  )
}
