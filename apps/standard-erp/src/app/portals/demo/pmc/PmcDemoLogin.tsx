'use client'

import PMCLoginScreen from '@/components/pmc/PMCLoginScreen'
import { PMCProvider } from '@/contexts/PMCContext'

export default function PmcDemoLogin() {
  return (
    <PMCProvider>
      <PMCLoginScreen />
    </PMCProvider>
  )
}
