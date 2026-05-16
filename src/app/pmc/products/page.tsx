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
    <div className="pmc-page max-w-4xl">
      <div>
        <h1 className="pmc-page-title">Products</h1>
        <p className="text-sm text-muted mt-1">
          Open a product to enter overhead, tons/kg, and yield per reference and view final RMC.
        </p>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted pmc-card">
          No products yet. Add products and raw materials in{' '}
          <Link href="/pmc/master" className="text-pmc hover:underline">
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
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pmc-card hover:border-pmc/40 transition-colors min-h-[44px]"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-primary">{p.name}</span>
                    {p.code && (
                      <span className="ml-2 text-xs text-muted font-mono">{p.code}</span>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {materialCount} raw material{materialCount !== 1 ? 's' : ''} · {refCount}{' '}
                      reference{refCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-pmc shrink-0">Pricing sheet →</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
