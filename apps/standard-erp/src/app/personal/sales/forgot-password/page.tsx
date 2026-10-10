'use client'

import { useEffect } from 'react'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function SalesForgotPasswordPage() {
  useEffect(() => {
    const saved = (localStorage.getItem('sales-theme') as 'dark' | 'light' | null) ?? 'light'
    document.documentElement.dataset.theme = saved
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="text-5xl mb-4">💼</div>
          <div className="font-display text-2xl font-bold text-primary tracking-wider uppercase">
            <span className="text-owner">Sales</span>
          </div>
          <div className="font-mono text-[11px] text-muted tracking-widest mt-1 uppercase">
            Reset password
          </div>
        </div>
        <div className="card p-6">
          <ForgotPasswordForm
            loginHref="/personal/sales/login"
            returnTo="/personal/sales/login"
            linkClass="hover:text-owner"
            buttonClass="btn btn-owner w-full justify-center"
            inputClass="input w-full"
          />
        </div>
      </div>
    </div>
  )
}
