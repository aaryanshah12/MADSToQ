'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePMC } from '@/contexts/PMCContext'

export default function PMCLoginScreen() {
  const router = useRouter()
  const { signIn, loading, email } = usePMC()
  const [formEmail, setFormEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && email) {
    router.replace('/pmc/dashboard')
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await signIn(formEmail.trim(), password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.push('/pmc/dashboard')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-md bg-panel border border-border rounded-2xl p-8 shadow-lg">
        <p className="text-xs font-mono tracking-widest text-muted uppercase mb-2">MADSToQ</p>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-pmc)' }}>
          PMC Portal
        </h1>
        <p className="text-sm text-muted mb-8">
          Product pricing — references, raw materials &amp; RMC sheets
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
            <input
              type="email"
              required
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-layer text-primary text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-layer text-primary text-sm"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--color-pmc)' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
