'use client'
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { clearSalesReadCache, getCurrentSalesUser } from '@/lib/sales/api'
import type { SalesOrg, SalesUser } from '@/lib/sales/types'

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
        clearSalesReadCache()
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
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => sub.subscription.unsubscribe()
  }, [])

  // Bust client read cache on every interaction so lists stay fresh and stale cache cannot block UX.
  useEffect(() => {
    if (!pathname.startsWith('/personal/sales')) return
    const onPointerDown = () => clearSalesReadCache()
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [pathname])

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
