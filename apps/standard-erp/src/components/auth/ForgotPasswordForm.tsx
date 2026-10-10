'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'

export function ForgotPasswordForm({
  loginHref,
  returnTo,
  linkClass,
  buttonClass,
  inputClass,
}: {
  loginHref: string
  returnTo: string
  linkClass: string
  buttonClass: string
  inputClass: string
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, returnTo }),
      })
    } catch (err) {
      console.error('[forgot-password]', err)
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm text-muted">
        <p>If an account exists for that email, we sent a reset link.</p>
        <p className="text-xs">Use the email registered on your account.</p>
        <Link href={loginHref} className={`${buttonClass} inline-flex gap-2`}>
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-muted">
        Enter the email address registered on your account.
      </p>
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={loading} className={`${buttonClass} gap-2`}>
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Mail size={15} /> Send reset link
          </>
        )}
      </button>
      <Link href={loginHref} className={`block text-center text-xs text-muted ${linkClass}`}>
        Back to sign in
      </Link>
    </form>
  )
}
