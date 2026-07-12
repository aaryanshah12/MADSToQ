import { InventoryFactoryProvider } from '@/contexts/InventoryFactoryContext'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <InventoryFactoryProvider>
      {children}
    </InventoryFactoryProvider>
  )
}
