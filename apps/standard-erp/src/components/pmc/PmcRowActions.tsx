'use client'

import Link from 'next/link'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import clsx from 'clsx'

const actionBtn =
  'inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg border border-border hover:bg-layer-sm transition-colors'

type PmcRowActionsProps = {
  viewHref?: string
  editHref?: string
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  deleteDisabled?: boolean
  className?: string
}

export function PmcRowActions({
  viewHref,
  editHref,
  onView,
  onEdit,
  onDelete,
  deleteDisabled,
  className,
}: PmcRowActionsProps) {
  const viewClass = clsx(actionBtn, 'text-muted hover:text-pmc')
  const editClass = clsx(actionBtn, 'text-muted hover:text-primary')
  const deleteClass = clsx(
    actionBtn,
    'text-muted hover:text-red-500 hover:border-red-300/60 hover:bg-red-500/5',
    deleteDisabled && 'opacity-40 pointer-events-none'
  )

  return (
    <div
      className={clsx('flex items-center gap-1 shrink-0', className)}
      onClick={(e) => e.stopPropagation()}
    >
      {(viewHref || onView) &&
        (viewHref ? (
          <Link href={viewHref} className={viewClass} title="View" aria-label="View">
            <Eye size={16} />
          </Link>
        ) : (
          <button type="button" onClick={onView} className={viewClass} title="View" aria-label="View">
            <Eye size={16} />
          </button>
        ))}

      {(editHref || onEdit) &&
        (editHref ? (
          <Link href={editHref} className={editClass} title="Edit" aria-label="Edit">
            <Pencil size={16} />
          </Link>
        ) : (
          <button type="button" onClick={onEdit} className={editClass} title="Edit" aria-label="Edit">
            <Pencil size={16} />
          </button>
        ))}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteDisabled}
          className={deleteClass}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}
