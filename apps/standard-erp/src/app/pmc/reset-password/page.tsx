'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

const THEME_KEY = 'theme'

export default function PMCResetPasswordPage() {
  useEffect(() => {
    const saved =
      (localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null) ??
      (localStorage.getItem('pmc-theme') as 'dark' | 'light' | null) ??
      'light'
    document.documentElement.dataset.theme = saved
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 grid-bg" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="text-5xl mb-4" aria-hidden>📊</div>
          <div className="font-display text-2xl font-bold text-primary tracking-wider uppercase text-center">
            <span className="text-pmc">PMC</span> Portal
          </div>
          <div className="font-mono text-[11px] text-muted tracking-widest mt-1 uppercase text-center">
            New password
          </div>
        </div>
        <div className="card p-6">
          <ResetPasswordForm
            loginHref="/pmc"
            forgotHref="/pmc/forgot-password"
            fallbackReturnTo="/pmc"
            linkClass="text-pmc"
            buttonClass="btn btn-pmc w-full justify-center min-h-[44px]"
            inputClass="input w-full pmc-focus"
          />
          <Link href="/pmc" className="block text-center text-xs text-muted hover:text-pmc mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}