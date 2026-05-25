'use client'

import Link from 'next/link'

type PortalManualViewProps = {
  title: string
  manualSrc: string
  backHref: string
  backLabel?: string
}

export default function PortalManualView({
  title,
  manualSrc,
  backHref,
  backLabel = 'Back to portal',
}: PortalManualViewProps) {
  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto min-h-0 pb-8">
      <Link
        href={backHref}
        className="text-sm text-muted hover:text-primary w-fit"
      >
        ← {backLabel}
      </Link>
      <iframe
        title={title}
        src={manualSrc}
        className="w-full min-h-[calc(100vh-11rem)] rounded-xl border border-border"
        style={{ background: 'var(--color-panel)' }}
      />
    </div>
  )
}
