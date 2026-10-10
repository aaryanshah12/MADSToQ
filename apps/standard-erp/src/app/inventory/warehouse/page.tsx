'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { dashboardApi } from '@/lib/api'
import { ClipboardList, Package, Send } from 'lucide-react'
import { SkeletonStatCards } from '@/components/ui'

export default function WarehouseDashboardPage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [openCount, setOpenCount] = useState(0)
  const [lotCount, setLotCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (authLoading || !factoryId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const res = await dashboardApi.counts(factoryId)
      setOpenCount(Number(res.warehouse_open_requests ?? 0))
      setLotCount(Number(res.warehouse_stock_lots ?? 0))
      setLoading(false)
    }
    void load()
  }, [authLoading, factoryId])

  return (
    <AppLayout>
      <div className="w-full space-y-6 p-4 md:p-8">
        <PageHeader
          title="Warehouse"
          subtitle="Maintain raw materials and semi-finished stock; release RM to plant"
          accent="accountant"
        />

        {loading ? (
          <SkeletonStatCards count={4} columnsClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/inventory/warehouse/stock"
              className="card p-6 transition-colors hover:border-pmc/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <Package size={20} className="text-pmc" />
                <h2 className="font-display text-lg text-primary">Stock lots</h2>
              </div>
              <p className="font-mono text-3xl text-pmc">{lotCount}</p>
              <p className="mt-2 text-xs text-muted">With remaining balance</p>
            </Link>
            <Link
              href="/inventory/warehouse/release"
              className="card p-6 transition-colors hover:border-pmc/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <Send size={20} className="text-pmc" />
                <h2 className="font-display text-lg text-primary">Release queue</h2>
              </div>
              <p className="font-mono text-3xl text-pmc">{openCount}</p>
              <p className="mt-2 text-xs text-muted">Pending chemist requests</p>
            </Link>
            <Link
              href="/inventory/warehouse/buy-requests"
              className="card p-6 transition-colors hover:border-pmc/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <ClipboardList size={20} className="text-pmc" />
                <h2 className="font-display text-lg text-primary">Buy requests</h2>
              </div>
              <p className="text-xs text-muted">Raise purchase needs for owner PO</p>
            </Link>
            <Link
              href="/inventory/warehouse/release?tab=history"
              className="card p-6 transition-colors hover:border-pmc/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <ClipboardList size={20} className="text-pmc" />
                <h2 className="font-display text-lg text-primary">Release history</h2>
              </div>
              <p className="text-xs text-muted">Past lots released to plant</p>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
