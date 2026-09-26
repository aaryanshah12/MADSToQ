'use client'

import { RequireRole } from '@/crm/components/RequireRole'
import { SchemeWizardPage } from '@/crm/pages/SchemeWizardPage'

export default function Page() {
  return (
    <RequireRole roles={['admin']}>
      <SchemeWizardPage />
    </RequireRole>
  )
}
