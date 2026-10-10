import { moneyStrOrNull, textOrNull } from './field-crypto'

export const EMPLOYMENT_TYPES = ['permanent', 'contract', 'intern', 'trainee'] as const
export const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'resigned', 'terminated'] as const
export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const
export const EMPLOYEE_DOC_TYPES = [
  'photo',
  'aadhaar',
  'pan',
  'bank_proof',
  'offer_letter',
  'appointment_letter',
  'resume',
  'contract',
  'other',
] as const

export const MAX_EMPLOYEE_DOC_BYTES = 5 * 1024 * 1024
export const ALLOWED_EMPLOYEE_DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]
export type EmployeeDocType = (typeof EMPLOYEE_DOC_TYPES)[number]

export type EmployeeWriteData = {
  factoryId?: string
  profileId?: string | null
  employeeCode?: string
  fullName?: string
  fatherName?: string | null
  gender?: string | null
  dateOfBirth?: Date | null
  department?: string
  designation?: string
  employmentType?: string
  employmentStatus?: string
  joiningDate?: Date
  leavingDate?: Date | null
  phone?: string | null
  email?: string | null
  currentAddress?: string | null
  permanentAddress?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  emergencyContactRelation?: string | null
  bloodGroup?: string | null
  pan?: string | null
  aadhaar?: string | null
  uan?: string | null
  pfNumber?: string | null
  esiNumber?: string | null
  bankName?: string | null
  accountHolderName?: string | null
  accountNumber?: string | null
  ifsc?: string | null
  monthlyGross?: string | null
  annualCtc?: string | null
  basicPay?: string | null
  pfEligible?: boolean
  esiEligible?: boolean
  isActive?: boolean
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value == null || value === '') return null
  const s = String(value).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const d = new Date(`${s}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

function parseBool(value: unknown): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0' || value === '') return false
  return undefined
}

const EMPLOYEE_CODE_RE = /^EMP-(\d+)$/i

export function formatEmployeeCode(seq: number): string {
  return `EMP-${String(seq).padStart(3, '0')}`
}

export function nextEmployeeCodeFromExisting(codes: string[]): string {
  let max = 0
  for (const code of codes) {
    const match = EMPLOYEE_CODE_RE.exec(String(code ?? '').trim())
    if (!match) continue
    const n = Number(match[1])
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return formatEmployeeCode(max + 1)
}

export function parseEmployeePayload(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): { error: string } | { data: EmployeeWriteData } {
  const data: EmployeeWriteData = {}

  if (mode === 'create' || body.factory_id !== undefined) {
    const factoryId = String(body.factory_id ?? '').trim()
    if (!factoryId) return { error: 'factory_id is required' }
    data.factoryId = factoryId
  }

  if (mode === 'create' || body.full_name !== undefined) {
    const fullName = String(body.full_name ?? '').trim()
    if (!fullName) return { error: 'full_name is required' }
    data.fullName = fullName
  }

  if (mode === 'create' || body.department !== undefined) {
    const department = String(body.department ?? '').trim()
    if (!department) return { error: 'department is required' }
    data.department = department
  }

  if (mode === 'create' || body.designation !== undefined) {
    const designation = String(body.designation ?? '').trim()
    if (!designation) return { error: 'designation is required' }
    data.designation = designation
  }

  if (mode === 'create' || body.joining_date !== undefined) {
    const joiningDate = parseDate(body.joining_date)
    if (joiningDate === undefined || joiningDate === null) {
      return { error: 'joining_date is required (YYYY-MM-DD)' }
    }
    data.joiningDate = joiningDate
  }

  if (body.employment_type !== undefined || mode === 'create') {
    const employmentType = String(body.employment_type ?? 'permanent').trim()
    if (!EMPLOYMENT_TYPES.includes(employmentType as EmploymentType)) {
      return { error: 'Invalid employment_type' }
    }
    data.employmentType = employmentType
  }

  if (body.employment_status !== undefined || mode === 'create') {
    const employmentStatus = String(body.employment_status ?? 'active').trim()
    if (!EMPLOYMENT_STATUSES.includes(employmentStatus as EmploymentStatus)) {
      return { error: 'Invalid employment_status' }
    }
    data.employmentStatus = employmentStatus
  }

  if (body.gender !== undefined) {
    const gender = textOrNull(body.gender)
    if (gender && !GENDERS.includes(gender as (typeof GENDERS)[number])) {
      return { error: 'Invalid gender' }
    }
    data.gender = gender
  }

  if (body.profile_id !== undefined) {
    const profileId = String(body.profile_id ?? '').trim()
    data.profileId = profileId === '' ? null : profileId
  }

  if (body.father_name !== undefined) data.fatherName = textOrNull(body.father_name)
  if (body.date_of_birth !== undefined) {
    const dob = parseDate(body.date_of_birth)
    if (body.date_of_birth && body.date_of_birth !== '' && dob === undefined) {
      return { error: 'date_of_birth must be YYYY-MM-DD' }
    }
    data.dateOfBirth = dob ?? null
  }
  if (body.leaving_date !== undefined) {
    const leaving = parseDate(body.leaving_date)
    if (body.leaving_date && body.leaving_date !== '' && leaving === undefined) {
      return { error: 'leaving_date must be YYYY-MM-DD' }
    }
    data.leavingDate = leaving ?? null
  }
  if (body.phone !== undefined) data.phone = textOrNull(body.phone)
  if (body.email !== undefined) {
    const email = textOrNull(body.email)
    data.email = email ? email.toLowerCase() : null
  }
  if (body.current_address !== undefined) data.currentAddress = textOrNull(body.current_address)
  if (body.permanent_address !== undefined) data.permanentAddress = textOrNull(body.permanent_address)
  if (body.emergency_contact_name !== undefined) {
    data.emergencyContactName = textOrNull(body.emergency_contact_name)
  }
  if (body.emergency_contact_phone !== undefined) {
    data.emergencyContactPhone = textOrNull(body.emergency_contact_phone)
  }
  if (body.emergency_contact_relation !== undefined) {
    data.emergencyContactRelation = textOrNull(body.emergency_contact_relation)
  }
  if (body.blood_group !== undefined) data.bloodGroup = textOrNull(body.blood_group)
  if (body.pan !== undefined) data.pan = textOrNull(body.pan)
  if (body.aadhaar !== undefined) data.aadhaar = textOrNull(body.aadhaar)
  if (body.uan !== undefined) data.uan = textOrNull(body.uan)
  if (body.pf_number !== undefined) data.pfNumber = textOrNull(body.pf_number)
  if (body.esi_number !== undefined) data.esiNumber = textOrNull(body.esi_number)
  if (body.bank_name !== undefined) data.bankName = textOrNull(body.bank_name)
  if (body.account_holder_name !== undefined) data.accountHolderName = textOrNull(body.account_holder_name)
  if (body.account_number !== undefined) data.accountNumber = textOrNull(body.account_number)
  if (body.ifsc !== undefined) data.ifsc = textOrNull(body.ifsc)
  if (body.monthly_gross !== undefined) data.monthlyGross = moneyStrOrNull(body.monthly_gross)
  if (body.annual_ctc !== undefined) data.annualCtc = moneyStrOrNull(body.annual_ctc)
  if (body.basic_pay !== undefined) data.basicPay = moneyStrOrNull(body.basic_pay)

  const pfEligible = parseBool(body.pf_eligible)
  if (body.pf_eligible !== undefined && pfEligible === undefined) return { error: 'Invalid pf_eligible' }
  if (pfEligible !== undefined) data.pfEligible = pfEligible

  const esiEligible = parseBool(body.esi_eligible)
  if (body.esi_eligible !== undefined && esiEligible === undefined) return { error: 'Invalid esi_eligible' }
  if (esiEligible !== undefined) data.esiEligible = esiEligible

  const isActive = parseBool(body.is_active)
  if (body.is_active !== undefined && isActive === undefined) return { error: 'Invalid is_active' }
  if (isActive !== undefined) data.isActive = isActive

  return { data }
}

export function isAllowedEmployeeDocMime(mime: string, fileName: string): boolean {
  if (ALLOWED_EMPLOYEE_DOC_MIMES.has(mime)) return true
  const lower = fileName.toLowerCase()
  if (mime === 'application/octet-stream' || mime === '') {
    return ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].some((ext) => lower.endsWith(ext))
  }
  return false
}

export function mimeFromFileName(fileName: string, fallback: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return fallback || 'application/octet-stream'
}
