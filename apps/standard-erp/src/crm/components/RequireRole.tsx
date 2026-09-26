import type { ReactNode } from 'react'
import { Navigate } from '@/crm/router'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/auth'

export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[]
  children: ReactNode
}) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/portals/demo/crm" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}
