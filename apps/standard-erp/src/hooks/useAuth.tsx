'use client'
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { setCachedAccessToken } from '@madstoq/core'
import { authClient } from '@/lib/auth-client'
import { getAuthHeaders } from '@/lib/client/api-fetch'
import { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const profileLoadRef = useRef<Promise<void> | null>(null)
  const profileUserIdRef = useRef<string | null>(null)

  async function loadProfile(userId: string, force = false) {
    if (!force && profileUserIdRef.current === userId && profile) {
      setLoading(false)
      return
    }
    if (profileLoadRef.current) return profileLoadRef.current
    profileLoadRef.current = (async () => {
      try {
        const res = await fetch('/api/auth/profile', { headers: await getAuthHeaders() })
        const json = await res.json()
        if (!res.ok) {
          setProfile(null)
          profileUserIdRef.current = null
          return
        }
        if (json.profile) {
          setProfile(json.profile as Profile)
          profileUserIdRef.current = userId
        }
      } catch (e) {
        console.error('Failed to load profile', e)
      } finally {
        setLoading(false)
        profileLoadRef.current = null
      }
    })()
    return profileLoadRef.current
  }

  useEffect(() => {
    authClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCachedAccessToken(session.access_token)
        setUser(session.user)
        void loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = authClient.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (session?.user) {
        setCachedAccessToken(session.access_token)
        setUser(session.user)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          void loadProfile(session.user.id, event === 'SIGNED_IN')
        }
      } else {
        setCachedAccessToken(null)
        setUser(null)
        setProfile(null)
        profileUserIdRef.current = null
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    setLoading(true)
    const { data, error } = await authClient.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      return { error: error.message }
    }
    if (data.session?.access_token) setCachedAccessToken(data.session.access_token)
    if (data.user) {
      setUser(data.user)
      await loadProfile(data.user.id, true)
    }
    return { error: null }
  }

  async function signOut() {
    setLoading(true)
    await authClient.auth.signOut()
    setCachedAccessToken(null)
    setUser(null)
    setProfile(null)
    profileUserIdRef.current = null
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
