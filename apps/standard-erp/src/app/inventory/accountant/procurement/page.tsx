'use client'

import { ProcurementWorkbench } from '@/app/inventory/owner/procurement/page'

export default function AccountantProcurementPage() {
  return (
    <ProcurementWorkbench
      accent="accountant"
      listHref="/inventory/accountant/procurement"
    />
  )
}
