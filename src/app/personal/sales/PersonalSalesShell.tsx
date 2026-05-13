'use client'

import { usePathname } from 'next/navigation'
import { SalesUserProvider } from '@/contexts/SalesUserContext'
import SalesShell from '@/components/sales/SalesShell'

export default function PersonalSalesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Login page is full-bleed and doesn't require an active membership.
  const bare = pathname === '/personal/sales/login'

  if (bare) {
    return (
      <SalesUserProvider>
        {children}
      </SalesUserProvider>
    )
  }

  return (
    <SalesUserProvider>
      <SalesShell>{children}</SalesShell>
    </SalesUserProvider>
  )
}
