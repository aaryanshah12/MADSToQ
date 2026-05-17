'use client'

import { usePathname } from 'next/navigation'
import IOLayout from '@/components/io/IOLayout'
import { IOFactoryProvider } from '@/contexts/IOFactoryContext'

export default function InwardOutwardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare =
    pathname === '/inward-outward' ||
    pathname === '/inward-outward/login'

  if (bare) {
    return <>{children}</>
  }

  return (
    <IOFactoryProvider>
      <IOLayout>{children}</IOLayout>
    </IOFactoryProvider>
  )
}
