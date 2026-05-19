'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setCachedAccessToken } from '@madstoq/core'
import { LogIn, Eye, EyeOff } from 'lucide-react'

const SESSION_KEY = 'io-last-activity'
const EMAIL_KEY   = 'io-last-email'

export default function IOLoginPage() {
  const router = useRouter()
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('io-theme') as 'dark' | 'light' | null) ?? 'light'
    document.documentElement.dataset.theme = saved

    const lastEmail = localStorage.getItem(EMAIL_KEY)
    if (lastEmail) setEmail(lastEmail)

    // Never carry a password across mounts (e.g. after logout).
    setPassword('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (data.session?.access_token) setCachedAccessToken(data.session.access_token)
      localStorage.setItem(EMAIL_KEY, email)
      localStorage.removeItem('io-factory-id')
      localStorage.setItem(SESSION_KEY, Date.now().toString())
      router.replace('/inward-outward/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="text-5xl mb-4">📦</div>
          <div className="font-display text-2xl font-bold text-primary tracking-wider uppercase">
            I/<span className="text-inputer">O</span> Portal
          </div>
          <div className="font-mono text-[11px] text-muted tracking-widest mt-1 uppercase">
            Inward · Outward · Invoicing
          </div>
        </div>

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="username"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  className="input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 rounded-lg px-3 py-2"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-inputer w-full justify-center mt-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                : <><LogIn size={15}/> Sign In</>
              }
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted text-center">
              Software is managed by MADSToQ
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
