'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WarehouseHistoryRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/warehouse/release?tab=history')
  }, [router])
  return null
}
