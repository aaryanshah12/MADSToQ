'use client'

import { ReactNode } from 'react'
import { X } from 'lucide-react'

type PmcSimpleModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Wider panel for tables (default: max-w-md) */
  wide?: boolean
}

export function PmcSimpleModal({ title, onClose, children, footer, wide }: PmcSimpleModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`pmc-card w-full max-h-[90vh] overflow-y-auto shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-primary hover:bg-layer-sm"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-4 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  )
}
