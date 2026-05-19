'use client'

import { usePathname } from 'next/navigation'
import { PMCProvider } from '@/contexts/PMCContext'
import PMCLayout from '@/components/pmc/PMCLayout'

export default function PMCShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = pathname === '/pmc' || pathname === '/pmc/login'

  return (
    <PMCProvider>
      {bare ? children : <PMCLayout>{children}</PMCLayout>}
    </PMCProvider>
  )
}
