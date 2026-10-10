'use client'

import type { ReactNode } from 'react'
import type { LedgerTab } from '@/lib/ledger-kind'
import { LEDGER_TABS } from '@/lib/ledger-kind'

export function LedgerKindTabs<T extends string = LedgerTab>(props: {
  tab: T
  onChange: (tab: T) => void
  children: ReactNode
  tabs?: Array<{ key: T; label: string }>
}) {
  const tabs = (props.tabs ?? (LEDGER_TABS as Array<{ key: T; label: string }>))
  return (
    <div>
      <div className="folder-tabs" role="tablist" aria-label="Stock kind">
        {tabs.map((t) => {
          const on = props.tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`ledger-tab-${t.key}`}
              aria-selected={on}
              aria-controls="ledger-kind-panel"
              onClick={() => props.onChange(t.key)}
              className={on ? 'folder-tab is-active' : 'folder-tab'}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <section
        id="ledger-kind-panel"
        role="tabpanel"
        aria-labelledby={`ledger-tab-${props.tab}`}
        className="folder-panel overflow-hidden"
      >
        {props.children}
      </section>
    </div>
  )
}
