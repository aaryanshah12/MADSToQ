'use client'

import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import QcInstrumentLogBook from '@/components/inventory/QcInstrumentLogBook'

export default function LabLogBookPage() {
  const { profile } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Log books"
          subtitle="Lab · chronological register of QC results by instrument"
          accent="chemist"
        />
        </div>
        <QcInstrumentLogBook
          factoryId={factoryId}
          rmQcHref="/inventory/lab/rm-qc"
          sfgQcHref="/inventory/lab/fg-qc"
          accent="chemist"
        />
      </div>
    </AppLayout>
  )
}
