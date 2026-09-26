'use client'

import { RequireRole } from '@/crm/components/RequireRole'
import { SchemeSuccessPage } from '@/crm/pages/SchemeSuccessPage'

export default function Page() {
  return (
    <RequireRole roles={['admin']}>
      <SchemeSuccessPage />
    </RequireRole>
  )
}
