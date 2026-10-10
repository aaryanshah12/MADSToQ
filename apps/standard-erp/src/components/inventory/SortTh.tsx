'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

const ACTIVE: Record<'pmc' | 'owner' | 'chemist', string> = {
  pmc: 'text-pmc',
  owner: 'text-owner',
  chemist: 'text-chemist',
}

export function SortTh<C extends string>({
  label,
  col,
  sortCol,
  sortDir,
  onSort,
  accent = 'pmc',
}: {
  label: string
  col: C
  sortCol: C
  sortDir: 'asc' | 'desc'
  onSort: (col: C) => void
  accent?: 'pmc' | 'owner' | 'chemist'
}) {
  const active = sortCol === col
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
          active ? ACTIVE[accent] : 'text-muted hover:text-primary'
        }`}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ChevronsUpDown size={12} className="opacity-50" aria-hidden />
        )}
      </button>
    </th>
  )
}

export function nextSortDir<C extends string>(
  col: C,
  sortCol: C,
  sortDir: 'asc' | 'desc',
  defaultDesc: readonly C[] = [],
): { col: C; dir: 'asc' | 'desc' } {
  if (sortCol === col) return { col, dir: sortDir === 'asc' ? 'desc' : 'asc' }
  return { col, dir: defaultDesc.includes(col) ? 'desc' : 'asc' }
}

export function cmpStr(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' })
}

export function cmpNum(a: number | null | undefined, b: number | null | undefined) {
  return (Number(a) || 0) - (Number(b) || 0)
}
