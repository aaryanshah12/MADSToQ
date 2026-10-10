'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { dashboardApi } from '@/lib/api'
import { ClipboardList, FileText, Inbox } from 'lucide-react'
import { SkeletonStatCards } from '@/components/ui'

export default function AccountantDashboardPage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [pendingQc, setPendingQc] = useState(0)
  const [openPos, setOpenPos] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (authLoading || !factoryId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const res = await dashboardApi.counts(factoryId)
      setPendingQc(Number(res.accountant_pending_qc ?? 0))
      setOpenPos(Number(res.accountant_open_pos ?? 0))
      setLoading(false)
    }
    void load()
  }, [authLoading, factoryId])

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8 space-y-6">
        <PageHeader
          title="Accounts"
          subtitle="Create purchase orders, receive material, then QC happens next"
          accent="accountant"
        />

        {loading ? (
          <SkeletonStatCards count={3} columnsClassName="grid-cols-1 sm:grid-cols-3" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/inventory/accountant/procurement"
              className="card p-6 hover:border-pmc/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText size={20} className="text-pmc" />
                <h2 className="font-display text-lg text-primary">Purchase orders</h2>
              </div>
              <p className="text-sm text-muted mt-2">Create POs the same way as admin — vendor, terms, PDF, then email</p>
            </Link>
            <Link
              href="/inventory/accountant/receive"
              className="card p-6 hover:border-pmc/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <Inbox size={20} className="text-pmc" />
                <h2 className="font-display text-lg text-primary">Open POs to receive</h2>
              </div>
              <p className="font-mono text-3xl text-pmc">{openPos}</p>
              <p className="text-xs text-muted mt-2">Qty still left to record (before QC)</p>
            </Link>
            <Link
              href="/inventory/accountant/receipts"
              className="card p-6 hover:border-pmc/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <ClipboardList size={20} className="text-pmc" />
                <h2 className="font-display text-lg text-primary">Pending QC</h2>
              </div>
              <p className="font-mono text-3xl text-pmc">{pendingQc}</p>
              <p className="text-xs text-muted mt-2">Waiting for chemist approve / reject</p>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
