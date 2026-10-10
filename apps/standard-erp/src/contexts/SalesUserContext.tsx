'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'
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
  const { data: session, status } = useSession()
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [membership, setMembership] = useState<SalesUser | null>(null)
  const [org, setOrg] = useState<SalesOrg | null>(null)
  const [loading, setLoading] = useState(true)
  const inFlight = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setAuthUserId(null)
      setAuthEmail(null)
      setMembership(null)
      setOrg(null)
      setLoading(false)
      return
    }
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
  }, [status, session?.user?.id])

  useEffect(() => {
    if (status === 'loading') return
    void refresh()
  }, [status, session?.user?.id, refresh])

  useEffect(() => {
    if (loading) return
    if (
      pathname === '/personal/sales/login' ||
      pathname === '/personal/sales/forgot-password' ||
      pathname === '/personal/sales/reset-password'
    ) return
    if (!authUserId || !membership) {
      router.replace('/personal/sales/login')
    }
  }, [loading, authUserId, membership, pathname, router])

  const signOut = async () => {
    clearSalesReadCache()
    await nextAuthSignOut({ redirect: false })
    router.replace('/personal/sales/login')
  }

  return (
    <Ctx.Provider value={{ authUserId, authEmail, membership, org, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSalesUser = () => useContext(Ctx)
