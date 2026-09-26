import type { ReactNode } from 'react'
import { Navigate } from '@/crm/router'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/portals/demo/crm" replace />
  return children
}
