'use client'

import clsx from 'clsx'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

export type EmptyStateProps = {
  title: string
  description?: string
  /** Defaults to an inbox glyph. Pass `null` to render no icon. */
  icon?: ReactNode
  /** Usually a button that starts the flow which would create the first record. */
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  const glyph = icon === undefined ? <Inbox size={28} strokeWidth={1.5} /> : icon

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      {glyph ? <div className="mb-1 text-muted opacity-50">{glyph}</div> : null}
      <div className="text-sm font-semibold text-primary">{title}</div>
      {description ? <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
