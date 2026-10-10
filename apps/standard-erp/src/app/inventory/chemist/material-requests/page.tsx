'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Buy material requests moved to Warehouse Manager. */
export default function ChemistMaterialRequestsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/warehouse/buy-requests')
  }, [router])
  return null
}
