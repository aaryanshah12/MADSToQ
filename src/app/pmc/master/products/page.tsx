'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'

export default function PMCMasterProductsPage() {
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const products = useMemo(() => {
    void tick
    return pmcApi.listProducts()
  }, [tick])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const p = pmcApi.upsertProduct({ name, code: code || undefined })
    setName('')
    setCode('')
    refresh()
    window.location.href = `/pmc/master/products/${p.id}`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/pmc/master" className="text-xs text-muted hover:text-primary">
          ← Master
        </Link>
        <h1 className="text-2xl font-bold text-primary mt-2">Products</h1>
        <p className="text-sm text-muted">Add products, then assign raw materials and quantities.</p>
      </div>

      <form onSubmit={handleAdd} className="bg-panel border border-border rounded-xl p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-muted mb-1">Product name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-layer text-sm"
            required
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-muted mb-1">Code (optional)</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-layer text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-pmc)' }}
        >
          Add product
        </button>
      </form>

      <ul className="grid gap-2">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={`/pmc/master/products/${p.id}`}
              className="flex justify-between items-center bg-panel border border-border rounded-xl px-5 py-3 hover:border-[var(--color-pmc)]"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs" style={{ color: 'var(--color-pmc)' }}>
                Edit recipe →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
