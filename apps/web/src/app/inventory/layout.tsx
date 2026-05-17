import { InventoryFactoryProvider } from '@/contexts/InventoryFactoryContext'

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <InventoryFactoryProvider>
      {children}
    </InventoryFactoryProvider>
  )
}
