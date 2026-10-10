'use client'

import {
  SessionProvider,
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from 'next-auth/react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getAuthHeaders } from '@/lib/client/api-fetch'
import type { Profile } from '@/types'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/ui'

export type AuthUserLite = { id: string; email?: string | null }

type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error'

const TRANSIENT_PROFILE_STATUSES = new Set([500, 502, 503, 504])

function authErrorMessage(code: string) {
  if (code === 'Configuration' || code === 'CallbackRouteError') {
    return 'Could not reach the database. Wait a few seconds and try again.'
  }
  if (code === 'CredentialsSignin') {
    return 'Invalid email or password.'
  }
  return code
}

type AuthContextType = {
  user: AuthUserLite | null
  profile: Profile | null
  profileError: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function AuthStateProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle')
  const [resolvedProfileUserId, setResolvedProfileUserId] = useState<string | null>(null)
  const profileRequestId = useRef(0)

  const user: AuthUserLite | null =
    session?.user?.id != null ? { id: session.user.id, email: session.user.email } : null

  const userId = session?.user?.id ?? null

  const invalidateProfile = useCallback(() => {
    profileRequestId.current += 1
    setProfile(null)
    setProfileError(null)
    setProfileStatus('idle')
    setResolvedProfileUserId(null)
  }, [])

  const loadProfile = useCallback(async (currentUserId: string) => {
    const requestId = ++profileRequestId.current
    setProfileStatus('loading')
    setResolvedProfileUserId(null)
    setProfile(null)
    setProfileError(null)
    try {
      const maxAttempts = 3
      let lastError = 'Failed to load profile'
      let lastStatus = 503
      let loaded: Profile | null | undefined

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await fetch('/api/auth/profile', {
          headers: await getAuthHeaders(),
          credentials: 'same-origin',
        })
        const json = (await res.json().catch(() => ({}))) as { profile?: Profile; error?: string }
        if (profileRequestId.current !== requestId) return
        if (res.ok) {
          loaded = json.profile ?? null
          break
        }
        lastStatus = res.status
        lastError = json.error || `Failed to load profile (${res.status})`
        if (!TRANSIENT_PROFILE_STATUSES.has(res.status) || attempt === maxAttempts) break
        await new Promise((r) => setTimeout(r, 400 * attempt))
      }

      if (profileRequestId.current !== requestId) return
      if (loaded !== undefined) {
        setProfile(loaded)
        setProfileStatus('ready')
        return
      }
      setProfile(null)
      setProfileError(lastError)
      setProfileStatus(lastStatus === 400 ? 'ready' : 'error')
    } catch (e) {
      if (profileRequestId.current !== requestId) return
      console.error('Failed to load profile', e)
      setProfile(null)
      setProfileError('Failed to load profile')
      setProfileStatus('error')
    } finally {
      if (profileRequestId.current !== requestId) return
      setResolvedProfileUserId(currentUserId)
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'authenticated' && userId) {
      if (profileStatus === 'loading') return
      if (resolvedProfileUserId === userId && (profileStatus === 'ready' || profileStatus === 'error')) return
      void loadProfile(userId)
    } else {
      invalidateProfile()
    }
  }, [status, userId, resolvedProfileUserId, profileStatus, loadProfile, invalidateProfile])

  const loading =
    status === 'loading' ||
    (status === 'authenticated' &&
      !!userId &&
      (profileStatus === 'idle' || profileStatus === 'loading' || resolvedProfileUserId !== userId))

  const signIn = async (email: string, password: string) => {
    const res = await nextAuthSignIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    })
    if (res?.error) return { error: authErrorMessage(res.error) }
    invalidateProfile()
    return { error: null }
  }

  const signOut = async () => {
    await nextAuthSignOut({ redirect: false })
    invalidateProfile()
  }

  return (
    <AuthContext.Provider value={{ user, profile, profileError, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthStateProvider>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </AuthStateProvider>
    </SessionProvider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AppProviders')
  return ctx
}
