'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export default function SalesResetPasswordPage() {
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
            New password
          </div>
        </div>
        <div className="card p-6">
          <ResetPasswordForm
            loginHref="/personal/sales/login"
            forgotHref="/personal/sales/forgot-password"
            fallbackReturnTo="/personal/sales/login"
            linkClass="text-owner"
            buttonClass="btn btn-owner w-full justify-center"
            inputClass="input w-full"
          />
          <Link href="/personal/sales/login" className="block text-center text-xs text-muted hover:text-owner mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
