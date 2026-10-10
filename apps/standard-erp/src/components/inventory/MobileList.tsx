'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import type { SmartFilterState } from '@/components/ui'
import { dateRangeLabel, datePresetRange, matchingDatePreset } from '@/components/inventory/DateRangeChip'

export function MobileTabs<K extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className,
  variant = 'underline',
}: {
  tabs: readonly { key: K; label: string; sublabel?: string }[]
  active: K
  onChange: (key: K) => void
  ariaLabel: string
  className?: string
  variant?: 'underline' | 'pill'
}) {
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`mobile-tabs mb-4 flex rounded-full bg-layer-sm p-1 ${className ?? ''}`}
      >
        {tabs.map((t) => {
          const on = t.key === active
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.key)}
              className={`min-h-10 min-w-0 flex-1 rounded-full px-3 text-center text-[13px] transition-colors ${
                on ? 'bg-panel font-medium text-primary shadow-sm' : 'text-muted'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`mobile-tabs flex border-b border-border px-1 [contain:inline-size] md:hidden ${
        className ?? '-mx-4 -mt-4 mb-4 bg-panel'
      }`}
    >
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center px-1 text-center border-b-2 transition-colors ${
              on ? 'border-text font-medium text-primary' : 'border-transparent text-muted'
            }`}
          >
            {t.sublabel ? (
              <span className="flex flex-col items-center gap-0.5 py-1">
                <span className="text-[13px] leading-none">{t.label}</span>
                <span className="text-[11px] font-normal leading-tight text-muted">{t.sublabel}</span>
              </span>
            ) : (
              <span className="whitespace-normal text-[12px] leading-tight">{t.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export type MobileSortKind = 'text' | 'number' | 'date'

export type MobileSortOption<C extends string> = { col: C; label: string; kind: MobileSortKind }

const DIR_LABEL: Record<MobileSortKind, { asc: string; desc: string }> = {
  text: { asc: 'A → Z', desc: 'Z → A' },
  number: { asc: 'Low → High', desc: 'High → Low' },
  date: { asc: 'Oldest first', desc: 'Newest first' },
}

const DATE_PRESETS = [
  { id: 'month', label: 'This month' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'fy', label: 'This FY' },
] as const

export function MobileSheet({
  title,
  onClose,
  footer,
  children,
}: {
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const html = document.documentElement
    const prev = { html: html.style.overflow, body: document.body.style.overflow }
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev.html
      document.body.style.overflow = prev.body
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex touch-none items-end overscroll-none bg-black/60 md:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[88dvh] w-full touch-auto flex-col overflow-hidden rounded-t-2xl bg-panel shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-medium text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex gap-2 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SheetSectionTitle({ title, onClear }: { title: string; onClear?: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{title}</p>
      {onClear ? (
        <button type="button" onClick={onClear} className="text-xs font-medium text-pmc">
          Clear
        </button>
      ) : null}
    </div>
  )
}

export function MobileListToolbar<T, C extends string>({
  filter,
  placeholder,
  dateFrom,
  dateTo,
  onDateChange,
  resultCount,
  noun,
  sortOptions,
  sortCol,
  sortDir,
  onSort,
}: {
  filter?: SmartFilterState<T>
  placeholder?: string
  dateFrom?: string
  dateTo?: string
  onDateChange?: (from: string, to: string) => void
  resultCount: number
  noun: { one: string; many: string }
  sortOptions: readonly MobileSortOption<C>[]
  sortCol: C
  sortDir: 'asc' | 'desc'
  onSort: (col: C) => void
}) {
  const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null)
  const hasDate = Boolean(onDateChange)
  const dateActive = Boolean(dateFrom || dateTo)
  const activeCount = (filter?.chips.length ?? 0) + (dateActive ? 1 : 0)
  const currentSort = sortOptions.find((o) => o.col === sortCol) ?? sortOptions[0]
  const dirLabels = DIR_LABEL[currentSort?.kind ?? 'text']
  const countText = `${resultCount} ${resultCount === 1 ? noun.one : noun.many}`
  const preset = matchingDatePreset(dateFrom ?? '', dateTo ?? '')

  function setFrom(nextFrom: string) {
    const to = dateTo ?? ''
    onDateChange?.(nextFrom, to && nextFrom && to < nextFrom ? nextFrom : to)
  }

  function setTo(nextTo: string) {
    const from = dateFrom ?? ''
    onDateChange?.(from && nextTo && from > nextTo ? nextTo : from, nextTo)
  }

  const iconBtn =
    'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-transparent bg-panel text-muted'

  const sortButton = (
    <button type="button" onClick={() => setSheet('sort')} aria-label="Sort" className={iconBtn}>
      <ArrowUpDown size={18} />
    </button>
  )
  const summary = `${countText}${currentSort ? ` · ${currentSort.label} ${dirLabels[sortDir]}` : ''}`

  return (
    <div className="space-y-2.5 pb-3 md:hidden">
      {!filter ? (
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 px-1 text-xs text-muted">{summary}</p>
          {sortButton}
        </div>
      ) : (
      <>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={filter.search}
            onChange={(e) => filter.setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            enterKeyHint="search"
            placeholder={placeholder}
            aria-label="Search"
            className="input-field h-11 w-full !border-transparent !pl-9 focus:!border-pmc"
          />
        </div>
        <button
          type="button"
          onClick={() => setSheet('filter')}
          aria-label={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
          className={`${iconBtn} ${activeCount ? 'border-pmc text-pmc' : ''}`}
        >
          <SlidersHorizontal size={18} />
          {activeCount ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pmc px-1 text-[11px] font-medium leading-none text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
        {sortButton}
      </div>

      {activeCount ? (
        <div className="scrollbar-none -mx-4 flex touch-pan-x gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 [contain:inline-size]">
          {dateActive ? (
            <button
              type="button"
              onClick={() => onDateChange?.('', '')}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-pmc bg-pmc/15 px-3 text-xs font-medium text-pmc"
            >
              {dateRangeLabel(dateFrom ?? '', dateTo ?? '')}
              <X size={12} strokeWidth={2.5} />
            </button>
          ) : null}
          {filter.chips.map((c) => (
            <button
              key={`${c.facetKey}:${c.value}`}
              type="button"
              onClick={() => filter.removeChip(c.facetKey, c.value)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-pmc bg-pmc/15 px-3 text-xs font-medium text-pmc"
            >
              {c.label}: {c.display}
              <X size={12} strokeWidth={2.5} />
            </button>
          ))}
        </div>
      ) : null}

      <p className="px-1 text-xs text-muted">{summary}</p>
      </>
      )}

      {sheet === 'filter' && filter ? (
        <MobileSheet
          title="Filters"
          onClose={() => setSheet(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={() => {
                  filter.clearAll()
                  onDateChange?.('', '')
                }}
              >
                Clear all
              </button>
              <button
                type="button"
                className="btn flex-1 border border-pmc bg-pmc text-white"
                onClick={() => setSheet(null)}
              >
                Show {countText}
              </button>
            </>
          }
        >
          <div className="space-y-6">
            {hasDate ? (
              <section>
                <SheetSectionTitle
                  title="Date"
                  onClear={dateActive ? () => onDateChange?.('', '') : undefined}
                />
                <div className="flex flex-wrap gap-2">
                  {DATE_PRESETS.map((p) => {
                    const on = preset === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          const r = datePresetRange(p.id)
                          onDateChange?.(r.from, r.to)
                        }}
                        className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm ${
                          on ? 'border-pmc bg-pmc/15 text-pmc' : 'border-border text-muted'
                        }`}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">From</span>
                    <input
                      type="date"
                      className="input-field h-11 w-full !px-2 text-sm"
                      value={dateFrom ?? ''}
                      max={dateTo || undefined}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">To</span>
                    <input
                      type="date"
                      className="input-field h-11 w-full !px-2 text-sm"
                      value={dateTo ?? ''}
                      min={dateFrom || undefined}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {filter.facetMenus.map((facet) => {
              const picked = filter.selected[facet.key] ?? []
              return (
                <section key={facet.key}>
                  <SheetSectionTitle
                    title={facet.label}
                    onClear={picked.length ? () => filter.clearFacet(facet.key) : undefined}
                  />
                  {facet.options.length === 0 ? (
                    <p className="text-sm text-muted">No options</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {facet.options.map((opt) => {
                        const on = picked.includes(opt.id)
                        return (
                          <li key={opt.id}>
                            <button
                              type="button"
                              onClick={() => filter.toggleFilter(facet.key, opt.id)}
                              aria-pressed={on}
                              className="flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-sm"
                            >
                              <span
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                  on ? 'border-pmc bg-pmc text-white' : 'border-border'
                                }`}
                              >
                                {on ? <Check size={13} strokeWidth={3} /> : null}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-primary">{opt.label}</span>
                              <span className="text-xs tabular-nums text-muted">{opt.count}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </MobileSheet>
      ) : null}

      {sheet === 'sort' ? (
        <MobileSheet
          title="Sort by"
          onClose={() => setSheet(null)}
          footer={
            <button
              type="button"
              className="btn flex-1 border border-pmc bg-pmc text-white"
              onClick={() => setSheet(null)}
            >
              Done
            </button>
          }
        >
          <ul className="divide-y divide-border rounded-xl border border-border">
            {sortOptions.map((o) => {
              const on = o.col === sortCol
              return (
                <li key={o.col}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!on) onSort(o.col)
                    }}
                    aria-pressed={on}
                    className="flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-sm"
                  >
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        on ? 'border-pmc' : 'border-border'
                      }`}
                    >
                      {on ? <span className="h-2.5 w-2.5 rounded-full bg-pmc" /> : null}
                    </span>
                    <span className={on ? 'font-medium text-primary' : 'text-primary'}>{o.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-muted">Order</p>
          <div className="grid grid-cols-2 gap-2">
            {(['asc', 'desc'] as const).map((d) => {
              const on = sortDir === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    if (!on) onSort(sortCol)
                  }}
                  aria-pressed={on}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border text-sm ${
                    on ? 'border-pmc bg-pmc/15 font-medium text-pmc' : 'border-border text-muted'
                  }`}
                >
                  {dirLabels[d]}
                </button>
              )
            })}
          </div>
        </MobileSheet>
      ) : null}
    </div>
  )
}

export function MobileCard({
  id,
  title,
  subtitle,
  aside,
  rows,
  footer,
  expanded,
  onToggleExpand,
  details,
}: {
  id?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  aside?: ReactNode
  rows?: readonly { label: string; value: ReactNode }[]
  footer?: ReactNode
  expanded?: boolean
  onToggleExpand?: () => void
  details?: ReactNode
}) {
  const heading = (
    <>
      {id ? <div className="mb-1 text-xs text-muted">{id}</div> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-primary">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {aside ? <div className="text-right">{aside}</div> : null}
          {onToggleExpand ? (
            <span
              className={`mt-0.5 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <ChevronDown size={20} />
            </span>
          ) : null}
        </div>
      </div>
    </>
  )

  return (
    <article className="mobile-card rounded-xl border p-4">
      {onToggleExpand ? (
        <button
          type="button"
          className="-m-1 w-[calc(100%+0.5rem)] rounded-lg p-1 text-left"
          aria-expanded={expanded}
          onClick={onToggleExpand}
        >
          {heading}
        </button>
      ) : (
        heading
      )}
      {rows && rows.length > 0 ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">{r.label}</dt>
              <dd className="min-w-0 text-right text-primary">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {expanded && details ? <div className="mt-3">{details}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </article>
  )
}
