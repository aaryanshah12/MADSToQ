'use client'

import { useState } from 'react'
import { dispatchScheduleApi, qcLabApi } from '@/lib/api'
import QcLabResultForm, {
  type QcInstrument,
  type QcLogEntry,
} from '@/components/inventory/QcLabResultForm'
import QcResultCard from '@/components/inventory/QcResultCard'
import { useToast } from '@/components/providers/ToastProvider'
import { useConfirm } from '@/components/ui'
import { type DispatchSchedule } from '@/components/inventory/DispatchScheduleShared'

export function DispatchScheduleLabWork({
  sale,
  factoryId,
  instruments,
  logs,
  onChanged,
}: {
  sale: DispatchSchedule
  factoryId: string
  instruments: QcInstrument[]
  logs: QcLogEntry[]
  onChanged: (next: { sale?: DispatchSchedule; logs?: QcLogEntry[] }) => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(logs.length === 0)
  const [editing, setEditing] = useState<QcLogEntry | null>(null)
  const editable = sale.status === 'picked' || sale.status === 'coa_pending'
  const sampleDefault =
    sale.lots[0]?.invoice_number || sale.product_name || sale.sale_no || 'Sample'

  async function saveLog(data: {
    id?: string
    instrument_id: string
    entry_date: string
    sample_name: string
    remarks?: string
    payload: Record<string, unknown>
  }) {
    setSaving(true)
    const res = await qcLabApi.saveLog({
      ...data,
      factory_id: factoryId,
      subject_id: sale.id,
      stage: 'coa',
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Result saved')
    setFormOpen(false)
    setEditing(null)
    onChanged({})
  }

  async function removeLog(logId: string) {
    const ok = await confirm({
      title: 'Delete lab result?',
      body: 'The recorded values for this test will be removed. This cannot be undone.',
      confirmLabel: 'Delete result',
      destructive: true,
    })
    if (!ok) return
    const res = await qcLabApi.deleteLog(logId)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Removed')
    onChanged({})
  }

  async function issue() {
    const lot = sale.lots.find((l) => !l.coa_no)
    if (!lot) {
      toast.error('No lot available to issue COA')
      return
    }
    setSaving(true)
    const res = await dispatchScheduleApi.issueCoa(sale.id, { lot_id: lot.id })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(`COA issued for ${lot.invoice_number}`)
    onChanged({ sale: res.sale as DispatchSchedule })
  }

  if (!editable) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">Dispatch sample tests</h3>
        {instruments.length > 0 && !formOpen && (
          <button
            type="button"
            className="btn btn-chemist"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Add test
          </button>
        )}
      </div>
      {instruments.length === 0 && (
        <p className="text-sm text-muted">No lab instruments configured for this factory.</p>
      )}
      {logs.length === 0 && !formOpen && (
        <p className="text-sm text-muted">No results yet. Add tests from the dispatch samples.</p>
      )}
      {logs.map((log) =>
        formOpen && editing?.id === log.id ? (
          <QcLabResultForm
            key={log.id}
            instruments={instruments}
            sampleDefault={sampleDefault}
            existing={editing}
            lockType
            saving={saving}
            onSave={(d) => void saveLog(d)}
            onCancel={() => {
              setFormOpen(false)
              setEditing(null)
            }}
          />
        ) : (
          <QcResultCard
            key={log.id}
            log={log}
            onEdit={() => {
              setEditing(log)
              setFormOpen(true)
            }}
            onDelete={() => void removeLog(log.id)}
          />
        ),
      )}
      {formOpen && !editing && (
        <QcLabResultForm
          instruments={instruments}
          sampleDefault={sampleDefault}
          existing={null}
          excludeTypes={logs.map((l) => l.instrument_type).filter((t): t is string => Boolean(t))}
          saving={saving}
          onSave={(d) => void saveLog(d)}
          onCancel={() => setFormOpen(false)}
        />
      )}
      <button
        type="button"
        disabled={saving || logs.length === 0}
        className="btn btn-chemist"
        onClick={() => void issue()}
      >
        {saving ? 'Issuing…' : 'Issue COA'}
      </button>
    </div>
  )
}
