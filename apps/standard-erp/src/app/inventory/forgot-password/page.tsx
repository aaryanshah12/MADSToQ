'use client'

import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function InventoryForgotPasswordPage() {
  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-inputer/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-owner/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-inputer/10 border border-inputer/30 mb-4 text-3xl">
            ⚗️
          </div>
          <h1 className="font-display text-3xl font-bold tracking-widest uppercase" style={{ color: 'var(--color-text)' }}>
            Chem<span className="text-inputer">Factory</span>
          </h1>
          <p className="font-mono text-xs text-muted mt-2 tracking-widest">RESET PASSWORD</p>
        </div>

        <div className="card p-8 glow-border-inputer">
          <ForgotPasswordForm
            loginHref="/inventory/login"
            returnTo="/inventory/login"
            linkClass="hover:text-inputer"
            buttonClass="btn btn-inputer w-full justify-center"
            inputClass="input-field w-full"
          />
        </div>
      </div>
    </div>
  )
}
