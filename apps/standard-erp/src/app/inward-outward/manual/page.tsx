'use client'

import PortalManualView from '@/components/manual/PortalManualView'

export default function InwardOutwardManualPage() {
  return (
    <PortalManualView
      title="Inward-Outward Portal user manual"
      manualSrc="/docs/io-manual.html"
      backHref="/inward-outward/dashboard"
      backLabel="Back to Inward-Outward"
    />
  )
}
