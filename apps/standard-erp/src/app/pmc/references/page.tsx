'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PMCReferencesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/pmc/dashboard')
  }, [router])
  return <div className="pmc-page p-6 text-muted text-sm">Redirecting…</div>
}
