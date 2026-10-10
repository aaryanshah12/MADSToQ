'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { TableSkeleton } from './Skeleton'

export type DataTableColumn = {
  /** Stable key for the header cell. */
  key: string
  label: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

export type DataTableShellProps = {
  columns: DataTableColumn[]
  /** Swaps the body for placeholder rows. */
  loading?: boolean
  /** Swaps the body for the empty state. Ignored while loading. */
  isEmpty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: ReactNode
  emptyAction?: ReactNode
  skeletonRows?: number
  /** Forces horizontal scroll rather than cramming columns on small screens. */
  minWidthClass?: string
  stickyHeader?: boolean
  className?: string
  /** The `tr` rows. Only rendered when not loading and not empty. */
  children?: ReactNode
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

/**
 * Wraps the shared `.data-table` styles and owns the three states every list
 * table repeats by hand: loading rows, the empty row, and the column span.
 */
export function DataTableShell({
  columns,
  loading = false,
  isEmpty = false,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  emptyAction,
  skeletonRows = 5,
  minWidthClass,
  stickyHeader = false,
  className,
  children,
}: DataTableShellProps) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className={clsx('data-table', minWidthClass)}>
        <thead className={stickyHeader ? 'sticky top-0 z-10 bg-panel' : undefined}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={clsx(col.align ? alignClass[col.align] : undefined, col.className)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeleton columns={columns.length} rows={skeletonRows} />
          ) : isEmpty ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  icon={emptyIcon}
                  action={emptyAction}
                />
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}
