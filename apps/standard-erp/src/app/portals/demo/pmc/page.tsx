import type { Metadata } from 'next'
import PmcDemoLogin from './PmcDemoLogin'

export const metadata: Metadata = {
  title: 'PMC demo',
  robots: { index: false, follow: false },
}

export default function PmcDemoPage() {
  return <PmcDemoLogin />
}
