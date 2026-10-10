import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

/** Random-IV ciphertext prefix (semantic security). */
export const ENC_PREFIX = 'enc:v1:'
/** Deterministic ciphertext prefix (same plaintext → same ciphertext; for unique indexes). */
export const ENC_DETERMINISTIC_PREFIX = 'enc:v1d:'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

let cachedKey: Buffer | null | undefined

function parseKeyMaterial(raw: string): Buffer {
  const trimmed = raw.trim()
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, 'hex')
  const b64 = Buffer.from(trimmed, 'base64')
  if (b64.length === 32) return b64
  throw new Error(
    'FIELD_ENCRYPTION_KEY must be 32 bytes as base64 or 64 hex characters. Generate: openssl rand -base64 32'
  )
}

export function getFieldEncryptionKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey
  const raw = process.env.FIELD_ENCRYPTION_KEY?.trim()
  if (!raw) {
    cachedKey = null
    return null
  }
  cachedKey = parseKeyMaterial(raw)
  return cachedKey
}

export function isFieldEncryptionEnabled(): boolean {
  return getFieldEncryptionKey() !== null
}

function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX) || value.startsWith(ENC_DETERMINISTIC_PREFIX)
}

function seal(key: Buffer, iv: Buffer, plaintext: string, prefix: string): string {
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const blob = Buffer.concat([iv, tag, enc])
  return prefix + blob.toString('base64url')
}

function open(key: Buffer, packed: string, prefix: string): string {
  const raw = Buffer.from(packed, 'base64url')
  if (raw.length < IV_LEN + TAG_LEN + 1) throw new Error('Invalid encrypted field payload')
  const iv = raw.subarray(0, IV_LEN)
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const enc = raw.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

/** Encrypt a sensitive string (names, descriptions, PII). */
export function encryptField(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed === '') return value
  const key = getFieldEncryptionKey()
  if (!key) return value
  if (isEncrypted(value)) return value
  return seal(key, randomBytes(IV_LEN), value, ENC_PREFIX)
}

/**
 * Deterministic encryption for fields with unique constraints or equality lookups.
 * Same context + plaintext always yields the same ciphertext.
 */
export function encryptFieldDeterministic(
  value: string | null | undefined,
  context: string
): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (trimmed === '') return value
  const key = getFieldEncryptionKey()
  if (!key) return value
  if (isEncrypted(value)) return value
  const iv = createHmac('sha256', key).update(`d:${context}:`).update(value).digest().subarray(0, IV_LEN)
  return seal(key, iv, value, ENC_DETERMINISTIC_PREFIX)
}

/** Decrypt a field; returns legacy plaintext unchanged when encryption is off or value is not encrypted. */
export function decryptField(value: string | null | undefined): string | null {
  if (value == null) return null
  if (value === '') return value
  if (!isEncrypted(value)) return value
  const key = getFieldEncryptionKey()
  if (!key) return value
  try {
    if (value.startsWith(ENC_DETERMINISTIC_PREFIX)) {
      return open(key, value.slice(ENC_DETERMINISTIC_PREFIX.length), ENC_DETERMINISTIC_PREFIX)
    }
    return open(key, value.slice(ENC_PREFIX.length), ENC_PREFIX)
  } catch {
    return value
  }
}

/** Encrypt a monetary / numeric amount stored as text in the database. */
export function encryptMoney(amount: number | string | null | undefined): string | null {
  if (amount == null || amount === '') return null
  const n = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(n)) return null
  return encryptField(String(n))
}

/** Coerce API/form numeric money to text before Prisma (money columns are String). */
export function moneyStr(v: unknown): string {
  if (v == null || v === '') return '0'
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (trimmed === '') return '0'
    if (trimmed.startsWith(ENC_PREFIX) || trimmed.startsWith(ENC_DETERMINISTIC_PREFIX)) return trimmed
    return trimmed
  }
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    const n = Number((v as { toString(): string }).toString())
    return Number.isFinite(n) ? String(n) : '0'
  }
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : '0'
}

export function moneyStrOrNull(v: unknown): string | null {
  if (v == null || v === '') return null
  return moneyStr(v)
}

/** Strip NUL bytes Postgres rejects in text columns. */
export function textOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).replace(/\0/g, '')
  return s.trim() === '' ? null : s
}

/** Decrypt a monetary value from DB (encrypted string, legacy decimal string, or Prisma Decimal). */
export function decryptMoney(stored: unknown): number | null {
  if (stored == null) return null
  const asString =
    typeof stored === 'object' && stored !== null && 'toString' in stored
      ? (stored as { toString(): string }).toString()
      : String(stored)
  if (asString === '') return null
  const plain = decryptField(asString)
  if (plain == null || plain === '') return null
  const n = Number(plain)
  return Number.isFinite(n) ? n : null
}
