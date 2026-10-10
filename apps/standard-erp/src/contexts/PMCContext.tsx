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
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react'
import { clearPmcCache } from '@madstoq/pmc-system'
import { pmcApi } from '@madstoq/pmc-system/api'
import {
  assertPmcPortalAccess,
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
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const email = session?.user?.email ?? null

  const reloadData = useCallback(async () => {
    setDataError(null)
    try {
      if (!session?.user?.id) {
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
  }, [refresh, session?.user?.id])

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'authenticated' && session?.user?.id) {
      setLoading(true)
      void reloadData().finally(() => setLoading(false))
    } else {
      clearPmcCache()
      setDataReady(true)
      setLoading(false)
    }
  }, [status, session?.user?.id, reloadData])

  const signIn = useCallback(async (emailIn: string, password: string) => {
    const res = await nextAuthSignIn('credentials', {
      email: emailIn.trim(),
      password,
      redirect: false,
    })
    if (res?.error) return { error: res.error }
    setDataReady(false)
    return {}
  }, [])

  const signOut = useCallback(async () => {
    await nextAuthSignOut({ redirect: false })
    setDataReady(false)
    clearPmcCache()
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
