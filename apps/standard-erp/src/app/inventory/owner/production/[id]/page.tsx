'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { OwnerProductionBatchDetail } from '@/components/inventory/OwnerProductionBatchDetail'

export default function OwnerProductionBatchPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <AppLayout>
      <div className="w-full p-4 md:p-6">
        <PageHeader
          title="Production batch"
          subtitle="Owner · view only"
          accent="owner"
          actions={
            <Link href="/inventory/owner/production" className="text-sm text-muted hover:text-foreground">
              ← All batches
            </Link>
          }
        />
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-[var(--color-panel)]">
          {id ? <OwnerProductionBatchDetail batchId={id} /> : null}
        </div>
      </div>
    </AppLayout>
  )
}
