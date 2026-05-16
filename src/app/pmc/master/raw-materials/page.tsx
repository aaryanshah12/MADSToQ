'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePMC, usePMCData } from '@/contexts/PMCContext'
import { pmcApi } from '@/lib/pmc/api'

export default function PMCRawMaterialsPage() {
  const { refresh } = usePMC()
  const { tick } = usePMCData()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('Kg')

  const materials = useMemo(() => {
    void tick
    return pmcApi.listAllRawMaterials()
  }, [tick])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    pmcApi.upsertRawMaterial({ name, unit })
    setName('')
    setUnit('Kg')
    refresh()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/pmc/master" className="text-xs text-muted hover:text-primary">
          ← Master
        </Link>
        <h1 className="text-2xl font-bold text-primary mt-2">Raw materials</h1>
      </div>

      <form onSubmit={handleAdd} className="bg-panel border border-border rounded-xl p-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-muted mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-layer text-sm"
            placeholder="e.g. ONT"
            required
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-muted mb-1">Unit</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-layer text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-pmc)' }}
        >
          Add
        </button>
      </form>

      <ul className="bg-panel border border-border rounded-xl divide-y divide-border">
        {materials.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted">No raw materials yet.</li>
        ) : (
          materials.map((m) => (
            <li
              key={m.id}
              className={`px-5 py-3 flex justify-between items-center ${!m.is_active ? 'opacity-50' : ''}`}
            >
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-muted">{m.unit}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
