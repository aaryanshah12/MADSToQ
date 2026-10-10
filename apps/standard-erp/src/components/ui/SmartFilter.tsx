'use client'

import {
  bindComboMenuPositionListeners,
  comboMenuStyle,
  computeComboMenuPosition,
} from '@/components/io/combo-menu-position'
import clsx from 'clsx'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { Accent } from './Spinner'

export type SmartFilterFacet<T> = {
  key: string
  /** Shown in bold on the chip, e.g. "Status" → "Status: Active". */
  label: string
  /** One or more values this row contributes to the facet. Empty values are skipped. */
  getValue: (row: T) => string | string[] | null | undefined
  formatValue?: (value: string) => string
  /** Optional fixed list (still counted from `rows`). Extra values in data are appended. */
  options?: { id: string; label: string }[]
}

export type SmartFilterChip = {
  facetKey: string
  label: string
  value: string
  display: string
}

export type UseSmartFilterOptions<T> = {
  getSearchText: (row: T) => Array<string | null | undefined>
  facets?: SmartFilterFacet<T>[]
  /** Pre-applied chips, e.g. `{ fy: ['FY2026-27'] }`. */
  initialSelected?: Record<string, string[]>
}

function normalizeValues(raw: string | string[] | null | undefined): string[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw]
  return list.map((v) => v.trim()).filter(Boolean)
}

function defaultFormat(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Client-side search + facet filter. Values of the same facet are OR'd;
 * different facets and the search query are AND'd.
 */
export function useSmartFilter<T>(rows: T[], options: UseSmartFilterOptions<T>) {
  const { getSearchText, facets = [], initialSelected } = options
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, string[]>>(
    () => initialSelected ?? {},
  )

  const facetMenus = useMemo(() => {
    return facets.map((facet) => {
      const counts = new Map<string, number>()
      for (const row of rows) {
        for (const value of normalizeValues(facet.getValue(row))) {
          counts.set(value, (counts.get(value) ?? 0) + 1)
        }
      }
      const seen = new Set<string>()
      const optionsList: { id: string; label: string; count: number }[] = []
      for (const opt of facet.options ?? []) {
        seen.add(opt.id)
        optionsList.push({
          id: opt.id,
          label: opt.label,
          count: counts.get(opt.id) ?? 0,
        })
      }
      const extras = [...counts.entries()]
        .filter(([id]) => !seen.has(id))
        .sort((a, b) => a[0].localeCompare(b[0]))
      for (const [id, count] of extras) {
        optionsList.push({
          id,
          label: facet.formatValue?.(id) ?? defaultFormat(id),
          count,
        })
      }
      return {
        key: facet.key,
        label: facet.label,
        formatValue: (v: string) =>
          optionsList.find((o) => o.id === v)?.label ??
          facet.formatValue?.(v) ??
          defaultFormat(v),
        options: optionsList,
      }
    })
  }, [rows, facets])

  const chips: SmartFilterChip[] = useMemo(() => {
    const out: SmartFilterChip[] = []
    for (const facet of facetMenus) {
      for (const value of selected[facet.key] ?? []) {
        out.push({
          facetKey: facet.key,
          label: facet.label,
          value,
          display: facet.formatValue(value),
        })
      }
    }
    return out
  }, [facetMenus, selected])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (q) {
        const hay = getSearchText(row)
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      for (const facet of facets) {
        const picked = selected[facet.key] ?? []
        if (picked.length === 0) continue
        const values = normalizeValues(facet.getValue(row))
        if (!picked.some((p) => values.includes(p))) return false
      }
      return true
    })
  }, [rows, search, selected, facets, getSearchText])

  function addFilter(facetKey: string, value: string) {
    setSelected((prev) => {
      const current = prev[facetKey] ?? []
      if (current.includes(value)) return prev
      return { ...prev, [facetKey]: [...current, value] }
    })
  }

  function removeChip(facetKey: string, value: string) {
    setSelected((prev) => {
      const next = (prev[facetKey] ?? []).filter((v) => v !== value)
      const copy = { ...prev }
      if (next.length === 0) delete copy[facetKey]
      else copy[facetKey] = next
      return copy
    })
  }

  function toggleFilter(facetKey: string, value: string) {
    setSelected((prev) => {
      const current = prev[facetKey] ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      const copy = { ...prev }
      if (next.length === 0) delete copy[facetKey]
      else copy[facetKey] = next
      return copy
    })
  }

  function clearFacet(facetKey: string) {
    setSelected((prev) => {
      const copy = { ...prev }
      delete copy[facetKey]
      return copy
    })
  }

  function clearAll() {
    setSelected({})
  }

  const isFiltering = search.trim().length > 0 || chips.length > 0

  return {
    search,
    setSearch,
    filtered,
    chips,
    addFilter,
    removeChip,
    toggleFilter,
    clearFacet,
    clearAll,
    isFiltering,
    facetMenus,
    selected,
  }
}

