export { getAdminDb, getAdminDb as getSupabaseAdmin, adminDb, adminDb as db, adminDb as supabaseAdmin, createDb } from './client'
export type { DbClient } from './client'
export { runWithDb, getServerDb, getAuthenticatedUser } from './db-context'
export type { AuthUser } from './db-context'
export { getBearerToken, requireAuthenticatedUser, withAuthenticatedDb } from './api-auth'
export { requireOwnerAccess } from './owner-access'
export { createRpcRoute } from './rpc'
export type { RpcHandler } from './rpc'
export {
  SESSION_COOKIE,
  signSession,
  readSession,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createAuthUser,
  deleteAuthUser,
  updateAuthPassword,
} from './session'
export type { SessionUser } from './session'
