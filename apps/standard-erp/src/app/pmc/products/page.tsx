'use client'

import PMCProductsPanel from '@/components/pmc/PMCProductsPanel'

export default function PMCProductsPage() {
  return (
    <div className="pmc-page">
      <h1 className="pmc-page-title">Products</h1>
      <p className="text-sm text-muted mt-1 mb-6">Product catalog and BOM. Unit price is calculated from current procurement prices.</p>
      <PMCProductsPanel />
    </div>
  )
}
