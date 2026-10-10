'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import PageHeader from '@madstoq/ui/erp-page-header'
import { MobileTabs } from '@/components/inventory/MobileList'

const TABS = [
  { id: 'rm' as const, href: '/inventory/owner/rm-qc', label: 'RM QC Approve' },
  { id: 'sfg' as const, href: '/inventory/owner/fg-qc', label: 'SFG QC Approve' },
  { id: 'fg' as const, href: '/inventory/owner/fg-qc?kind=fg', label: 'FG QC Approve' },
]

export default function QcApproveShell({
  kind,
  children,
}: {
  kind: 'rm' | 'sfg' | 'fg'
  children: ReactNode
}) {
  const router = useRouter()
  return (
    <>
      <div className="mb-8 hidden lg:block">
      <PageHeader
        title="QC Approve"
        subtitle="Admin · review lab results, then approve or reject RM, SFG, and FG"
        accent="owner"
      />
      </div>
      <div>
        <MobileTabs
          ariaLabel="QC approve"
          active={kind}
          onChange={(next) => {
            const href = TABS.find((t) => t.id === next)?.href
            if (href) router.push(href)
          }}
          tabs={[
            { key: 'rm', label: 'Raw Material' },
            { key: 'sfg', label: 'Semi-Finished Goods' },
            { key: 'fg', label: 'Finished Goods' },
          ]}
        />
        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="QC approve">
          {TABS.map((item) => {
            const on = kind === item.id
            return (
              <Link
                key={item.id}
                href={item.href}
                role="tab"
                id={`qc-approve-tab-${item.id}`}
                aria-selected={on}
                aria-controls={`qc-approve-panel-${item.id}`}
                className={on ? 'folder-tab is-active' : 'folder-tab'}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
        </div>
        <section
          id={`qc-approve-panel-${kind}`}
          role="tabpanel"
          aria-labelledby={`qc-approve-tab-${kind}`}
          className="p-0 md:folder-panel md:p-6"
        >
          {children}
        </section>
      </div>
    </>
  )
}
