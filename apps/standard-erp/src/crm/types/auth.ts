export type UserRole = 'admin' | 'sales' | 'accountant'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  sales: 'Sales',
  accountant: 'Accountant',
}

export interface AppUser {
  id: string
  name: string
  username: string
  /** Prototype-only plain password */
  password: string
  role: UserRole
  active: boolean
  /** Contact details for team directory */
  phone: string
  email: string
  /** Optional WhatsApp / alternate number */
  whatsapp: string
  createdAt: string
  updatedAt: string
}

export type AppUserInput = Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>

export type SessionUser = Pick<
  AppUser,
  'id' | 'name' | 'username' | 'role' | 'active'
>

export function normalizeAppUser(
  raw: Partial<AppUser> &
    Pick<AppUser, 'id' | 'name' | 'username' | 'password' | 'role'>,
): AppUser {
  const now = new Date().toISOString()
  return {
    id: raw.id,
    name: raw.name,
    username: raw.username,
    password: raw.password,
    role: raw.role,
    active: raw.active !== false,
    phone: raw.phone?.trim() || '',
    email: raw.email?.trim() || '',
    whatsapp: raw.whatsapp?.trim() || '',
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  }
}
