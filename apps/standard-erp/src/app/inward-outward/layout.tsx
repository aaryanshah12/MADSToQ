import '../globals.css'
import InwardOutwardShell from './InwardOutwardShell'

export default function InwardOutwardRootLayout({ children }: { children: React.ReactNode }) {
  return <InwardOutwardShell>{children}</InwardOutwardShell>
}
