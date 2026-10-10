'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { sanitizeReturnTo } from '@/lib/auth/password-reset-paths'

export function ResetPasswordForm({
  loginHref,
  forgotHref,
  fallbackReturnTo,
  linkClass,
  buttonClass,
  inputClass,
}: {
  loginHref: string
  forgotHref: string
  fallbackReturnTo: string
  linkClass: string
  buttonClass: string
  inputClass: string
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ResetPasswordFields
        loginHref={loginHref}
        forgotHref={forgotHref}
        fallbackReturnTo={fallbackReturnTo}
        linkClass={linkClass}
        buttonClass={buttonClass}
        inputClass={inputClass}
      />
    </Suspense>
  )
}

function ResetPasswordFields({
  forgotHref,
  fallbackReturnTo,
  linkClass,
  buttonClass,
  inputClass,
}: {
  loginHref: string
  forgotHref: string
  fallbackReturnTo: string
  linkClass: string
  buttonClass: string
  inputClass: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const returnTo = sanitizeReturnTo(params.get('returnTo'), fallbackReturnTo)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

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
        <Link href={forgotHref} className={`${linkClass} hover:underline text-xs`}>
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-4 text-sm text-muted">
        <p className={linkClass}>Password updated. Redirecting to sign in…</p>
        <p className="text-xs">Sign in again with your email.</p>
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
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            className={`${inputClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
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
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>
      {error && (
        <div
          className="text-xs text-red-400 rounded-lg px-3 py-2"
          style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} className={`${buttonClass} gap-2`}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <KeyRound size={15} /> Set new password
          </>
        )}
      </button>
    </form>
  )
}
