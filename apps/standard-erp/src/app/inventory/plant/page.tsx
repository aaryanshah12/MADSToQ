'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Plant supervisor folded into Chemist. */
export default function PlantRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/chemist')
  }, [router])
  return null
}
