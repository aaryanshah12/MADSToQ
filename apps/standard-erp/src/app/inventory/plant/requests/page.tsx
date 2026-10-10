'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlantRequestsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/chemist/requests')
  }, [router])
  return null
}
