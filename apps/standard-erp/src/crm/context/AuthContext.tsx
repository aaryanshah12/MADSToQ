import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppUser, AppUserInput, SessionUser } from '../types/auth'
import {
  loadSession,
  loadUsers,
  saveSession,
  saveUsers,
  toSessionUser,
} from '../lib/auth'
import { uid } from '../lib/schemes'

interface AuthContextValue {
  user: SessionUser | null
  users: AppUser[]
  login: (username: string, password: string) => SessionUser
  logout: () => void
  saveUser: (input: AppUserInput, id?: string) => AppUser
  deleteUser: (id: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    const loaded = loadUsers()
    setUsers(loaded)
    const session = loadSession()
    if (!session) return
    const match = loaded.find((u) => u.id === session.id && u.active)
    if (!match) {
      saveSession(null)
      return
    }
    setUser(toSessionUser(match))
  }, [])

  const persistUsers = useCallback((next: AppUser[]) => {
    setUsers(next)
    saveUsers(next)
  }, [])

  const login = useCallback(
    (username: string, password: string): SessionUser => {
      const match = users.find(
        (u) =>
          u.username.toLowerCase() === username.trim().toLowerCase() &&
          u.password === password &&
          u.active,
      )
      if (!match) throw new Error('Invalid username or password')
      const session = toSessionUser(match)
      setUser(session)
      saveSession(session)
      return session
    },
    [users],
  )

  const logout = useCallback(() => {
    setUser(null)
    saveSession(null)
  }, [])

  const saveUser = useCallback(
    (input: AppUserInput, id?: string): AppUser => {
      const now = new Date().toISOString()
      const existing = id ? users.find((u) => u.id === id) : undefined
      const username = input.username.trim().toLowerCase()
      if (!username) throw new Error('Username is required')
      if (!input.name.trim()) throw new Error('Name is required')
      if (!input.password.trim()) throw new Error('Password is required')

      const clash = users.find(
        (u) =>
          u.username.toLowerCase() === username && u.id !== existing?.id,
      )
      if (clash) throw new Error('Username already exists')

      const record: AppUser = {
        ...input,
        name: input.name.trim(),
        username,
        password: input.password,
        phone: input.phone?.trim() || '',
        email: input.email?.trim() || '',
        whatsapp: input.whatsapp?.trim() || '',
        id: existing?.id ?? uid(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }

      persistUsers(
        existing
          ? users.map((u) => (u.id === existing.id ? record : u))
          : [record, ...users],
      )

      // Keep session in sync if editing self
      if (user?.id === record.id) {
        const session = toSessionUser(record)
        if (!record.active) {
          setUser(null)
          saveSession(null)
        } else {
          setUser(session)
          saveSession(session)
        }
      }

      return record
    },
    [persistUsers, user?.id, users],
  )

  const deleteUser = useCallback(
    (id: string) => {
      if (user?.id === id) throw new Error('Cannot delete the signed-in user')
      persistUsers(users.filter((u) => u.id !== id))
    },
    [persistUsers, user?.id, users],
  )

  const value = useMemo(
    () => ({
      user,
      users,
      login,
      logout,
      saveUser,
      deleteUser,
    }),
    [user, users, login, logout, saveUser, deleteUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
