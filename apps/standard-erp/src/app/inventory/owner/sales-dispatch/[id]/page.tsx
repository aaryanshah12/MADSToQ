'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/providers/ToastProvider'
import { useCallback, useEffect, useState } from 'react'
import { dispatchScheduleApi } from '@/lib/api'
import { type DispatchSchedule } from '@/components/inventory/DispatchScheduleShared'
import { SaleDetailFields } from '@/components/inventory/OwnerSaleDetailDialog'

export default function OwnerSalesDispatchDetailPage() {
  return (
    <Suspense fallback={null}>
      <OwnerSalesDispatchDetail />
    </Suspense>
  )
}

function OwnerSalesDispatchDetail() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const fromQuery = searchParams.get('from')
  const toast = useToast()
  const { loading: authLoading } = useAuth()
  const [sale, setSale] = useState<DispatchSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const fromDispatch = fromQuery === 'dispatch'
  const backHref = fromDispatch ? '/inventory/owner/dispatch-schedule' : '/inventory/owner/sales'
  const backLabel = fromDispatch ? '← Dispatch schedule' : '← Sales'

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

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <PageHeader
          title={sale?.sale_no || 'Sale'}
          subtitle={
            sale
              ? `${sale.customer_name || 'Customer'} · ${sale.product_name}`
              : 'Owner · commercial detail'
          }
          accent="owner"
          actions={
            <Link href={backHref} className="text-sm text-muted hover:text-foreground">
              {backLabel}
            </Link>
          }
        />

        {loading || !sale ? (
          <p className="mt-4 text-sm text-muted">{loading ? 'Loading…' : 'Not found'}</p>
        ) : (
          <div className="folder-panel mt-4 overflow-hidden" style={{ background: 'var(--color-panel)' }}>
            <SaleDetailFields sale={sale} />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
