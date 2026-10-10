'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Duplicate list — schedules live on Dispatch schedule. */
export default function OwnerSalesDispatchBoardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/owner/dispatch-schedule')
  }, [router])
  return null
}
