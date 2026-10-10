'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { sanitizeReturnTo } from '@/lib/auth/password-reset-paths'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const returnTo = sanitizeReturnTo(params.get('returnTo'), '/inward-outward/login')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('io-theme') as 'dark' | 'light' | null) ?? 'light'
    document.documentElement.dataset.theme = saved
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (!token) {
      setError('Invalid reset link')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Reset failed')
      setDone(true)
      setTimeout(() => router.replace(returnTo), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-red-400">This reset link is invalid.</p>
        <Link href="/inward-outward/forgot-password" className="text-inputer hover:underline text-xs">
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-4 text-sm text-muted">
        <p className="text-inputer">Password updated. Redirecting to sign in…</p>
        <p className="text-xs">Sign in again with your username.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
          New password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            className="input w-full pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
          Confirm password
        </label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat password"
          required
          minLength={8}
          className="input w-full"
        />
      </div>
      {error && (
        <div className="text-xs text-red-400 rounded-lg px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className="btn btn-inputer w-full justify-center gap-2">
        {loading
          ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
          : <><KeyRound size={15} /> Set new password</>
        }
      </button>
    </form>
  )
}

export default function IOResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="text-5xl mb-4">📦</div>
          <div className="font-display text-xl font-bold text-primary tracking-wider uppercase">
            New password
          </div>
        </div>
        <div className="card p-6">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
          <Link href="/inward-outward/login" className="block text-center text-xs text-muted hover:text-inputer mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
