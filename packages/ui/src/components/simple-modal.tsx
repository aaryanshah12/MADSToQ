import clsx from 'clsx'
import { X } from 'lucide-react'
import { ReactNode, useEffect } from 'react'

interface SimpleModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  widthClass?: string
}

export default function SimpleModal({ open, title, subtitle, onClose, children, footer, widthClass = 'max-w-2xl' }: SimpleModalProps) {
  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={clsx(
          'bg-panel border border-border rounded-2xl shadow-2xl w-full mx-auto max-h-[calc(100vh-2.5rem)] overflow-y-auto',
          widthClass
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <div className="font-display text-xl text-primary">{title}</div>
            {subtitle && <div className="text-sm text-muted mt-1">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-layer text-muted hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {children}
        </div>

        {footer && (
          <div className="px-5 py-4 border-t border-border bg-layer-sm rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
