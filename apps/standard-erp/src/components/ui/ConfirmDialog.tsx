'use client'

import clsx from 'clsx'
import { AlertTriangle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Accent } from './Spinner'

export type ConfirmOptions = {
  title: string
  /** Supporting detail. Say what will happen and to which record. */
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm action as destructive and shows a warning glyph. */
  destructive?: boolean
  /** Accent for the confirm button when not destructive. */
  accent?: Exclude<Accent, 'muted'>
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Promise-based replacement for the native `confirm()`. Resolves true when the
 * user accepts and false when they cancel, dismiss, or press Escape, so an
 * existing `if (!confirm(...)) return` guard keeps the same shape.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((next) => {
    // A second request while one is open cancels the first rather than
    // leaving its promise dangling forever.
    resolverRef.current?.(false)
    resolverRef.current = null
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setOptions(null)
    resolve?.(result)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? <ConfirmDialog options={options} onSettle={settle} /> : null}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions
  onSettle: (result: boolean) => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Lock background scroll and restore focus to whatever opened the dialog.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSettle(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSettle])

  const accentClass = options.destructive
    ? 'btn-danger'
    : `btn-${options.accent ?? 'inputer'}`

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 md:justify-end"
      onClick={() => onSettle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={options.body ? 'confirm-dialog-body' : undefined}
        className="flex w-full max-w-md flex-col rounded-t-2xl border-t border-border bg-panel shadow-2xl md:h-full md:max-w-lg md:rounded-none md:border-l md:border-t-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          {options.destructive ? (
            <span className="mt-0.5 shrink-0 text-red-500" aria-hidden="true">
              <AlertTriangle size={20} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-primary">
              {options.title}
            </h2>
            {options.body ? (
              <div id="confirm-dialog-body" className="mt-1.5 text-sm leading-relaxed text-muted">
                {options.body}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border bg-layer-sm px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-md:[&>*]:flex-1">
          <button type="button" className="btn btn-ghost" onClick={() => onSettle(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={clsx('btn', accentClass)}
            onClick={() => onSettle(true)}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
