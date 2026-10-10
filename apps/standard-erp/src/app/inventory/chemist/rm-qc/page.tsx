'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** RM QC moved to Lab Incharge. */
export default function ChemistRmQcRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/lab/rm-qc')
  }, [router])
  return null
}
