import {
  decryptField,
  decryptMoney,
  ENC_DETERMINISTIC_PREFIX,
  ENC_PREFIX,
  encryptField,
  encryptFieldDeterministic,
  encryptMoney,
  isFieldEncryptionEnabled,
} from './field-crypto'

export type FieldKind = 'text' | 'text_deterministic' | 'money'

export type ModelFieldConfig = Record<string, FieldKind>

/** Prisma model name → sensitive columns to encrypt at rest. */
export const ENCRYPTED_MODEL_FIELDS: Record<string, ModelFieldConfig> = {
  // Platform / inventory ERP
  Client: { name: 'text' },
  User: { name: 'text', email: 'text' },
  InventoryItem: { name: 'text', description: 'text' },
  Factory: {
    name: 'text',
    location: 'text',
    companyAddress: 'text',
    panNumber: 'text',
    gstNumber: 'text',
    gstRange: 'text',
    gstDivision: 'text',
    commissionerate: 'text',
    email: 'text',
  },
  Profile: { fullName: 'text', email: 'text', phone: 'text' },
  StockEntry: {
    supplierName: 'text',
    materialType: 'text',
    ratePerTon: 'money',
    driverName: 'text',
    notes: 'text',
  },
  Employee: {
    fullName: 'text',
    fatherName: 'text',
    phone: 'text',
    email: 'text',
    currentAddress: 'text',
    permanentAddress: 'text',
    emergencyContactName: 'text',
    emergencyContactPhone: 'text',
    emergencyContactRelation: 'text',
    pan: 'text',
    aadhaar: 'text',
    uan: 'text',
    pfNumber: 'text',
    esiNumber: 'text',
    bankName: 'text',
    accountHolderName: 'text',
    accountNumber: 'text',
    ifsc: 'text',
    monthlyGross: 'money',
    annualCtc: 'money',
    basicPay: 'money',
  },
  EmployeeDocument: {
    title: 'text',
    fileName: 'text',
  },
  Supplier: {
    name: 'text_deterministic',
    companyAddress: 'text',
    gstNumber: 'text',
    email: 'text',
    contactName: 'text',
    contactPhone: 'text',
    telFaxNo: 'text',
    residenceNo: 'text',
    bankName: 'text',
    bankBranch: 'text',
    accountNo: 'text',
    ifscCode: 'text',
    micrCode: 'text',
    approverName: 'text',
  },
  FactoryInoutProduct: { name: 'text_deterministic' },
  InwardEntry: { productName: 'text' },
  OutwardEntry: { productName: 'text' },
  SalesEntry: { turnover: 'money', pntosa: 'money', hydrazone: 'money', notes: 'text' },
  SalesEntryLine: { productName: 'text', priceRupees: 'money' },

  // Personal sales
  SalesOrg: { name: 'text' },
  SalesMembership: { fullName: 'text', email: 'text', phone: 'text' },
  SalesLead: {
    companyName: 'text',
    contactPerson: 'text',
    email: 'text',
    phone: 'text',
    address: 'text',
    expectedValue: 'money',
    notes: 'text',
  },
  SalesDocument: {
    toCompany: 'text',
    toContactPerson: 'text',
    toEmail: 'text',
    toPhone: 'text',
    toAddress: 'text',
    totalAmount: 'money',
    bodyHtml: 'text',
  },
  SalesExpense: { title: 'text', amount: 'money', description: 'text' },

  // PMC
  PmcUser: { fullName: 'text', email: 'text' },
  PmcRawMaterial: { name: 'text_deterministic' },
  PmcProduct: { name: 'text_deterministic', code: 'text' },
  PmcReferencePrice: { price: 'money' },
  PmcProductParams: { overhead: 'money' },

  // IO master
  IoUnit: { name: 'text_deterministic', abbreviation: 'text' },
  IoCountry: { name: 'text_deterministic' },
  IoState: { name: 'text_deterministic' },
  IoCity: { name: 'text_deterministic' },
  IoCompany: {
    companyName: 'text',
    personName: 'text',
    address: 'text',
    mobile: 'text',
    email: 'text',
  },
  IoProduct: { productName: 'text', description: 'text', rate: 'money' },
  IoInwardItem: { price: 'money', remarks: 'text' },
  IoOutwardItem: { price: 'money', remarks: 'text' },
  IoDomesticItem: { price: 'money', remarks: 'text' },
  IoInternationalItem: { price: 'money', remarks: 'text' },
  IoQuotationItem: { productNameOverride: 'text', price: 'money' },
}

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'aggregate',
  'count',
  'groupBy',
])

function deterministicContext(model: string, field: string, data: Record<string, unknown>): string {
  const userId = data.userId ?? data.user_id
  const factoryId = data.factoryId ?? data.factory_id
  if (userId != null) return `${model}:${field}:user:${userId}`
  if (factoryId != null) return `${model}:${field}:factory:${factoryId}`
  return `${model}:${field}`
}

