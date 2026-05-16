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
    <div className="pmc-page max-w-3xl">
      <div>
        <Link href="/pmc/master" className="text-xs text-muted hover:text-primary">
          ← Master
        </Link>
        <h1 className="pmc-page-title mt-2">Raw materials</h1>
      </div>

      <form onSubmit={handleAdd} className="pmc-card flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
        <div className="flex-1 min-w-0 w-full sm:min-w-[140px]">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full pmc-focus"
            placeholder="e.g. ONT"
            required
          />
        </div>
        <div className="w-full sm:w-24">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Unit</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="input w-full pmc-focus"
          />
        </div>
        <button type="submit" className="btn btn-pmc w-full sm:w-auto justify-center">
          Add
        </button>
      </form>

      <ul className="pmc-card divide-y divide-border p-0 overflow-hidden">
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
