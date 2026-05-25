'use client'

import PortalManualView from '@/components/manual/PortalManualView'

export default function PMCManualPage() {
  return (
    <PortalManualView
      title="PMC Portal user manual"
      manualSrc="/docs/pmc-manual.html"
      backHref="/pmc/dashboard"
      backLabel="Back to PMC"
    />
  )
}
