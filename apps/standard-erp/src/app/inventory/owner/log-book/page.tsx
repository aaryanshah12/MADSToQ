'use client'

import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import QcInstrumentLogBook from '@/components/inventory/QcInstrumentLogBook'

export default function OwnerLogBookPage() {
  const { profile } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Lab log books"
          subtitle="Owner · view-only register of lab QC results by instrument"
          accent="owner"
        />
        </div>
        <QcInstrumentLogBook
          factoryId={factoryId}
          rmQcHref="/inventory/owner/rm-qc"
          sfgQcHref="/inventory/owner/fg-qc"
          accent="owner"
        />
      </div>
    </AppLayout>
  )
}
