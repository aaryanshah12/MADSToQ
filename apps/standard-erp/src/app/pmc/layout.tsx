import PMCShell from './PMCShell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PMC Portal | MADSToQ',
  description: 'Product pricing — references, raw materials, and RMC sheets',
  robots: { index: false, follow: false },
}

export default function PMCLayoutRoot({ children }: { children: React.ReactNode }) {
  return <PMCShell>{children}</PMCShell>
}
