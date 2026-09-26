import type { Metadata } from 'next'
import Login from '@/app/inward-outward/login/page'

export const metadata: Metadata = {
  title: 'Inward-Outward demo',
  robots: { index: false, follow: false },
}

export default function InwardOutwardDemoPage() {
  return <Login />
}
