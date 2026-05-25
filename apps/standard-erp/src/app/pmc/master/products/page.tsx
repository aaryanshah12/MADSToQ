'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PMCMasterProductsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/pmc/master?tab=products')
  }, [router])
  return null
}
