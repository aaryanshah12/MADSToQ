'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'

/**
 * Recovers a render crash anywhere under /inventory. Wrapped in AppLayout so the
 * sidebar stays usable — otherwise the boundary replaces the page's own shell
 * and the user is stranded with no navigation.
 */
export default function InventoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Inventory render error:', error)
  }, [error])

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="card mx-auto max-w-lg p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <AlertTriangle size={24} />
          </div>
          <h1 className="font-display text-xl font-semibold text-primary">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This page failed to load. Your data is safe — retrying usually resolves it.
          </p>

          {error.message ? (
            <p className="mt-4 break-words rounded-lg border border-border bg-layer-sm px-3 py-2 font-mono text-xs text-muted">
              {error.message}
              {error.digest ? <span className="opacity-60"> · {error.digest}</span> : null}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="btn btn-owner gap-2">
              <RotateCcw size={15} />
              Try again
            </button>
            <Link href="/inventory" className="btn btn-ghost">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
