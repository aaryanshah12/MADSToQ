'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewBuyRequestRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/warehouse/buy-requests?new=1')
  }, [router])
  return null
}
