'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { productionApi } from '@/lib/api'

type Product = {
  id: string
  code: string
  name: string
  kind?: string
}

function ChemistNewBatchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const { profile, loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const factoryId = ctxFactoryId || profile?.factories?.[0]?.id || ''
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const kindParam = searchParams.get('kind')
  const [process, setProcess] = useState<'sfg' | 'fg'>(kindParam === 'fg' ? 'fg' : 'sfg')
  const [vessel, setVessel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (kindParam === 'fg' || kindParam === 'sfg') setProcess(kindParam)
  }, [kindParam])

  useEffect(() => {
    if (authLoading || !factoryId) return
    void (async () => {
      setLoading(true)
      const data = await productionApi.listProducts(factoryId, true)
      const list = (data.products ?? []) as Product[]
      setProducts(list)
      if (list.length === 1) setProductId(list[0].id)
      setLoading(false)
    })()
  }, [authLoading, factoryId])

  async function create() {
    if (!factoryId || !productId) {
      toast.error('Select a product')
      return
    }
    if (!vessel.trim()) {
      toast.error('Vessel is required')
      return
    }
    setSaving(true)
    const data = await productionApi.createBatch({
      factory_id: factoryId,
      product_id: productId,
      kind: process,
      vessel: vessel.trim(),
    })
    setSaving(false)
    if (data.error) {
      toast.error(data.error)
      return
    }
    toast.success('Batch created')
    try {
      localStorage.setItem(`chemist-batch-step:${data.batch.id}`, '2')
    } catch {
      /* ignore */
    }
    router.push(`/inventory/chemist/production/${data.batch.id}?step=2`)
  }

  return (
    <div className="mx-auto w-full max-w-lg p-4 md:p-8">
      <div className="mb-6 hidden lg:block">
      <PageHeader
        title="New batch"
        subtitle="Chemist · same product, pick Stage I or Stage II"
        accent="chemist"
      />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="table-panel mt-6 px-4 py-3 text-sm text-muted">
          No active production products for this factory. Ask the Owner to configure templates under
          Management → Production.
        </p>
      ) : (
        <div className="table-panel mt-6 space-y-4 p-5">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Product</span>
            <select
              className="input-field"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Process</span>
            <select
              className="input-field"
              value={process}
              onChange={(e) => setProcess(e.target.value === 'fg' ? 'fg' : 'sfg')}
            >
              <option value="sfg">Raw → semi-finished (Stage I)</option>
              <option value="fg">Semi-finished → finished (Stage II)</option>
            </select>
          </label>
          <p className="rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted">
            {process === 'fg'
              ? 'Finished-goods batch number is auto-generated as seq/prefix/FY from the numbering master.'
              : 'Semi-finished batch number is auto-generated as month/productCode/SF/seq/FY (e.g. Aug/CODE/SF/1/26-27).'}
          </p>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Vessel *</span>
            <input
              className="input-field"
              value={vessel}
              onChange={(e) => setVessel(e.target.value)}
              required
              placeholder="e.g. R-1"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="btn btn-chemist w-full disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ChemistNewBatchPage() {
  return (
    <AppLayout>
      <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
        <ChemistNewBatchForm />
      </Suspense>
    </AppLayout>
  )
}
