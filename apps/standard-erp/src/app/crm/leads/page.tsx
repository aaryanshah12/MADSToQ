'use client'

import { RequireRole } from '@/crm/components/RequireRole'
import { LeadsPage } from '@/crm/pages/LeadsPage'

export default function Page() {
  return (
    <RequireRole roles={['admin', 'sales']}>
      <LeadsPage />
    </RequireRole>
  )
}
