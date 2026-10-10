'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/providers/ToastProvider'
import { dispatchScheduleApi } from '@/lib/api'
import {
  DispatchScheduleSummary,
  DispatchScheduleViewLotCoa,
  saleStatusBadge,
  saleStatusLabel,
  type DispatchSchedule,
} from '@/components/inventory/DispatchScheduleShared'

export default function WarehouseDispatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const { loading: authLoading } = useAuth()
  const [sale, setSale] = useState<DispatchSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const res = await dispatchScheduleApi.get(id)
    if (res.error) toast.error(res.error)
    setSale((res.sale as DispatchSchedule) ?? null)
    setLoading(false)
  }, [id, toast])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  async function confirm() {
    if (!sale) return
    setSaving(true)
    const res = await dispatchScheduleApi.confirmDispatch(sale.id)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Dispatch confirmed')
    router.push('/inventory/warehouse/dispatch')
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          title={sale ? `Load · ${sale.sale_no}` : 'Dispatch'}
          subtitle="Warehouse · confirm vehicle loaded"
          accent="accountant"
        />
        <Link href="/inventory/warehouse/dispatch" className="text-sm text-muted hover:underline">
          ← Queue
        </Link>

        {loading || !sale ? (
          <p className="text-sm text-muted">{loading ? 'Loading…' : 'Not found'}</p>
        ) : (
          <div className="table-panel space-y-6 p-4 md:p-6">
            <span className={`badge ${saleStatusBadge(sale.status)}`}>
              {saleStatusLabel(sale.status, sale.schedule_kind)}
            </span>
            <DispatchScheduleSummary sale={sale} hideCommercial />
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted">Vehicle</span> {sale.vehicle_no || '—'}
              </p>
              <p>
                <span className="text-muted">Drums</span>{' '}
                {sale.drum_count != null ? sale.drum_count : '—'}
              </p>
              <p>
                <span className="text-muted">Invoice</span> {sale.tally_invoice_no || '—'}
              </p>
            </div>
            {sale.lots.map((lot) => (
              <div key={lot.id} className="rounded-lg border border-border/60 p-3">
                <p className="font-mono text-xs">
                  {lot.invoice_number} · {lot.qty} {sale.unit}
                  {lot.coa_no ? ` · ${lot.coa_no}` : ''}
                </p>
                <DispatchScheduleViewLotCoa
                  sale={sale}
                  lot={lot}
                  factoryId={sale.factory_id || ''}
                  hideCommercial
                />
              </div>
            ))}
            {sale.status === 'invoiced' && (
              <button
                type="button"
                className="btn btn-pmc"
                disabled={saving}
                onClick={() => void confirm()}
              >
                {saving ? 'Confirming…' : 'Confirm loaded'}
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