export type SmartFilterState<T> = ReturnType<typeof useSmartFilter<T>>

const FOCUS: Record<Accent, string> = {
  owner: 'owner-focus',
  chemist: 'chemist-focus',
  pmc: 'pmc-focus',
  inputer: '',
  muted: '',
}

const CHIP: Record<
  Accent,
  { idle: string; active: string; option: string; check: string; clear: string }
> = {
  owner: {
    idle: 'border-border bg-panel text-muted hover:border-owner/40 hover:text-owner',
    active: 'border-owner bg-owner/15 text-owner',
    option: 'bg-owner/10 text-primary',
    check: 'border-owner bg-owner text-white',
    clear: 'text-owner',
  },
  chemist: {
    idle: 'border-border bg-panel text-muted hover:border-chemist/40 hover:text-chemist',
    active: 'border-chemist bg-chemist/15 text-chemist',
    option: 'bg-chemist/10 text-primary',
    check: 'border-chemist bg-chemist text-white',
    clear: 'text-chemist',
  },
  pmc: {
    idle: 'border-border bg-panel text-muted hover:border-pmc/40 hover:text-pmc',
    active: 'border-pmc bg-pmc/15 text-pmc',
    option: 'bg-pmc/10 text-primary',
    check: 'border-pmc bg-pmc text-white',
    clear: 'text-pmc',
  },
  inputer: {
    idle: 'border-border bg-panel text-muted hover:border-inputer/40 hover:text-inputer',
    active: 'border-inputer bg-inputer/15 text-inputer',
    option: 'bg-inputer/10 text-primary',
    check: 'border-inputer bg-inputer text-white',
    clear: 'text-inputer',
  },
  muted: {
    idle: 'border-border bg-panel text-muted hover:bg-layer-sm hover:text-primary',
    active: 'border-border bg-highlight text-primary',
    option: 'bg-highlight/70 text-primary',
    check: 'border-text bg-text text-panel',
    clear: 'text-primary',
  },
}

type SmartFilterBarProps<T> = {
  filter: SmartFilterState<T>
  placeholder?: string
  /** Primary actions on the right of row 1 (Export, Add, …). */
  actions?: ReactNode
  /** Extra chips in the facet row (range pickers, custom filters). */
  chipExtras?: ReactNode
  accent?: Accent
  className?: string
}

/**
 * Row 1: search (left) + optional actions (right).
 * Row 2: one pill per filter category. Click to pick a value; the chip then
 * shows "Category: Value" with an X to clear.
 *
 * The value menu is portaled to `document.body` so table-panel overflow
 * cannot clip it.
 */
