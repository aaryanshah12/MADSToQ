'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePMCData } from '@/contexts/PMCContext'
import { PmcListSearch } from '@/components/pmc/PmcListSearch'
import { matchesPmcSearch } from '@/lib/pmc-search'

export default function PMCComparePage() {
  const { api: pmcApi, tick } = usePMCData()
  void tick
  const [productId, setProductId] = useState('')
  const [batchA, setBatchA] = useState('')
  const [batchB, setBatchB] = useState('')
  const [rowSearch, setRowSearch] = useState('')

  const products = useMemo(() => pmcApi.listProducts(), [tick])
  const batchesForProduct = useMemo(
    () => (productId ? pmcApi.listBatches(productId) : []),
    [productId, tick]
  )

  const comparison = useMemo(() => {
    if (!batchA || !batchB || batchA === batchB) return null
    return pmcApi.compareBatches(batchA, batchB)
  }, [batchA, batchB, tick, pmcApi])

  useEffect(() => {
    setRowSearch('')
  }, [batchA, batchB])

  const filteredRows = useMemo(() => {
    if (!comparison) return []
    return comparison.rows.filter((row) =>
      matchesPmcSearch(rowSearch, [
        row.key,
        row.a?.item_name,
        row.a?.item_type,
        row.a?.qty,
        row.a?.unit_price,
        row.b?.item_name,
        row.b?.item_type,
        row.b?.qty,
        row.b?.unit_price,
      ])
    )
  }, [comparison, rowSearch])

  return (
    <div className="pmc-page space-y-6">
      <div>
        <h1 className="pmc-page-title">Compare</h1>
        <p className="text-sm text-muted mt-1">Compare two batches for the same product.</p>
      </div>

      <div className="pmc-card grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">Product</label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value)
              setBatchA('')
              setBatchB('')
            }}
            className="input w-full pmc-focus"
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Batch A</label>
          <select value={batchA} onChange={(e) => setBatchA(e.target.value)} className="input w-full pmc-focus" disabled={!productId}>
            <option value="">Select batch</option>
            {batchesForProduct.map((b) => (
              <option key={b.id} value={b.id}>{b.batch_code} (₹{b.unit_price.toFixed(2)})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Batch B</label>
          <select value={batchB} onChange={(e) => setBatchB(e.target.value)} className="input w-full pmc-focus" disabled={!productId}>
            <option value="">Select batch</option>
            {batchesForProduct.filter((b) => b.id !== batchA).map((b) => (
              <option key={b.id} value={b.id}>{b.batch_code} (₹{b.unit_price.toFixed(2)})</option>
            ))}
          </select>
        </div>
      </div>

      {comparison && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="pmc-card">
              <h2 className="font-semibold font-mono">{comparison.batchA.batch_code}</h2>
              <p className="text-sm text-muted capitalize">Status: {comparison.batchA.status}</p>
              <p className="text-sm">Size: {comparison.batchA.batch_size}</p>
              <p className="text-lg font-semibold mt-2">₹{comparison.batchA.unit_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="pmc-card">
              <h2 className="font-semibold font-mono">{comparison.batchB.batch_code}</h2>
              <p className="text-sm text-muted capitalize">Status: {comparison.batchB.status}</p>
              <p className="text-sm">Size: {comparison.batchB.batch_size}</p>
              <p className="text-lg font-semibold mt-2">₹{comparison.batchB.unit_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <PmcListSearch
            value={rowSearch}
            onChange={setRowSearch}
            placeholder="Search line items…"
            className="mb-0"
          />

          <div className="pmc-card overflow-x-auto p-0">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th>Item</th>
                  <th colSpan={3}>{comparison.batchA.batch_code}</th>
                  <th colSpan={3}>{comparison.batchB.batch_code}</th>
                  <th>Δ price</th>
                </tr>
                <tr className="text-xs text-muted">
                  <th />
                  <th>Qty</th><th>Rate</th><th>Total</th>
                  <th>Qty</th><th>Rate</th><th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-muted">
                      {comparison.rows.length === 0
                        ? 'No line items to compare.'
                        : 'No line items match your search.'}
                    </td>
                  </tr>
                ) : (
                filteredRows.map((row) => {
                  const totalA = row.a?.line_total ?? 0
                  const totalB = row.b?.line_total ?? 0
                  const delta = totalB - totalA
                  return (
                    <tr key={row.key}>
                      <td className="font-medium">{row.a?.item_name ?? row.b?.item_name ?? row.key}</td>
                      <td>{row.a?.qty ?? '—'}</td>
                      <td>{row.a ? `₹${row.a.unit_price}` : '—'}</td>
                      <td>{row.a ? `₹${totalA.toFixed(2)}` : '—'}</td>
                      <td>{row.b?.qty ?? '—'}</td>
                      <td>{row.b ? `₹${row.b.unit_price}` : '—'}</td>
                      <td>{row.b ? `₹${totalB.toFixed(2)}` : '—'}</td>
                      <td className={delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-500' : ''}>
                        {row.a && row.b ? `₹${delta.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )
                })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {productId && batchA && batchB && batchA === batchB && (
        <p className="text-sm text-amber-500">Select two different batches.</p>
      )}
    </div>
  )
}
