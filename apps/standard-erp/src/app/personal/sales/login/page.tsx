'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setCachedAccessToken } from '@madstoq/core'
import { supabase } from '@/lib/supabase'
import { clearSalesReadCache } from '@madstoq/sales-system/api'
import { LogIn, Eye, EyeOff } from 'lucide-react'

const EMAIL_KEY = 'sales-last-email'

export default function SalesLoginPage() {
  const router = useRouter()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('sales-theme') as 'dark' | 'light' | null) ?? 'light'
    document.documentElement.dataset.theme = saved

    const lastEmail = localStorage.getItem(EMAIL_KEY)
    if (lastEmail) setEmail(lastEmail)

    setPassword('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    clearSalesReadCache()

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (data.session?.access_token) setCachedAccessToken(data.session.access_token)
    if (signInErr || !data.user) {
      setError(signInErr?.message ?? 'Sign-in failed')
      setLoading(false)
      return
    }

    localStorage.setItem(EMAIL_KEY, email)
    router.replace('/personal/sales/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="text-5xl mb-4">💼</div>
          <div className="font-display text-2xl font-bold text-primary tracking-wider uppercase">
            <span className="text-owner">Sales</span>
          </div>
          <div className="font-mono text-[11px] text-muted tracking-widest mt-1 uppercase">
            Leads · Quotation · PO · Expenses
          </div>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@madstoq.com"
                required
                autoComplete="username"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-2">Password</label>
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

            <button type="submit" disabled={loading} className="btn btn-owner w-full justify-center mt-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                : <><LogIn size={15}/> Sign In</>
              }
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted text-center">
              Access is granted manually. If you can&apos;t sign in, contact your admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
