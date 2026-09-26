import { browserStorage } from './storage'
import {
  normalizeAppUser,
  type AppUser,
  type SessionUser,
} from '../types/auth'
import { uid } from './schemes'

const USERS_KEY = 'plotcrm.users.v1'
const SESSION_KEY = 'plotcrm.session.v1'

function seedUsers(): AppUser[] {
  const now = new Date().toISOString()
  return [
    normalizeAppUser({
      id: uid(),
      name: 'Admin',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      active: true,
      phone: '9876500001',
      email: 'admin@plotcrm.local',
      whatsapp: '9876500001',
      createdAt: now,
      updatedAt: now,
    }),
    normalizeAppUser({
      id: uid(),
      name: 'Sales Person 1',
      username: 'sales1',
      password: 'sales123',
      role: 'sales',
      active: true,
      phone: '9876500002',
      email: 'sales1@plotcrm.local',
      whatsapp: '9876500002',
      createdAt: now,
      updatedAt: now,
    }),
    normalizeAppUser({
      id: uid(),
      name: 'Accountant 1',
      username: 'accounts1',
      password: 'accounts123',
      role: 'accountant',
      active: true,
      phone: '9876500003',
      email: 'accounts1@plotcrm.local',
      whatsapp: '9876500003',
      createdAt: now,
      updatedAt: now,
    }),
  ]
}

export function loadUsers(): AppUser[] {
  if (!browserStorage()) return []
  try {
    const raw = browserStorage()?.getItem(USERS_KEY)
    if (!raw) {
      const seeded = seedUsers()
      saveUsers(seeded)
      return seeded
    }
    const parsed = JSON.parse(raw) as Partial<AppUser>[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedUsers()
      saveUsers(seeded)
      return seeded
    }
    const users = parsed
      .filter(
        (u): u is Partial<AppUser> &
          Pick<AppUser, 'id' | 'name' | 'username' | 'password' | 'role'> =>
          Boolean(u?.id && u?.name && u?.username && u?.password && u?.role),
      )
      .map((u) => normalizeAppUser(u))
    saveUsers(users)
    return users
  } catch {
    const seeded = seedUsers()
    saveUsers(seeded)
    return seeded
  }
}

export function saveUsers(users: AppUser[]): void {
  browserStorage()?.setItem(USERS_KEY, JSON.stringify(users))
}

export function loadSession(): SessionUser | null {
  try {
    const raw = browserStorage()?.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUser
    if (!parsed?.id || !parsed?.username) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(user: SessionUser | null): void {
  if (!user) {
    browserStorage()?.removeItem(SESSION_KEY)
    return
  }
  browserStorage()?.setItem(SESSION_KEY, JSON.stringify(user))
}

export function toSessionUser(user: AppUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
  }
}
