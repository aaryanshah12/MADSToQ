'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { pmcApi } from '@/lib/pmc/api'

type PMCContextValue = {
  loading: boolean
  email: string | null
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refresh: () => void
  tick: number
}

const PMCContext = createContext<PMCContextValue | null>(null)

export function PMCProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    setEmail(email)
    return {}
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setEmail(null)
    router.push('/pmc')
  }, [router])

  const value = useMemo(
    () => ({ loading, email, signIn, signOut, refresh, tick }),
    [loading, email, signIn, signOut, refresh, tick]
  )

  return <PMCContext.Provider value={value}>{children}</PMCContext.Provider>
}

export function usePMC() {
  const ctx = useContext(PMCContext)
  if (!ctx) throw new Error('usePMC must be used within PMCProvider')
  return ctx
}

/** Re-read local store when tick changes */
export function usePMCData() {
  const { tick } = usePMC()
  return useMemo(() => ({ api: pmcApi, tick }), [tick])
}
