'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { usePMC } from '@/contexts/PMCContext'

const THEME_KEY = 'theme'

export default function PMCLoginScreen() {
  const router = useRouter()
  const { signIn, loading, email } = usePMC()
  const [formEmail, setFormEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const saved =
      (localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null) ??
      (localStorage.getItem('pmc-theme') as 'dark' | 'light' | null) ??
      'light'
    document.documentElement.dataset.theme = saved
    setPassword('')
  }, [])

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
      className="min-h-screen flex items-center justify-center px-4 grid-bg"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="text-5xl mb-4" aria-hidden>
            📊
          </div>
          <div className="font-display text-2xl font-bold text-primary tracking-wider uppercase text-center">
            <span className="text-pmc">PMC</span> Portal
          </div>
          <div className="font-mono text-[11px] text-muted tracking-widest mt-1 uppercase text-center">
            Product pricing · RMC sheets
          </div>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                className="input w-full pmc-focus"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="input w-full pr-10 pmc-focus"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && (
              <div
                className="text-xs text-red-400 rounded-lg px-3 py-2"
                style={{
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-pmc w-full justify-center mt-2 min-h-[44px]"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={15} /> Sign in
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted text-center">Software is managed by MADSToQ</p>
          </div>
        </div>
      </div>
    </div>
  )
}
