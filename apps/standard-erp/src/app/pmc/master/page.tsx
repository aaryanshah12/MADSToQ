'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function MasterRedirect() {
  const router = useRouter()
  const search = useSearchParams()
  useEffect(() => {
    const tab = search.get('tab')
    if (tab === 'products') router.replace('/pmc/products')
    else router.replace('/pmc/procurement')
  }, [router, search])
  return <div className="pmc-page p-6 text-muted text-sm">Redirecting…</div>
}

export default function PMCMasterRedirect() {
  return (
    <Suspense fallback={<div className="pmc-page p-6 text-muted">Loading…</div>}>
      <MasterRedirect />
    </Suspense>
  )
}
