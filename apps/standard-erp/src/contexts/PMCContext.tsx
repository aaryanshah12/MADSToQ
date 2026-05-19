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
import { setCachedAccessToken } from '@madstoq/core'
import { clearPmcCache } from '@madstoq/pmc-system/lib/cache'
import { pmcApi } from '@madstoq/pmc-system/api'
import { setPmcCache } from '@madstoq/pmc-system/lib/cache'
import {
  bootstrapPmc,
  migrateLocalStorageToSupabaseIfNeeded,
  reloadPmcCache,
} from '@madstoq/pmc-system/rpc'

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

  const reloadData = useCallback(async (skipMigrate = false) => {
    setDataError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (session?.access_token) setCachedAccessToken(session.access_token)
      if (!user) {
        clearPmcCache()
        setDataReady(true)
        refresh()
        return
      }
      const { store, isEmpty } = await bootstrapPmc()
      setPmcCache(store)
      const migrated = !skipMigrate && isEmpty ? await migrateLocalStorageToSupabaseIfNeeded(true) : false
      if (migrated) await reloadPmcCache()
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
      if (data.session?.access_token) setCachedAccessToken(data.session.access_token)
      setEmail(user?.email ?? null)
      if (user) await reloadData(true)
      else {
        clearPmcCache()
        setDataReady(true)
      }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (session?.access_token) setCachedAccessToken(session.access_token)
      setEmail(session?.user?.email ?? null)
      if (session?.user) await reloadData(event !== 'SIGNED_IN')
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
      if (data.session?.access_token) setCachedAccessToken(data.session.access_token)
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
