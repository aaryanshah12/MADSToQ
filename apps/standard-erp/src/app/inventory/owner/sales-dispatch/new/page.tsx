'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** New schedules are created on Dispatch schedule. */
export default function OwnerSalesDispatchNewRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/owner/dispatch-schedule')
  }, [router])
  return null
}
