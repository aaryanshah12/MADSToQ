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
import { clearPmcCache } from '@/lib/pmc/cache'
import { pmcApi } from '@/lib/pmc/api'
import {
  assertPmcPortalAccess,
  migrateLocalStorageToSupabaseIfNeeded,
  reloadPmcCache,
} from '@/lib/pmc/supabaseDb'

type PMCContextValue = {
  loading: boolean
  dataReady: boolean
  dataError: string | null
  email: string | null
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refresh: () => void
  reloadData: () => Promise<void>
  tick: number
}

const PMCContext = createContext<PMCContextValue | null>(null)

export function PMCProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const reloadData = useCallback(async () => {
    setDataError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        clearPmcCache()
        setDataReady(true)
        refresh()
        return
      }
      await assertPmcPortalAccess()
      await migrateLocalStorageToSupabaseIfNeeded()
      await reloadPmcCache()
      setDataReady(true)
      refresh()
    } catch (e) {
      setDataError(e instanceof Error ? e.message : 'Failed to load PMC data')
      setDataReady(true)
    }
  }, [refresh])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user
      setEmail(user?.email ?? null)
      if (user) await reloadData()
      else {
        clearPmcCache()
        setDataReady(true)
      }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setEmail(session?.user?.email ?? null)
      if (session?.user) await reloadData()
      else {
        clearPmcCache()
        setDataReady(true)
        refresh()
      }
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [reloadData, refresh])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      setEmail(email)
      setDataReady(false)
      await reloadData()
      return {}
    },
    [reloadData]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setEmail(null)
    clearPmcCache()
    setDataReady(false)
    router.push('/pmc')
  }, [router])

  const value = useMemo(
    () => ({
      loading,
      dataReady,
      dataError,
      email,
      signIn,
      signOut,
      refresh,
      reloadData,
      tick,
    }),
    [loading, dataReady, dataError, email, signIn, signOut, refresh, reloadData, tick]
  )

  return <PMCContext.Provider value={value}>{children}</PMCContext.Provider>
}

export function usePMC() {
  const ctx = useContext(PMCContext)
  if (!ctx) throw new Error('usePMC must be used within PMCProvider')
  return ctx
}

export function usePMCData() {
  const { tick } = usePMC()
  return useMemo(() => ({ api: pmcApi, tick }), [tick])
}
