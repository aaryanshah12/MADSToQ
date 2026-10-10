import { AsyncLocalStorage } from 'async_hooks'

export type RequestUser = { id: string; email?: string | null }

const userStorage = new AsyncLocalStorage<RequestUser>()

export function runWithUser<T>(user: RequestUser, fn: () => Promise<T>): Promise<T> {
  return userStorage.run(user, fn)
}

export function getRequestUser(): RequestUser | null {
  return userStorage.getStore() ?? null
}

export function requireRequestUserId(): string {
  const id = getRequestUser()?.id
  if (!id) throw new Error('Not signed in')
  return id
}
