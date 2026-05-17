'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'
import { formatINR } from '@/lib/pmc/pricing'

export default function PMCProductsPage() {
  const { tick } = usePMCData()

  const products = useMemo(() => {
    void tick
    return pmcApi.listProducts()
  }, [tick])

  const latestRef = useMemo(() => {
    void tick
    return pmcApi.getLatestReference()
  }, [tick])

  return (
    <div className="pmc-page max-w-4xl">
      <div>
        <h1 className="pmc-page-title">Products</h1>
        <p className="text-sm text-muted mt-1">
          Open a product for pricing per reference. Latest reference:{' '}
          {latestRef ? (
            <span className="font-mono text-pmc font-medium">{latestRef.ref_number}</span>
          ) : (
            'none yet'
          )}
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
            const latestRmc =
              latestRef && pmcApi.getPrimaryMaterial(p.id)
                ? pmcApi.calculatePricing(p.id, latestRef.id)
                : null

            return (
              <li key={p.id}>
                <Link
                  href={`/pmc/products/${p.id}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pmc-card hover:border-pmc-40 transition-colors min-h-[44px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-primary">{p.name}</span>
                      {p.code && (
                        <span className="text-xs text-muted font-mono">{p.code}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {materialCount} raw material{materialCount !== 1 ? 's' : ''} · {refCount}{' '}
                      reference{refCount !== 1 ? 's' : ''}
                    </p>
                    {latestRef && (
                      <p className="text-xs mt-2 flex flex-wrap items-center gap-2">
                        <span className="badge badge-pmc font-mono">{latestRef.ref_number}</span>
                        {latestRmc ? (
                          <span className="text-pmc font-semibold tabular-nums">
                            RMC {formatINR(latestRmc.final_rmc)}
                          </span>
                        ) : (
                          <span className="text-muted">RMC — set primary & params</span>
                        )}
                      </p>
                    )}
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
