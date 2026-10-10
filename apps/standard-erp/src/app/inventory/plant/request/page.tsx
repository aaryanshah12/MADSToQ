'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlantRequestRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/chemist/request')
  }, [router])
  return null
}
