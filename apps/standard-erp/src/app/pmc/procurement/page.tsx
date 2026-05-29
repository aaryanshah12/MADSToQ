'use client'

import PMCProcurementPanel from '@/components/pmc/PMCProcurementPanel'

export default function PMCProcurementPage() {
  return (
    <div className="pmc-page">
      <h1 className="pmc-page-title">Procurement</h1>
      <p className="text-sm text-muted mt-1 mb-6">Services and raw materials used in product BOMs. Price changes do not affect past batches.</p>
      <PMCProcurementPanel />
    </div>
  )
}
