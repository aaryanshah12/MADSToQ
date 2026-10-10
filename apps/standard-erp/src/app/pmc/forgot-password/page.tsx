'use client'

import { useEffect } from 'react'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

const THEME_KEY = 'theme'

export default function PMCForgotPasswordPage() {
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
            Reset password
          </div>
        </div>
        <div className="card p-6">
          <ForgotPasswordForm
            loginHref="/pmc"
            returnTo="/pmc"
            linkClass="hover:text-pmc"
            buttonClass="btn btn-pmc w-full justify-center min-h-[44px]"
            inputClass="input w-full pmc-focus"
          />
        </div>
      </div>
    </div>
  )
}
