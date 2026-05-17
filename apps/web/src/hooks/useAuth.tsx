'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
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

  async function loadProfile() {
    try {
      const res = await fetch('/api/auth/profile', { headers: await getAuthHeaders() })
      const json = await res.json()
      if (!res.ok) {
        setProfile(null)
        return
      }
      if (json.profile) setProfile(json.profile as Profile)
    } catch (e) {
      console.error('Failed to load profile', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    authClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile()
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile()
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    setLoading(true)
    const { error } = await authClient.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      return { error: error.message }
    }
    return { error: null }
  }

  async function signOut() {
    setLoading(true)
    await authClient.auth.signOut()
    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
