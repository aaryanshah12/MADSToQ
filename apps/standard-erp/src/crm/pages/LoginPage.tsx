import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from '@/crm/router'
import { Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Field, Input } from '../components/ui/Form'
import DemoCredentials from '@/components/auth/DemoCredentials'
import { DEMO_PORTALS } from '@/lib/demo-portals'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    try {
      login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-ink">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl text-ink">PlotCRM</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign in to continue — bookings and payments are tagged to you.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm"
        >
          <Field label="Username" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <DemoCredentials accounts={DEMO_PORTALS.crm.accounts} tone="crm" />
      </div>
    </div>
  )
}
