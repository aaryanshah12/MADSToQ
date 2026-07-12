import '../globals.css'
import InwardOutwardShell from './InwardOutwardShell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function InwardOutwardRootLayout({ children }: { children: React.ReactNode }) {
  return <InwardOutwardShell>{children}</InwardOutwardShell>
}
