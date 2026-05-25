'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { FlaskConical, Package } from 'lucide-react'
import PMCRawMaterialsPanel from '@/components/pmc/master/PMCRawMaterialsPanel'
import PMCMasterProductsPanel from '@/components/pmc/master/PMCMasterProductsPanel'

type Tab = 'raw-materials' | 'products'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'raw-materials', label: 'Raw materials', icon: FlaskConical },
  { key: 'products', label: 'Products', icon: Package },
]

function parseTab(value: string | null): Tab {
  return value === 'products' ? 'products' : 'raw-materials'
}

function PMCMasterContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get('tab')))

  useEffect(() => {
    setTab(parseTab(searchParams.get('tab')))
  }, [searchParams])

  function selectTab(key: Tab) {
    setTab(key)
    router.replace(`/pmc/master?tab=${key}`, { scroll: false })
  }

  return (
    <div className="pmc-page max-w-6xl">
      <div className="mb-6">
        <h1 className="pmc-page-title">Master</h1>
        <p className="text-sm text-muted mt-1">Setup raw materials and product bill of materials</p>
      </div>

      <div
        className="flex gap-1 mb-6"
        style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '4px' }}
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all min-h-[44px]',
              tab === key
                ? 'bg-pmc/15 text-pmc border border-pmc/30'
                : 'text-muted hover:text-primary hover:bg-layer-sm'
            )}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'raw-materials' && <PMCRawMaterialsPanel />}
      {tab === 'products' && <PMCMasterProductsPanel />}
    </div>
  )
}

export default function PMCMasterPage() {
  return (
    <Suspense
      fallback={
        <div className="pmc-page flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-pmc border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PMCMasterContent />
    </Suspense>
  )
}
