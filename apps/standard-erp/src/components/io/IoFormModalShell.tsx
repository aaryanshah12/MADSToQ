'use client'

import { X, Save, Printer } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  show: boolean
  onClose: () => void
  title: string
  closeAriaLabel: string
  children: ReactNode
  formError?: string | null
  footer?: ReactNode
  savingAction?: 'save' | 'savePrint' | null
  editing?: boolean
  onSave?: () => void
  onSavePrint?: () => void
  savePrintLabel?: string
}

export default function IoFormModalShell({
  show,
  onClose,
  title,
  closeAriaLabel,
  children,
  formError,
  footer,
  savingAction = null,
  editing = false,
  onSave,
  onSavePrint,
  savePrintLabel,
}: Props) {
  if (!show) return null

  const isSaving = savingAction !== null

  const defaultFooter = (
    <div className="space-y-3">
      {formError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost min-h-0 h-10 justify-center rounded-lg px-4 text-sm sm:w-auto"
        >
          Cancel
        </button>
        {onSavePrint && (
          <button
            type="button"
            onClick={onSavePrint}
            disabled={isSaving}
            className="btn btn-ghost min-h-0 h-10 justify-center rounded-lg px-4 text-sm sm:w-auto"
          >
            {savingAction === 'savePrint' ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Printer size={14} />
            )}
            {savePrintLabel ?? (editing ? 'Update + Print' : 'Save + Print')}
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="btn btn-inputer col-span-2 min-h-0 h-11 justify-center rounded-lg px-4 text-sm sm:col-span-1 sm:w-auto"
          >
            {savingAction === 'save' ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save size={14} />
            )}
            {editing ? 'Update' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-none border-0 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-[28px] sm:border sm:border-border lg:max-w-6xl"
        style={{ background: 'var(--color-panel)' }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4"
          style={{ background: 'color-mix(in srgb, var(--color-panel) 96%, transparent)' }}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-primary">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-layer hover:text-primary"
            aria-label={closeAriaLabel}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>

        <div className="border-t border-border bg-panel px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] sm:px-6 sm:py-4">
          {footer ?? defaultFooter}
        </div>
      </div>
    </div>
  )
}
