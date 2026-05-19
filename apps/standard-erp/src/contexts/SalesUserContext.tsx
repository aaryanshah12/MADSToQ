'use client'
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setCachedAccessToken } from '@madstoq/core'
import { clearSalesReadCache, getCurrentSalesUser } from '@madstoq/sales-system/api'
import type { SalesOrg, SalesUser } from '@madstoq/sales-system/types'

interface SalesUserCtx {
  authUserId: string | null
  authEmail: string | null
  membership: SalesUser | null
  org: SalesOrg | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<SalesUserCtx>({
  authUserId: null,
  authEmail: null,
  membership: null,
  org: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
})

export function SalesUserProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [membership, setMembership] = useState<SalesUser | null>(null)
  const [org, setOrg] = useState<SalesOrg | null>(null)
  const [loading, setLoading] = useState(true)
  const inFlight = useRef<Promise<void> | null>(null)

  const refresh = async () => {
    if (inFlight.current) return inFlight.current
    setLoading(true)
    inFlight.current = (async () => {
      try {
        const { user, membership: m, org: o } = await getCurrentSalesUser()
        setAuthUserId(user.id || null)
        setAuthEmail(user.email)
        setMembership(m)
        setOrg(o)
      } finally {
        setLoading(false)
        inFlight.current = null
      }
    })()
    return inFlight.current
  }

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.access_token) setCachedAccessToken(session.access_token)
      if (session?.user) void refresh()
      else setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (session?.access_token) setCachedAccessToken(session.access_token)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') void refresh()
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // Redirect to login when not signed in or not provisioned.
  useEffect(() => {
    if (loading) return
    if (pathname === '/personal/sales/login') return
    if (!authUserId || !membership) {
      router.replace('/personal/sales/login')
    }
  }, [loading, authUserId, membership, pathname, router])

  const signOut = async () => {
    clearSalesReadCache()
    await supabase.auth.signOut()
    router.replace('/personal/sales/login')
  }

  return (
    <Ctx.Provider value={{ authUserId, authEmail, membership, org, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSalesUser = () => useContext(Ctx)
