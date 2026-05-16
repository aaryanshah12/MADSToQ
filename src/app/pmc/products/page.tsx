'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'

export default function PMCProductsPage() {
  const { tick } = usePMCData()

  const products = useMemo(() => {
    void tick
    return pmcApi.listProducts()
  }, [tick])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Products</h1>
        <p className="text-sm text-muted mt-1">
          Open a product to enter overhead, tons/kg, and yield per reference and view final RMC.
        </p>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted bg-panel border border-border rounded-xl p-6">
          No products yet. Add products and raw materials in{' '}
          <Link href="/pmc/master" className="underline" style={{ color: 'var(--color-pmc)' }}>
            Master
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-3">
          {products.map((p) => {
            const materialCount = pmcApi.listProductMaterials(p.id).length
            const refCount = pmcApi.listReferences().length
            return (
              <li key={p.id}>
                <Link
                  href={`/pmc/products/${p.id}`}
                  className="flex items-center justify-between bg-panel border border-border rounded-xl px-5 py-4 hover:border-[var(--color-pmc)] transition-colors"
                >
                  <div>
                    <span className="font-semibold text-primary">{p.name}</span>
                    {p.code && (
                      <span className="ml-2 text-xs text-muted font-mono">{p.code}</span>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {materialCount} raw material{materialCount !== 1 ? 's' : ''} · {refCount}{' '}
                      reference{refCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-pmc)' }}>
                    Pricing sheet →
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
