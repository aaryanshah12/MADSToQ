import type { Metadata } from 'next'
import Login from '@/app/personal/sales/login/page'

export const metadata: Metadata = {
  title: 'Sales demo',
  robots: { index: false, follow: false },
}

export default function SalesDemoPage() {
  return <Login />
}
