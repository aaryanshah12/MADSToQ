'use client'

import clsx from 'clsx'

export type SkeletonProps = {
  className?: string
}

/** Neutral pulsing placeholder. Sized entirely by the caller. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={clsx('animate-pulse rounded bg-layer', className)} />
}

/** Stacked lines, for paragraph or label placeholders. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={clsx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/**
 * Placeholder grid matching the StatCard rows used on the dashboards.
 * `columnsClassName` replaces the default breakpoints so the placeholder can
 * mirror whatever grid the real cards use.
 */
export function SkeletonStatCards({
  count = 4,
  columnsClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  className,
}: {
  count?: number
  columnsClassName?: string
  className?: string
}) {
  return (
    <div className={clsx('grid gap-3 md:gap-4', columnsClassName, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="mb-3 h-8 w-8 rounded-lg" />
          <Skeleton className="mb-2 h-6 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

/**
 * Placeholder table rows. Renders bare `tr` elements, so it must be placed
 * inside a `tbody`. Cell padding is set here so the rows line up in tables
 * that style padding per cell rather than through the `.data-table` rules.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  cellClassName = 'px-4 py-3',
}: {
  columns: number
  rows?: number
  cellClassName?: string
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className={cellClassName}>
              <Skeleton className={clsx('h-4', c === 0 ? 'w-28' : 'w-16')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/**
 * Card-shaped placeholder for a panel or table that has not loaded yet, so the
 * page keeps its shape instead of collapsing to a line of text.
 */
export function SkeletonPanel({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('card overflow-hidden', className)}>
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Placeholder for the mobile card lists that mirror the desktop tables. */
export function CardListSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={clsx('data-card-list', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="data-card">
          <div className="data-card-header">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}
