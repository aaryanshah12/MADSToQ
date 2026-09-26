import type { Metadata } from 'next'
import { CrmShell } from '@/crm/CrmShell'

export const metadata: Metadata = {
  title: 'CRM Portal | MADSToQ',
  description: 'Plotting schemes, leads, bookings, payments, and handover',
  robots: { index: false, follow: false },
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>
}
