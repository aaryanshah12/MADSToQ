export const DEPARTMENT_OPTIONS = [
  'Production',
  'QC/Lab',
  'Warehouse',
  'Accounts',
  'Admin',
  'Plant',
  'Maintenance',
  'Procurement',
  'EHS',
  'Security',
] as const

/** Job titles shown after a department is chosen. */
export const DESIGNATIONS_BY_DEPARTMENT: Record<string, readonly string[]> = {
  Production: [
    'Chemist',
    'Plant Supervisor',
    'Production Operator',
    'Shift Incharge',
    'Batch Operator',
    'Helper',
  ],
  'QC/Lab': [
    'Lab Incharge',
    'QC Chemist',
    'Analyst',
    'Lab Assistant',
  ],
  Warehouse: [
    'Warehouse Manager',
    'Store Keeper',
    'Dispatcher',
    'Loader',
  ],
  Accounts: [
    'Accountant',
    'Accounts Assistant',
    'Billing Executive',
  ],
  Admin: [
    'Director',
    'Admin Executive',
    'HR Executive',
    'Office Assistant',
  ],
  Plant: [
    'Plant Manager',
    'Boiler Operator',
    'Utility Operator',
    'Helper',
  ],
  Maintenance: [
    'Maintenance Supervisor',
    'Electrician',
    'Fitter',
    'Instrument Technician',
  ],
  Procurement: [
    'Purchase Manager',
    'Purchase Executive',
  ],
  EHS: [
    'EHS Officer',
    'Safety Supervisor',
  ],
  Security: [
    'Security Supervisor',
    'Security Guard',
  ],
}

export const RELATION_OPTIONS = [
  'Spouse',
  'Father',
  'Mother',
  'Son',
  'Daughter',
  'Sibling',
  'Other',
] as const

export function designationsForDepartment(department: string, current?: string): string[] {
  const list = [...(DESIGNATIONS_BY_DEPARTMENT[department] ?? [])]
  const extra = current?.trim()
  if (extra && !list.includes(extra)) list.push(extra)
  return list
}

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'trainee', label: 'Trainee' },
] as const

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'terminated', label: 'Terminated' },
] as const

export const GENDER_OPTIONS = [
  { value: '', label: '—' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

export const BLOOD_GROUP_OPTIONS = [
  '', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
]

export const EMPLOYEE_DOC_TYPE_OPTIONS = [
  { value: 'photo', label: 'Photo' },
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN' },
  { value: 'bank_proof', label: 'Bank proof' },
  { value: 'offer_letter', label: 'Offer letter' },
  { value: 'appointment_letter', label: 'Appointment letter' },
  { value: 'resume', label: 'Resume' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
] as const

export function employeeDocTypeLabel(value: string) {
  return EMPLOYEE_DOC_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function employmentStatusLabel(value: string) {
  return EMPLOYMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export const EMPLOYEE_DOC_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'
export const MAX_EMPLOYEE_DOC_BYTES = 5 * 1024 * 1024

export function isAllowedIdCardFile(file: File): string | null {
  const okType =
    ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    /\.(pdf|jpe?g|png|webp)$/i.test(file.name)
  if (!okType) return 'Only PDF, JPEG, PNG, or WebP files are allowed'
  if (file.size > MAX_EMPLOYEE_DOC_BYTES) return 'File must be 5 MB or smaller'
  return null
}

export type EmployeeFormValues = {
  factory_id: string
  employee_code: string
  full_name: string
  father_name: string
  gender: string
  date_of_birth: string
  department: string
  designation: string
  employment_type: string
  employment_status: string
  joining_date: string
  leaving_date: string
  phone: string
  email: string
  current_address: string
  permanent_address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relation: string
  blood_group: string
  pan: string
  aadhaar: string
  uan: string
  pf_number: string
  esi_number: string
  bank_name: string
  account_holder_name: string
  account_number: string
  ifsc: string
  monthly_gross: string
  annual_ctc: string
  basic_pay: string
  pf_eligible: boolean
  esi_eligible: boolean
  profile_id: string
}

export const EMPTY_EMPLOYEE_FORM: EmployeeFormValues = {
  factory_id: '',
  employee_code: '',
  full_name: '',
  father_name: '',
  gender: '',
  date_of_birth: '',
  department: '',
  designation: '',
  employment_type: 'permanent',
  employment_status: 'active',
  joining_date: '',
  leaving_date: '',
  phone: '',
  email: '',
  current_address: '',
  permanent_address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',
  blood_group: '',
  pan: '',
  aadhaar: '',
  uan: '',
  pf_number: '',
  esi_number: '',
  bank_name: '',
  account_holder_name: '',
  account_number: '',
  ifsc: '',
  monthly_gross: '',
  annual_ctc: '',
  basic_pay: '',
  pf_eligible: false,
  esi_eligible: false,
  profile_id: '',
}

export function formToPayload(form: EmployeeFormValues) {
  return {
    factory_id: form.factory_id,
    full_name: form.full_name.trim(),
    father_name: form.father_name,
    gender: form.gender,
    date_of_birth: form.date_of_birth,
    department: form.department.trim(),
    designation: form.designation.trim(),
    employment_type: form.employment_type,
    employment_status: form.employment_status,
    joining_date: form.joining_date,
    leaving_date: form.leaving_date,
    phone: form.phone,
    email: form.email,
    current_address: form.current_address,
    permanent_address: form.permanent_address,
    emergency_contact_name: form.emergency_contact_name,
    emergency_contact_phone: form.emergency_contact_phone,
    emergency_contact_relation: form.emergency_contact_relation,
    blood_group: form.blood_group,
    pan: form.pan,
    aadhaar: form.aadhaar,
    uan: form.uan,
    pf_number: form.pf_number,
    esi_number: form.esi_number,
    bank_name: form.bank_name,
    account_holder_name: form.account_holder_name,
    account_number: form.account_number,
    ifsc: form.ifsc,
    monthly_gross: form.monthly_gross === '' ? null : form.monthly_gross,
    annual_ctc: form.annual_ctc === '' ? null : form.annual_ctc,
    basic_pay: form.basic_pay === '' ? null : form.basic_pay,
    pf_eligible: form.pf_eligible,
    esi_eligible: form.esi_eligible,
    profile_id: form.profile_id || null,
  }
}

export function moneyToInput(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v)
}
