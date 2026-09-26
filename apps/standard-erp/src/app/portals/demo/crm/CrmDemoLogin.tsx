'use client'

import { LoginPage } from '@/crm/pages/LoginPage'
import { AuthProvider } from '@/crm/context/AuthContext'
import { ThemeProvider } from '@/crm/context/ThemeContext'

export default function CrmDemoLogin() {
  return (
    <div className="crm-app min-h-screen bg-canvas text-ink">
      <ThemeProvider>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </ThemeProvider>
    </div>
  )
}
