'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ChemistRequestRmRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/chemist/requests?new=1')
  }, [router])
  return null
}
