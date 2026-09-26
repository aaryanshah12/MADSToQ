import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CrmShell } from '@/crm/CrmShell'

export const metadata: Metadata = {
  title: 'CRM Portal | MADSToQ',
  description: 'Plotting schemes, leads, bookings, payments, and handover',
  robots: { index: false, follow: false },
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="crm-app min-h-screen bg-canvas" />}>
      <CrmShell>{children}</CrmShell>
    </Suspense>
  )
}
