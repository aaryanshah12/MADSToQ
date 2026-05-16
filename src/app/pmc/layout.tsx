import PMCShell from './PMCShell'

export const metadata = {
  title: 'PMC Portal | MADSToQ',
  description: 'Product pricing — references, raw materials, and RMC sheets',
}

export default function PMCLayoutRoot({ children }: { children: React.ReactNode }) {
  return <PMCShell>{children}</PMCShell>
}
