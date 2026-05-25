'use client'

import AppLayout from '@/components/layout/AppLayout'
import PortalManualView from '@/components/manual/PortalManualView'
import { useAuth } from '@/hooks/useAuth'

export default function InventoryManualPage() {
  const { profile } = useAuth()

  const backHref =
    profile?.role === 'owner'
      ? '/inventory/owner'
      : profile?.role === 'inputer'
        ? '/inventory/inputer'
        : profile?.role === 'chemist'
          ? '/inventory/chemist'
          : '/inventory/login'

  return (
    <AppLayout>
      <PortalManualView
        title="Inventory Portal user manual"
        manualSrc="/docs/inventory-manual.html"
        backHref={backHref}
        backLabel="Back to Inventory"
      />
    </AppLayout>
  )
}
