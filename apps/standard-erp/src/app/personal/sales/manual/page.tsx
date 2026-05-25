'use client'

import PortalManualView from '@/components/manual/PortalManualView'

export default function SalesManualPage() {
  return (
    <PortalManualView
      title="Personal Sales Portal user manual"
      manualSrc="/docs/sales-manual.html"
      backHref="/personal/sales/dashboard"
      backLabel="Back to Sales"
    />
  )
}
