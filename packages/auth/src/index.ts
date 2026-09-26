/**
 * Browser session client. Login talks to /api/auth/login, which checks
 * passwords in Neon and sets an httpOnly cookie plus a bearer token.
 */
const TOKEN_KEY = 'madstoq.access_token'
const USER_KEY = 'madstoq.user'

export type SessionUser = { id: string; email?: string | null }

type Listener = (event: string, session: { access_token: string; user: SessionUser } | null) => void

const listeners = new Set<Listener>()

function readStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

function readSession() {
  if (typeof window === 'undefined') return null
  const access_token = localStorage.getItem(TOKEN_KEY)
  const user = readStoredUser()
  if (!access_token || !user) return null
  return { access_token, user }
}

function writeSession(session: { access_token: string; user: SessionUser } | null) {
  if (typeof window === 'undefined') return
  if (!session) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    return
  }
  localStorage.setItem(TOKEN_KEY, session.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

function emit(event: string, session: { access_token: string; user: SessionUser } | null) {
  listeners.forEach((listener) => listener(event, session))
}

export const authClient = {
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { data: { session: null, user: null }, error: { message: json.error || 'Sign-in failed' } }
      }
      const session = {
        access_token: json.access_token as string,
        user: json.user as SessionUser,
      }
      writeSession(session)
      emit('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    },
    async signOut() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        /* still clear the local session */
      }
      writeSession(null)
      emit('SIGNED_OUT', null)
      return { error: null }
    },
    async getSession() {
      return { data: { session: readSession() } }
    },
    onAuthStateChange(callback: Listener) {
      listeners.add(callback)
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback)
            },
          },
        },
      }
    },
  },
}

export function getAuthClient() {
  return authClient
}
