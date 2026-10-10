'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download } from 'lucide-react'
import { qcLabApi } from '@/lib/api'
import { exportQcLogBooksPdf } from '@/lib/export-qc-log-book'
import type { LogBookEntryRow, LogBookExportFactory, LogBookExportInstrument } from '@/lib/export-qc-log-book'
import { QC_TYPE_LABEL } from '@/components/inventory/QcLabResultForm'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'

export type LogBookExportInstrumentOption = LogBookExportInstrument & { id: string }

function instrumentLabel(inst: LogBookExportInstrumentOption, all: LogBookExportInstrumentOption[]) {
  const clash = all.filter((row) => row.type === inst.type).length > 1
  const typeLabel = QC_TYPE_LABEL[inst.type] || inst.name
  if (clash) return `${typeLabel} · ${inst.code}`
  return typeLabel
}

export function QcLogBookExportButton({
  factoryId,
  instruments,
  initialFrom = '',
  initialTo = '',
  disabled,
  variant = 'toolbar',
}: {
  factoryId: string
  instruments: LogBookExportInstrumentOption[]
  initialFrom?: string
  initialTo?: string
  disabled?: boolean
  variant?: 'toolbar' | 'fab'
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canOpen = !disabled && Boolean(factoryId) && instruments.length > 0

  function openDialog() {
    if (!canOpen) return
    setFrom(initialFrom)
    setTo(initialTo)
    setSelectedIds([])
    setError('')
    setOpen(true)
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSelected = instruments.length > 0 && selectedIds.length === instruments.length
  const canExport = Boolean(from && to && selectedIds.length > 0 && !busy)

  const selectedCount = selectedIds.length
  const rangeLabel = useMemo(() => {
    if (!from || !to) return ''
    return from === to ? from : `${from} to ${to}`
  }, [from, to])

  async function exportPdf() {
    if (!canExport) return
    const start = from <= to ? from : to
    const end = from <= to ? to : from
    setBusy(true)
    setError('')
    try {
      const picked = instruments.filter((inst) => selectedIds.includes(inst.id))
      const books: Array<{ instrument: LogBookExportInstrument; entries: LogBookEntryRow[] }> = []
      let factory: LogBookExportFactory | null = null
      for (const inst of picked) {
        const res = await qcLabApi.listLogBook(factoryId, inst.id, { from: start, to: end })
        if (res.error) throw new Error(res.error)
        if (!factory && res.factory) factory = res.factory as LogBookExportFactory
        books.push({
          instrument: (res.instrument ?? inst) as LogBookExportInstrument,
          entries: (res.entries ?? []) as LogBookEntryRow[],
        })
      }
      if (!factory) throw new Error('Factory letterhead was not available for this export.')
      const filename =
        picked.length === 1
          ? `${picked[0].code.replace(/[^\w.-]+/g, '_') || 'instrument'}_log-book.pdf`
          : `lab-log-books_${start}_${end}.pdf`
      await exportQcLogBooksPdf({ factory, books, filename })
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const isFab = variant === 'fab'

  const trigger = (
    <span
      className={
        isFab
          ? 'fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-1 md:hidden'
          : 'inline-flex flex-col items-end gap-1'
      }
    >
      <button
        type="button"
        onClick={openDialog}
        disabled={!canOpen}
        className={
          isFab
            ? 'inline-flex h-12 items-center gap-2 rounded-full bg-text px-5 text-sm font-medium text-panel shadow-lg disabled:cursor-not-allowed disabled:opacity-50'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-muted/80 bg-panel px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        <Download size={isFab ? 18 : 14} />
        Export PDF
      </button>
    </span>
  )

  const dialog = open ? (
    <MgmtDrawer
      title="Export PDF"
      eyebrow="Lab log books"
      subtitle="Choose a date range, then the instruments to include."
      size="sm"
      onClose={() => {
        if (!busy) setOpen(false)
      }}
      footer={
        <>
          <button
            type="button"
            className="btn border border-text bg-panel text-primary"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn border border-chemist bg-chemist text-white disabled:opacity-40"
            disabled={!canExport}
            onClick={() => void exportPdf()}
          >
            {busy ? 'Exporting…' : 'Download PDF'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wider text-muted">Date range</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-muted">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-muted/80 bg-panel px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-inputer focus:ring-2 focus:ring-highlight/70"
              />
            </label>
            <label className="text-xs font-medium text-muted">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-muted/80 bg-panel px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-inputer focus:ring-2 focus:ring-highlight/70"
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <div className="flex items-center justify-between gap-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted">Instruments</legend>
            <button
              type="button"
              className="text-xs font-medium text-chemist disabled:opacity-40"
              disabled={!from || !to}
              onClick={() =>
                setSelectedIds(allSelected ? [] : instruments.map((inst) => inst.id))
              }
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div
            className={`mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border ${
              from && to ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            {instruments.map((inst) => {
              const on = selectedIds.includes(inst.id)
              return (
                <label
                  key={inst.id}
                  className="flex cursor-pointer items-center gap-3 bg-panel px-3 py-3 text-sm text-primary"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!from || !to}
                    onChange={() => toggleId(inst.id)}
                    className="h-4 w-4 accent-[var(--color-chemist,#0f766e)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{instrumentLabel(inst, instruments)}</span>
                    <span className="block text-xs text-muted">{inst.code}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            {from && to
              ? `${selectedCount} selected${rangeLabel ? ` · ${rangeLabel}` : ''}`
              : 'Select from and to dates first.'}
          </p>
        </fieldset>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </MgmtDrawer>
  ) : null

  const ui = (
    <>
      {trigger}
      {dialog && typeof document !== 'undefined' ? createPortal(dialog, document.body) : null}
    </>
  )

  if (isFab) {
    if (typeof document === 'undefined') return null
    return createPortal(ui, document.body)
  }
  return ui
}
