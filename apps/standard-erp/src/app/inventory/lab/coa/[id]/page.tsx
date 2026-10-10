'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { dispatchScheduleApi, warehouseApi } from '@/lib/api'
import {
  DispatchSchedulePickLots,
  DispatchScheduleSummary,
  fgLotsForProduct,
  saleStatusBadge,
  saleStatusLabel,
  type DispatchSchedule,
  type FgStockLot,
} from '@/components/inventory/DispatchScheduleShared'

export default function LabCoaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [sale, setSale] = useState<DispatchSchedule | null>(null)
  const [stock, setStock] = useState<FgStockLot[]>([])
  const [qtyByLot, setQtyByLot] = useState<Record<string, string>>({})
  const [invoiceNo, setInvoiceNo] = useState('')
  const [drumCount, setDrumCount] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!id || !factoryId) return
    setLoading(true)
    const [saleRes, approvedRes, rejectedRes] = await Promise.all([
      dispatchScheduleApi.get(id),
      warehouseApi.listStock(factoryId, undefined, 'approved', 'fg'),
      warehouseApi.listStock(factoryId, undefined, 'rejected', 'fg'),
    ])
    if (saleRes.error) toast.error(saleRes.error)
    if (approvedRes.error) toast.error(approvedRes.error)
    if (rejectedRes.error) toast.error(rejectedRes.error)
    setSale((saleRes.sale as DispatchSchedule) ?? null)
    setStock([
      ...((approvedRes.stock ?? []) as FgStockLot[]),
      ...((rejectedRes.stock ?? []) as FgStockLot[]),
    ])
    setLoading(false)
  }, [id, factoryId, toast])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  const availableLots = useMemo(() => {
    if (!sale) return []
    const matched = fgLotsForProduct(stock, sale.product_name, sale.product_code)
    if (sale.is_discounted) {
      return matched.filter((l) => l.stock_grade === 'rejected')
    }
    return matched.filter((l) => l.stock_grade !== 'rejected')
  }, [sale, stock])

  async function confirmPick() {
    if (!sale) return
    const lines = Object.entries(qtyByLot)
      .map(([invoice_number, q]) => ({ invoice_number, qty: Number(q) }))
      .filter((l) => l.qty > 0)
    if (lines.length === 0) {
      toast.error('Select at least one lot with qty')
      return
    }
    const drums = Number(drumCount)
    if (!invoiceNo.trim()) {
      toast.error('Enter the Tally invoice number')
      return
    }
    if (!Number.isInteger(drums) || drums < 1) {
      toast.error('Enter the number of drums')
      return
    }
    setSaving(true)
    const res = await dispatchScheduleApi.pickLots(sale.id, {
      lines,
      tally_invoice_no: invoiceNo.trim(),
      drum_count: drums,
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Lots allocated and COA generated')
    setQtyByLot({})
    await reload()
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          title={sale ? `COA · ${sale.sale_no}` : 'Dispatch COA'}
          subtitle="Lab · allocate lots, enter the Tally invoice and drum count, and generate the COA."
          accent="chemist"
        />
        <Link href="/inventory/lab/coa" className="text-sm text-muted hover:underline">
          ← Queue
        </Link>

        {loading || !sale ? (
          <p className="text-sm text-muted">{loading ? 'Loading…' : 'Not found'}</p>
        ) : sale.schedule_kind === 'byproduct' ? (
          <p className="text-sm text-muted">
            Byproduct schedules have no COA. Accountant invoices them and FIFO stock is deducted
            then.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-border p-4 md:p-6">
              <span className={`badge ${saleStatusBadge(sale.status)}`}>
                {saleStatusLabel(sale.status, sale.schedule_kind)}
              </span>
              <div className="mt-4">
                <DispatchScheduleSummary sale={sale} hideCommercial />
              </div>
            </div>

            {sale.status === 'instructed' && (
              <div className="rounded-xl border border-border p-4 md:p-6">
                <h2 className="mb-3 font-display text-lg">Allocate lots and generate COA</h2>
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Tally invoice #</span>
                    <input
                      className="input-field"
                      required
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Number of drums</span>
                    <input
                      className="input-field"
                      required
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={drumCount}
                      onChange={(e) => setDrumCount(e.target.value)}
                    />
                  </label>
                </div>
                <DispatchSchedulePickLots
                  sale={sale}
                  lots={availableLots}
                  qtyByLot={qtyByLot}
                  onQtyChange={(lot, qty) =>
                    setQtyByLot((prev) => ({ ...prev, [lot]: qty }))
                  }
                  onConfirm={() => void confirmPick()}
                  saving={saving}
                  confirmLabel="Allocate lots and generate COA"
                />
              </div>
            )}

            {sale.status === 'coa_issued' && (
              <p className="text-sm text-muted">
                COA generated. The accountant records the vehicle to finish the invoice.
              </p>
            )}

            {sale.status === 'allocated' && (
              <p className="text-sm text-muted">
                Lots are allocated. The accountant records the vehicle, and generates the COA if it
                was not issued with the lots.
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
