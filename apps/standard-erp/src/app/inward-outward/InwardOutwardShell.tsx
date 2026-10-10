'use client'

import { usePathname } from 'next/navigation'
import IOLayout from '@/components/io/IOLayout'
import { IOFactoryProvider } from '@/contexts/IOFactoryContext'
import { IoFeaturesProvider } from '@/contexts/IoFeaturesContext'

export default function InwardOutwardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare =
    pathname === '/inward-outward' ||
    pathname === '/inward-outward/login' ||
    pathname === '/inward-outward/forgot-password' ||
    pathname === '/inward-outward/reset-password'

  if (bare) {
    return <>{children}</>
  }

  return (
    <IoFeaturesProvider>
      <IOFactoryProvider>
        <IOLayout>{children}</IOLayout>
      </IOFactoryProvider>
    </IoFeaturesProvider>
  )
}