export function SmartFilterBar<T>({
  filter,
  placeholder = 'Search…',
  actions,
  chipExtras,
  accent = 'muted',
  className,
}: SmartFilterBarProps<T>) {
  const { search, setSearch, toggleFilter, clearFacet, clearAll, facetMenus, selected } =
    filter
  const theme = CHIP[accent]

  const [openKey, setOpenKey] = useState<string | null>(null)
  const [optionQuery, setOptionQuery] = useState('')
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<ReturnType<
    typeof computeComboMenuPosition
  > | null>(null)

  const rowRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const closeMenu = () => {
    setOpenKey(null)
    setOptionQuery('')
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!openKey) {
      setMenuPosition(null)
      return
    }
    return bindComboMenuPositionListeners(() => {
      const el = chipRefs.current[openKey]
      if (!el) return
      const rect = el.getBoundingClientRect()
      const width = 288
      const fake = new DOMRect(rect.left, rect.top, width, rect.height)
      setMenuPosition(
        computeComboMenuPosition(fake, { preferredHeight: 320, gap: 8, minHeight: 120 }),
      )
    })
  }, [openKey])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (rowRef.current?.contains(t) || menuRef.current?.contains(t)) return
      closeMenu()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }
    if (openKey) {
      document.addEventListener('mousedown', onDoc)
      document.addEventListener('keydown', onKey)
    }
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [openKey])

  const activeFacetCount = facetMenus.filter((f) => (selected[f.key] ?? []).length > 0).length
  const openFacet = facetMenus.find((f) => f.key === openKey)
  const openValues = openFacet ? (selected[openFacet.key] ?? []) : []

  const menu =
    mounted && openFacet && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-multiselectable
            aria-label={openFacet.label}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
            style={comboMenuStyle(menuPosition)}
          >
            <div className="flex shrink-0 items-center justify-between px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                {openFacet.label}
              </span>
              {openValues.length > 0 ? (
                <button
                  type="button"
                  onClick={() => clearFacet(openFacet.key)}
                  className={clsx('text-[11px] hover:underline', theme.clear)}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {openFacet.options.length > 6 ? (
              <div className="border-t border-border px-2 py-2">
                <input
                  className="input-field h-8 !px-3 text-xs"
                  placeholder={`Search ${openFacet.label.toLowerCase()}…`}
                  value={optionQuery}
                  onChange={(e) => setOptionQuery(e.target.value)}
                  autoFocus
                />
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-border p-1.5">
              {(() => {
                const visibleOptions = openFacet.options.filter((opt) =>
                  optionQuery.trim()
                    ? opt.label.toLowerCase().includes(optionQuery.trim().toLowerCase())
                    : true,
                )
                if (visibleOptions.length === 0) {
                  return (
                    <p className="px-3 py-6 text-center text-xs text-muted">
                      {openFacet.options.length === 0
                        ? `No ${openFacet.label.toLowerCase()} values yet`
                        : 'No matching values'}
                    </p>
                  )
                }
                return visibleOptions.map((opt) => {
                  const checked = openValues.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleFilter(openFacet.key, opt.id)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        checked ? theme.option : 'text-muted hover:bg-layer-sm hover:text-primary',
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          checked ? theme.check : 'border-border bg-surface',
                        )}
                      >
                        {checked ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      <span className="flex-1 truncate">{opt.label}</span>
                      <span className="font-mono text-[10px] text-muted">{opt.count}</span>
                    </button>
                  )
                })
              })()}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={clsx('bg-panel', className)}>
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              className={clsx(
                'input-field h-10 w-full !pl-10 !pr-10 text-sm',
                FOCUS[accent],
              )}
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search table"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:bg-layer-sm hover:text-primary"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>
          ) : null}
        </div>

        {facetMenus.length > 0 || chipExtras ? (
          <div ref={rowRef} className="flex flex-wrap items-center gap-2">
            {chipExtras}
            {facetMenus.map((facet) => {
              const values = selected[facet.key] ?? []
              const active = values.length > 0
              const open = openKey === facet.key
              return (
                <button
                  key={facet.key}
                  type="button"
                  ref={(el) => {
                    chipRefs.current[facet.key] = el
                  }}
                  onClick={() => {
                    setOpenKey((k) => (k === facet.key ? null : facet.key))
                    setOptionQuery('')
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  className={clsx(
                    'inline-flex h-8 max-w-[18rem] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium shadow-sm transition-colors',
                    active ? theme.active : theme.idle,
                    open && !active && 'border-border bg-layer-sm text-primary',
                  )}
                >
                  <span className="truncate">
                    {active
                      ? `${facet.label}: ${
                          values.length === 1
                            ? facet.formatValue(values[0]!)
                            : `${values.length} selected`
                        }`
                      : facet.label}
                  </span>
                  {active ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        clearFacet(facet.key)
                        if (openKey === facet.key) closeMenu()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          clearFacet(facet.key)
                        }
                      }}
                      className="rounded-full p-0.5 opacity-70 transition-opacity hover:bg-panel/80 hover:opacity-100"
                      aria-label={`Clear ${facet.label} filter`}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </span>
                  ) : null}
                  <ChevronDown
                    size={13}
                    className={clsx('shrink-0 opacity-70 transition-transform', open && 'rotate-180')}
                  />
                </button>
              )
            })}
            {activeFacetCount >= 2 ? (
              <button
                type="button"
                onClick={() => {
                  clearAll()
                  closeMenu()
                }}
                className={clsx('px-1 text-xs font-medium hover:underline', theme.clear)}
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {menu}
    </div>
  )
}
