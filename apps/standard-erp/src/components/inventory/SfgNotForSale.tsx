'use client'

import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'

/** SFG is warehouse stock only — sales/dispatch UI is not exposed for these lots. */
export default function SfgNotForSale({
  title = 'Dispatch schedule',
  accent = 'owner',
  homeHref = '/inventory/owner',
}: {
  title?: string
  accent?: 'owner' | 'accountant' | 'chemist'
  homeHref?: string
}) {
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
        <PageHeader
          title={title}
          subtitle="Not available for semi-finished goods"
          accent={accent}
        />
        <div className="rounded-xl border border-border bg-panel p-5 text-sm text-muted">
          <p>
            Semi-finished goods stay in warehouse stock after SFG QC. They are not sold or
            dispatched through this screen.
          </p>
          <Link href={homeHref} className="btn btn-ghost mt-4 inline-flex">
            Back
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
