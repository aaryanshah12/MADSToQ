import { Prisma } from './generated/client'
import {
  applyEncryptionToArgs,
  decryptModelResult,
  shouldDecryptResult,
} from './encrypted-fields'
import { isFieldEncryptionEnabled } from './field-crypto'

const READ_CACHE_TTL_MS = 30_000
const readCache = new Map<string, { exp: number; value: unknown }>()

function isCachedRead(model: string, operation: string) {
  return (
    (model === 'Profile' && operation === 'findUnique') ||
    (model === 'ProfileFactory' && (operation === 'findFirst' || operation === 'findMany'))
  )
}

/** Same person + factory is one cache entry, whatever `select` the caller asked for. */
function cacheKey(model: string, operation: string, args: unknown) {
  if (model === 'ProfileFactory' && args && typeof args === 'object') {
    const where = (args as { where?: Record<string, unknown> }).where
    if (where && typeof where === 'object') {
      const keys = Object.keys(where)
      if (
        operation === 'findFirst' &&
        keys.length === 2 &&
        typeof where.profileId === 'string' &&
        typeof where.factoryId === 'string'
      ) {
        return `ProfileFactory:findFirst:${where.profileId}:${where.factoryId}`
      }
      if (operation === 'findMany' && keys.length === 1 && typeof where.profileId === 'string') {
        return `ProfileFactory:findMany:${where.profileId}`
      }
    }
  }
  return `${model}:${operation}:${JSON.stringify(args)}`
}

function remember(key: string, value: unknown) {
  readCache.set(key, { exp: Date.now() + READ_CACHE_TTL_MS, value })
  if (readCache.size > 400) {
    const now = Date.now()
    for (const [entryKey, entry] of readCache) {
      if (entry.exp <= now) readCache.delete(entryKey)
    }
  }
}

export const fieldEncryptionExtension = Prisma.defineExtension({
  name: 'fieldEncryption',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const key = isCachedRead(model, operation) ? cacheKey(model, operation, args) : null
        if (key) {
          const hit = readCache.get(key)
          if (hit && hit.exp > Date.now()) return hit.value
        } else if (model === 'Profile' || model === 'ProfileFactory') {
          for (const entryKey of readCache.keys()) {
            if (entryKey.startsWith(`${model}:`)) readCache.delete(entryKey)
          }
        }

        if (!isFieldEncryptionEnabled()) {
          const result = await query(args)
          if (key) remember(key, result)
          return result
        }
        const encryptedArgs = applyEncryptionToArgs(
          model,
          operation,
          args as Record<string, unknown>
        )
        const result = await query(encryptedArgs)
        const value = shouldDecryptResult(operation) ? decryptModelResult(model, result) : result
        if (key) remember(key, value)
        return value
      },
    },
  },
})
