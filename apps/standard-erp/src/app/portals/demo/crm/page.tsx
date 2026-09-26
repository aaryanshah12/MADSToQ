import type { Metadata } from 'next'
import CrmDemoLogin from './CrmDemoLogin'

export const metadata: Metadata = {
  title: 'CRM demo',
  robots: { index: false, follow: false },
}

export default function CrmDemoPage() {
  return <CrmDemoLogin />
}
