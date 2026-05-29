'use client'

import { usePathname } from 'next/navigation'
import { PMCProvider } from '@/contexts/PMCContext'
import { PMCFactoryProvider } from '@/contexts/PMCFactoryContext'
import PMCLayout from '@/components/pmc/PMCLayout'

export default function PMCShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = pathname === '/pmc' || pathname === '/pmc/login'

  return (
    <PMCProvider>
      {bare ? (
        children
      ) : (
        <PMCFactoryProvider>
          <PMCLayout>{children}</PMCLayout>
        </PMCFactoryProvider>
      )}
    </PMCProvider>
  )
}
