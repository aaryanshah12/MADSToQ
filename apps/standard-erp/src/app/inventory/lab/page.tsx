'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { dashboardApi } from '@/lib/api'
import { BookOpen, ClipboardCheck, FlaskConical } from 'lucide-react'
import { SkeletonStatCards } from '@/components/ui'

export default function LabDashboardPage() {
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [pendingQc, setPendingQc] = useState(0)
  const [pendingFgQc, setPendingFgQc] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (authLoading || !factoryId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const res = await dashboardApi.counts(factoryId)
      setPendingQc(Number(res.lab_rm_pending ?? 0))
      setPendingFgQc(Number(res.lab_sfg_pending ?? 0))
      setLoading(false)
    }
    void load()
  }, [authLoading, factoryId])

  return (
    <AppLayout>
      <div className="w-full space-y-6 p-4 md:p-8">
        <PageHeader
          title="Lab"
          subtitle="Lab Incharge · RM and SFG QC"
          accent="chemist"
        />

        {loading ? (
          <SkeletonStatCards count={3} columnsClassName="grid-cols-1 sm:grid-cols-3" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/inventory/lab/rm-qc"
              className="card p-6 transition-colors hover:border-chemist/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <ClipboardCheck size={20} className="text-chemist" />
                <h2 className="font-display text-lg text-primary">RM QC</h2>
              </div>
              <p className="font-mono text-3xl text-chemist">{pendingQc}</p>
              <p className="mt-2 text-xs text-muted">Receipts waiting on lab entry</p>
            </Link>
            <Link
              href="/inventory/lab/fg-qc"
              className="card p-6 transition-colors hover:border-chemist/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <FlaskConical size={20} className="text-chemist" />
                <h2 className="font-display text-lg text-primary">SFG QC</h2>
              </div>
              <p className="font-mono text-3xl text-chemist">{pendingFgQc}</p>
              <p className="mt-2 text-xs text-muted">
                Completed batches sent for semi-finished check
              </p>
            </Link>
            <Link
              href="/inventory/lab/log-book"
              className="card p-6 transition-colors hover:border-chemist/40"
            >
              <div className="mb-2 flex items-center gap-3">
                <BookOpen size={20} className="text-chemist" />
                <h2 className="font-display text-lg text-primary">Log books</h2>
              </div>
              <p className="mt-2 text-sm text-muted">
                Chronological QC register by instrument
              </p>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
