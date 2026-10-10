'use client'

import type { ReactNode } from 'react'
import { LedgerKindTabs } from '@/components/inventory/LedgerKindTabs'

type ProductionKindTab = 'sfg' | 'fg'

const TABS: Array<{ key: ProductionKindTab; label: string }> = [
  { key: 'sfg', label: 'Semi-finished goods' },
  { key: 'fg', label: 'Finished goods' },
]

export function ProductionKindTabs({
  tab,
  onChange,
  children,
}: {
  tab: ProductionKindTab
  onChange: (tab: ProductionKindTab) => void
  children: ReactNode
}) {
  return (
    <LedgerKindTabs tab={tab} onChange={onChange} tabs={TABS}>
      {children}
    </LedgerKindTabs>
  )
}
