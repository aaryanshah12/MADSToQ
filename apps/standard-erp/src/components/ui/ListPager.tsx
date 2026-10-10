'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { LIST_PAGE_SIZE } from '@/lib/list-page'

type PageToken = number | 'gap'

/** 1 [2] 3 … 12, with the first and last page always visible. */
export function pagerItems(page: number, totalPages: number): PageToken[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : []
  const keep = new Set<number>([1, totalPages, page])
  if (page > 1) keep.add(page - 1)
  if (page < totalPages) keep.add(page + 1)
  if (page <= 3) {
    keep.add(2)
    keep.add(3)
  }
  if (page >= totalPages - 2) {
    keep.add(totalPages - 1)
    keep.add(totalPages - 2)
  }
  const pages = [...keep].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const items: PageToken[] = []
  for (let i = 0; i < pages.length; i++) {
    const n = pages[i]
    if (i > 0 && n - pages[i - 1] > 1) items.push('gap')
    items.push(n)
  }
  return items
}

export function ListPager({
  page,
  total,
  pageSize = LIST_PAGE_SIZE,
  onPage,
  disabled = false,
}: {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
  disabled?: boolean
}) {
  const totalPages = Math.max(0, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null
  const current = Math.min(Math.max(1, page), totalPages)
  const items = pagerItems(current, totalPages)

  return (
    <nav
      aria-label="Pagination"
      className="inline-flex items-center gap-0.5 rounded-2xl bg-panel px-2 py-1.5 shadow-[0_8px_28px_rgba(25,30,33,0.08)]"
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={disabled || current <= 1}
        onClick={() => onPage(current - 1)}
        className="flex h-8 w-8 items-center justify-center text-[#C5C8CE] transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={18} strokeWidth={2} />
      </button>
      {items.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-sm font-medium text-[#B0B4BC]" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={item === current ? 'page' : undefined}
            disabled={disabled || item === current}
            onClick={() => onPage(item)}
            className={
              item === current
                ? 'flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#2F80ED] px-1.5 text-sm font-medium text-white'
                : 'flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-sm font-medium text-[#B0B4BC] transition-colors hover:text-primary disabled:opacity-60'
            }
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={disabled || current >= totalPages}
        onClick={() => onPage(current + 1)}
        className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F3F5] text-[#C5C8CE] transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight size={18} strokeWidth={2} />
      </button>
    </nav>
  )
}