function encryptValue(
  model: string,
  field: string,
  kind: FieldKind,
  value: unknown,
  row?: Record<string, unknown>
): unknown {
  if (value == null) return value
  if (kind === 'money') {
    if (typeof value === 'number') return encryptMoney(value)
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '' || trimmed.startsWith('enc:v1')) return value
      const n = Number(trimmed)
      return Number.isFinite(n) ? encryptMoney(n) : encryptField(trimmed)
    }
    return encryptMoney(
      typeof value === 'object' && value !== null && 'toString' in value
        ? Number((value as { toString(): string }).toString())
        : Number(value)
    )
  }
  const text = String(value)
  if (kind === 'text_deterministic') {
    return encryptFieldDeterministic(text, deterministicContext(model, field, row ?? {}))
  }
  return encryptField(text)
}

function decryptValue(kind: FieldKind, value: unknown): unknown {
  if (value == null) return value
  if (kind === 'money') return decryptMoney(value)
  return decryptField(String(value))
}

function transformDataObject(
  model: string,
  data: Record<string, unknown>,
  fields: ModelFieldConfig,
  direction: 'encrypt' | 'decrypt'
): Record<string, unknown> {
  const out = { ...data }
  for (const [field, kind] of Object.entries(fields)) {
    if (!(field in out)) continue
    out[field] =
      direction === 'encrypt'
        ? encryptValue(model, field, kind, out[field], out)
        : decryptValue(kind, out[field])
  }
  return out
}

function transformWhere(
  model: string,
  where: unknown,
  fields: ModelFieldConfig
): unknown {
  if (!where || typeof where !== 'object') return where
  const w = where as Record<string, unknown>
  const out: Record<string, unknown> = { ...w }
  for (const key of Object.keys(out)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const arr = out[key]
      if (Array.isArray(arr)) {
        out[key] = arr.map((clause) => transformWhere(model, clause, fields))
      } else if (arr && typeof arr === 'object') {
        out[key] = transformWhere(model, arr, fields)
      }
      continue
    }
    const kind = fields[key]
    if (kind && out[key] != null && typeof out[key] !== 'object') {
      out[key] =
        kind === 'text_deterministic'
          ? encryptValue(model, key, kind, out[key], w)
          : out[key]
    } else if (typeof out[key] === 'object') {
      out[key] = transformWhere(model, out[key], fields)
    }
  }
  return out
}

export function encryptModelPayload(
  model: string,
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data || !isFieldEncryptionEnabled()) return data
  const fields = ENCRYPTED_MODEL_FIELDS[model]
  if (!fields) return data
  return transformDataObject(model, data, fields, 'encrypt')
}

export function decryptModelRecord<T extends Record<string, unknown>>(model: string, record: T): T {
  if (!isFieldEncryptionEnabled()) return record
  const fields = ENCRYPTED_MODEL_FIELDS[model]
  if (!fields) return record
  return transformDataObject(model, record, fields, 'decrypt') as T
}

function isEncryptedString(value: string): boolean {
  return value.startsWith(ENC_PREFIX) || value.startsWith(ENC_DETERMINISTIC_PREFIX)
}

/** Walk Prisma results (including nested includes) and decrypt any encrypted strings. */
export function deepDecryptValues(value: unknown): unknown {
  if (value == null || !isFieldEncryptionEnabled()) return value
  if (Array.isArray(value)) return value.map(deepDecryptValues)
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(record)) {
      if (typeof v === 'string' && isEncryptedString(v)) {
        out[key] = decryptField(v)
      } else {
        out[key] = deepDecryptValues(v)
      }
    }
    return out
  }
  return value
}

export function decryptModelResult(_model: string, result: unknown): unknown {
  return deepDecryptValues(result)
}

export function applyEncryptionToArgs(model: string, operation: string, args: Record<string, unknown>) {
  if (!isFieldEncryptionEnabled()) return args
  const fields = ENCRYPTED_MODEL_FIELDS[model]
  if (!fields) return args
  const next = { ...args }
  if (next.data) {
    if (Array.isArray(next.data)) {
      next.data = next.data.map((row) =>
        row && typeof row === 'object'
          ? encryptModelPayload(model, row as Record<string, unknown>)
          : row
      )
    } else if (typeof next.data === 'object') {
      next.data = encryptModelPayload(model, next.data as Record<string, unknown>)
    }
  }
  if (next.create && typeof next.create === 'object') {
    next.create = encryptModelPayload(model, next.create as Record<string, unknown>)
  }
  if (next.update && typeof next.update === 'object') {
    next.update = encryptModelPayload(model, next.update as Record<string, unknown>)
  }
  if (next.where) {
    next.where = transformWhere(model, next.where, fields)
  }
  return next
}

export function shouldDecryptResult(operation: string): boolean {
  return READ_OPS.has(operation)
}

/** Decrypt a raw SQL row field (used outside Prisma middleware). */
export function decryptRawField(kind: FieldKind, value: unknown): unknown {
  return decryptValue(kind, value)
}
