import type { Metadata } from 'next'
import Login from '@/app/inventory/login/page'

export const metadata: Metadata = {
  title: 'Inventory demo',
  robots: { index: false, follow: false },
}

export default function InventoryDemoPage() {
  return <Login />
}
