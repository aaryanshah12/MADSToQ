'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'

export default function IOForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('io-theme') as 'dark' | 'light' | null) ?? 'light'
    document.documentElement.dataset.theme = saved
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          returnTo: '/inward-outward/login',
        }),
      })
    } catch (err) {
      console.error('[forgot-password]', err)
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="text-5xl mb-4">📦</div>
          <div className="font-display text-xl font-bold text-primary tracking-wider uppercase">
            Reset password
          </div>
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="space-y-4 text-sm text-muted">
              <p>If an account exists for that email, we sent a reset link.</p>
              <p className="text-xs">Use the email registered on your account — not your username.</p>
              <Link href="/inward-outward/login" className="btn btn-inputer w-full justify-center inline-flex gap-2">
                <ArrowLeft size={15} /> Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-muted">
                Enter the email address registered on your account (not your username).
              </p>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="input w-full"
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-inputer w-full justify-center gap-2">
                {loading
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                  : <><Mail size={15} /> Send reset link</>
                }
              </button>
              <Link href="/inward-outward/login" className="block text-center text-xs text-muted hover:text-inputer">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
