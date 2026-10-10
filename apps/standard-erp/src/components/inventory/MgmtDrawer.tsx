'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function MgmtDrawer({
  title,
  subtitle,
  eyebrow,
  onClose,
  children,
  footer,
  size = 'md',
  mobileSheet: _mobileSheet = true,
  titleAside,
  padded = true,
  layer = 'base',
}: {
  title: string
  subtitle?: ReactNode
  titleAside?: ReactNode
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Ignored — mobile always opens as the bottom sheet used by View sale. */
  mobileSheet?: boolean
  padded?: boolean
  /** Nested drawers (e.g. Add Supplier on Create PO) sit above the parent sheet. */
  layer?: 'base' | 'nested'
}) {
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const maxW = size === 'lg' ? 'md:max-w-3xl' : size === 'sm' ? 'md:max-w-lg' : 'md:max-w-2xl'
  const z = layer === 'nested' ? 'z-[70]' : 'z-50'
  const node = (
    <div
      className={`fixed inset-0 ${z} flex bg-black/60 max-md:items-end max-md:overflow-hidden md:justify-end`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex w-full flex-col overflow-hidden shadow-2xl max-md:h-auto max-md:max-h-[88dvh] max-md:rounded-t-2xl md:h-full md:border-l md:border-border ${maxW}`}
        style={{ background: 'var(--color-panel)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs uppercase tracking-wider text-muted">{eyebrow}</p>
            ) : null}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id={titleId} className="text-base font-bold text-primary">
                {title}
              </h2>
              {titleAside}
            </div>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted hover:text-primary max-md:-m-2 max-md:p-3"
          >
            <X size={18} />
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain max-md:touch-pan-y max-md:overflow-x-hidden ${
            padded ? 'p-4 sm:p-6' : ''
          }`}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border px-4 py-4 sm:px-6 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:[&>*]:flex-1">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(node, document.body)
}
