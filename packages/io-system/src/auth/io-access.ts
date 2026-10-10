import { getPrisma, getRequestUser } from '@madstoq/database'
import { AsyncLocalStorage } from 'node:async_hooks'

const prisma = getPrisma()

export type IoProfileRole =
  | 'owner'
  | 'inputer'
  | 'chemist'
  | 'accountant'
  | 'warehouse_manager'
  | 'lab_incharge'
  | 'plant_supervisor'
export type IoUserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'

export class IoAccessError extends Error {
  readonly status: number

  constructor(message: string, status = 403) {
    super(message)
    this.name = 'IoAccessError'
    this.status = status
  }
}

export type IoAccessContext = {
  userId: string
  profileRole: IoProfileRole
  userRole: IoUserRole | null
  factoryIds: string[]
}

const ioAccessStorage = new AsyncLocalStorage<IoAccessContext>()

export async function getAllowedFactoryIds(userId: string): Promise<string[]> {
  const rows = await prisma.profileFactory.findMany({
    where: { profileId: userId },
    select: { factoryId: true },
  })
  return rows.map((r) => r.factoryId).filter(Boolean)
}

async function loadIoAccessContext(): Promise<IoAccessContext> {
  const user = getRequestUser()
  if (!user?.id) throw new IoAccessError('Not signed in', 401)

  const [profile, dbUser] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, isActive: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    }),
  ])

  if (!profile?.isActive) {
    throw new IoAccessError('IO profile required. Link users.id to profiles.id and profile_factories.')
  }

  const factoryIds = await getAllowedFactoryIds(user.id)
  if (factoryIds.length === 0) {
    throw new IoAccessError('No factory access configured for this user')
  }

  return {
    userId: user.id,
    profileRole: profile.role as IoProfileRole,
    userRole: (dbUser?.role as IoUserRole | undefined) ?? null,
    factoryIds,
  }
}

/** Run IO RPC handlers with profile + factory access loaded once per request. */
export async function runWithIoAccess<T>(fn: () => Promise<T>): Promise<T> {
  const ctx = await loadIoAccessContext()
  return ioAccessStorage.run(ctx, fn)
}

export function getIoAccess(): IoAccessContext {
  const ctx = ioAccessStorage.getStore()
  if (!ctx) {
    throw new IoAccessError('IO access context missing', 500)
  }
  return ctx
}

export function assertFactoryAccess(factoryId: string | null | undefined): void {
  if (!factoryId) {
    throw new IoAccessError('Factory access denied')
  }
  const { factoryIds } = getIoAccess()
  if (!factoryIds.includes(factoryId)) {
    throw new IoAccessError('Factory access denied')
  }
}

/** Prisma `where` fragment: single factory or all allowed factories. */
export function factoryListWhere(factory_id?: string | null): { factoryId: string } | { factoryId: { in: string[] } } {
  const { factoryIds } = getIoAccess()
  if (factory_id) {
    if (!factoryIds.includes(factory_id)) {
      throw new IoAccessError('Factory access denied')
    }
    return { factoryId: factory_id }
  }
  return { factoryId: { in: factoryIds } }
}

export function assertDocumentFactoryAccess(factoryId: string | null | undefined): void {
  if (!factoryId) throw new IoAccessError('Document has no factory')
  assertFactoryAccess(factoryId)
}

function isElevatedUser(userRole: IoUserRole | null): boolean {
  return userRole === 'OWNER' || userRole === 'ADMIN'
}

export function assertCanWriteDocuments(): void {
  const { profileRole } = getIoAccess()
  if (profileRole === 'owner' || profileRole === 'inputer') return
  throw new IoAccessError('Read-only: cannot create or edit documents')
}

export function assertCanDeleteDocuments(): void {
  const { profileRole, userRole } = getIoAccess()
  if (profileRole === 'owner' || isElevatedUser(userRole)) return
  throw new IoAccessError('Only owners can delete documents')
}

export function assertCanManageMaster(): void {
  const { profileRole } = getIoAccess()
  if (profileRole === 'owner') return
  throw new IoAccessError('Only owners can change master data')
}
