'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PMCRawMaterialsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/pmc/master?tab=raw-materials')
  }, [router])
  return null
}
