'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error'

type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  dismiss: (id?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id?: number) => {
    setItems((prev) => (id == null ? [] : prev.filter((t) => t.id !== id)))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const text = message.trim()
    if (!text) return
    const id = ++toastId
    setItems((prev) => {
      // Keep one success toast; stack at most one error banner + one success
      const withoutSameKind = prev.filter((t) => t.kind !== kind)
      return [...withoutSameKind, { id, kind, message: text }]
    })
  }, [])

  const success = useCallback((message: string) => push('success', message), [push])
  const error = useCallback((message: string) => push('error', message), [push])

  const value = useMemo(
    () => ({ success, error, dismiss }),
    [success, error, dismiss],
  )

  const errors = items.filter((t) => t.kind === 'error')
  const successes = items.filter((t) => t.kind === 'success')

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Global error banners — top of viewport */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col gap-2 p-3 md:p-4">
        {errors.map((t) => (
          <ErrorBanner key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>

      {/* Global success toasts — bottom center */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 pb-6">
        {successes.map((t) => (
          <SuccessToast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function SuccessToast({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 2800)
    return () => window.clearTimeout(t)
  }, [item.id, onDismiss])

  return (
    <div
      role="status"
      className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-pmc/30 bg-panel px-4 py-2.5 text-sm font-medium text-pmc shadow-lg"
      style={{ animation: 'fadeUp 0.25s ease-out' }}
    >
      <CheckCircle size={16} className="shrink-0" />
      <span>{item.message}</span>
    </div>
  )
}

function ErrorBanner({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(t)
  }, [item.id, onDismiss])

  return (
    <div
      role="alert"
      className="pointer-events-auto mx-auto flex w-full max-w-3xl items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 shadow-lg backdrop-blur-sm dark:text-red-300"
      style={{ animation: 'fadeDown 0.25s ease-out' }}
    >
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 text-red-500/80 hover:text-red-600"
        onClick={onDismiss}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
