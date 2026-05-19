import '../../globals.css'
import PersonalSalesShell from './PersonalSalesShell'

export default function PersonalSalesRootLayout({ children }: { children: React.ReactNode }) {
  return <PersonalSalesShell>{children}</PersonalSalesShell>
}
