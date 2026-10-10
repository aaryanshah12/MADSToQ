'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@madstoq/pmc-system/api'

export default function PMCMasterProductsPage() {
  const router = useRouter()
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="pmc-page max-w-3xl">
      <div>
        <Link href="/pmc/master" className="text-xs text-muted hover:text-primary">
          ← Master
        </Link>
        <h1 className="pmc-page-title mt-2">Products</h1>
        <p className="text-sm text-muted">Add products, then assign raw materials and quantities.</p>
      </div>

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
            <Link
              href={`/pmc/master/products/${p.id}`}
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 pmc-card hover:border-pmc-40"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-pmc shrink-0">Edit recipe →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
