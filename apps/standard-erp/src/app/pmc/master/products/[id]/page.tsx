'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function PMCMasterProductRedirect() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  useEffect(() => {
    router.replace(`/pmc/products/${id}`)
  }, [router, id])
  return <div className="pmc-page p-6 text-muted text-sm">Redirecting…</div>
}
