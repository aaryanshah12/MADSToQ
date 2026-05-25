'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@madstoq/pmc-system/api'
import type { PMCProduct } from '@madstoq/pmc-system/types'
import { PmcRowActions } from '@/components/pmc/PmcRowActions'
import { ProductMaterialsViewModal } from '@/components/pmc/ProductMaterialsViewModal'

export default function PMCMasterProductsPanel() {
  const router = useRouter()
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewProduct, setViewProduct] = useState<PMCProduct | null>(null)

  const products = useMemo(() => {
    void tick
    return pmcApi.listProducts()
  }, [tick])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const p = await pmcApi.upsertProduct({ name, code: code || undefined })
      setName('')
      setCode('')
      refresh()
      router.push(`/pmc/master/products/${p.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save product.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(productId: string, productName: string) {
    if (!confirm(`Delete product "${productName}"? Pricing data for this product will be hidden.`)) return
    try {
      await pmcApi.deactivateProduct(productId)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete product.')
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted">Add products, then assign raw materials and quantities.</p>

      <form onSubmit={handleAdd} className="pmc-card flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
        <div className="flex-1 min-w-0 w-full sm:min-w-[140px]">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Product name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full pmc-focus"
            required
          />
        </div>
        <div className="w-full sm:w-32">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Code (optional)</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input w-full pmc-focus"
          />
        </div>
        <button type="submit" disabled={saving} className="btn btn-pmc w-full sm:w-auto justify-center">
          {saving ? 'Saving…' : 'Add product'}
        </button>
      </form>

      <ul className="grid gap-2">
        {products.map((p) => (
          <li key={p.id}>
            <div className="pmc-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-pmc-40">
              <Link href={`/pmc/products/${p.id}`} className="min-w-0 flex-1">
                <span className="font-medium">{p.name}</span>
                {p.code && <span className="text-xs text-muted font-mono ml-2">{p.code}</span>}
              </Link>
              <PmcRowActions
                onView={() => setViewProduct(p)}
                editHref={`/pmc/master/products/${p.id}`}
                onDelete={() => handleDelete(p.id, p.name)}
              />
            </div>
          </li>
        ))}
      </ul>

      <ProductMaterialsViewModal product={viewProduct} onClose={() => setViewProduct(null)} />
    </div>
  )
}
