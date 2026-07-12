import '../../globals.css'
import PersonalSalesShell from './PersonalSalesShell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PersonalSalesRootLayout({ children }: { children: React.ReactNode }) {
  return <PersonalSalesShell>{children}</PersonalSalesShell>
}
