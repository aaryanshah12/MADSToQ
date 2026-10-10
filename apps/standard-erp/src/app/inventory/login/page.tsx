'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Eye, EyeOff } from 'lucide-react'
import { Spinner } from '@/components/ui'

const EMAIL_KEY = 'inv-last-email'

export default function LoginPage() {
  const { signIn, profile, profileError, loading, user } = useAuth()
  const router = useRouter()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [signingIn, setSigningIn]       = useState(false)
  const [awaitingProfile, setAwaitingProfile] = useState(false)

  useEffect(() => {
    const lastEmail = localStorage.getItem(EMAIL_KEY)
    if (lastEmail) setEmail(lastEmail)
  }, [])

  // Wait until credentials succeed *and* the fresh profile fetch finishes.
  useEffect(() => {
    if (!awaitingProfile) return
    if (loading || !user) return
    if (profile) {
      if (profile.role === 'owner')              router.replace('/inventory/owner')
      if (profile.role === 'inputer')            router.replace('/inventory/inputer')
      if (profile.role === 'chemist')            router.replace('/inventory/chemist')
      if (profile.role === 'accountant')         router.replace('/inventory/accountant')
      if (profile.role === 'lab_incharge')       router.replace('/inventory/lab')
      if (profile.role === 'warehouse_manager')  router.replace('/inventory/warehouse')
      if (profile.role === 'plant_supervisor')   router.replace('/inventory/chemist')
      return
    }
    setError(
      profileError
        ? 'Could not load your inventory profile. Please try again.'
        : 'Signed in but could not load your inventory profile. Try again or contact support.',
    )
    setAwaitingProfile(false)
    setSigningIn(false)
  }, [awaitingProfile, profile, profileError, loading, user, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSigningIn(true)
    setAwaitingProfile(false)
    setError('')
    localStorage.removeItem('inv-factory-id')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setSigningIn(false)
    } else {
      localStorage.setItem(EMAIL_KEY, email)
      setAwaitingProfile(true)
    }
  }

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      {/* Background blobs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-inputer/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-owner/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-inputer/10 border border-inputer/30 mb-4 text-3xl">
            ⚗️
          </div>
          <h1 className="font-display text-3xl font-bold tracking-widest uppercase" style={{color: "var(--color-text)"}}>
            Chem<span className="text-inputer">Factory</span>
          </h1>
          <p className="font-mono text-xs text-muted mt-2 tracking-widest">STOCK MANAGEMENT PORTAL</p>
        </div>

        {/* Card */}
        <div className="card p-8 glow-border-inputer">
          <h2 className="font-display text-xl font-semibold mb-6 tracking-wide" style={{color: "var(--color-text)"}}>
            Sign In to Your Portal
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email-address" className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Email Address
              </label>
              <input id="email-address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@factory.com"
                required
                disabled={signingIn}
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  required
                  disabled={signingIn}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="btn btn-inputer w-full justify-center py-3 text-base"
            >
              {signingIn ? (
                <>
                  <Spinner size="sm" accent="inputer" label="Signing in" />
                  Signing In...
                </>
              ) : 'Sign In →'}
            </button>

            <p className="text-center text-xs text-muted">
              <Link href="/inventory/forgot-password" className="text-inputer hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted text-center">
              Software is managed by MADSToQ
            </p>
          </div>
        </div>

        {/* Role indicators */}
        <div className="flex justify-center gap-4 mt-6 flex-wrap">
          {[
            { label: 'Owner',      color: 'text-owner'   },
            { label: 'Inputer',    color: 'text-inputer' },
            { label: 'Chemist',    color: 'text-chemist' },
            { label: 'Lab',        color: 'text-chemist' },
            { label: 'Accountant', color: 'text-pmc'     },
            { label: 'Warehouse',  color: 'text-pmc'     },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full bg-current ${r.color}`} />
              <span className={`font-mono text-xs ${r.color} opacity-60`}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
