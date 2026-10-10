import { isValidGstin, normalizeGstin, isValidIndianMobile, normalizeIndianMobile } from '@madstoq/shared-utils'

export const CONTACT_TITLES = ['Mr', 'Mrs', 'Ms', 'Dr'] as const

export const ACCOUNT_TYPE_OPTIONS = [
  { id: 'saving', label: 'Saving' },
  { id: 'current', label: 'Current' },
  { id: 'cc', label: 'CC' },
] as const

export const APPROVAL_REASON_OPTIONS = [
  { id: 'Past Experience', label: 'Past Experience' },
  { id: 'Market Reputation', label: 'Market Reputation' },
  { id: 'Trial Order', label: 'Trial Order' },
  { id: 'Sample Approval', label: 'Sample Approval' },
] as const

export type VendorFormValues = {
  name: string
  product_supplied: string
  company_address: string
  tel_fax_no: string
  email: string
  gst_number: string
  zipcode: string
  contact_title: string
  contact_name: string
  contact_phone: string
  residence_no: string
  bank_name: string
  bank_branch: string
  account_type: string
  account_no: string
  ifsc_code: string
  micr_code: string
  sister_concerns: string
  reference_note: string
  capability_notes: string
  employee_strength: string
  site_branch_count: string
  associated_with_firm: '' | 'yes' | 'no'
  associated_years: string
  speciality: string
  inspection_objection: '' | 'yes' | 'no'
  inspection_objection_details: string
  recommended: '' | 'yes' | 'no'
  approval_reasons: string[]
  approval_reason_notes: string
  approver_name: string
  approver_designation: string
  approved_at: string
}

export const emptyVendorForm: VendorFormValues = {
  name: '',
  product_supplied: '',
  company_address: '',
  tel_fax_no: '',
  email: '',
  gst_number: '',
  zipcode: '',
  contact_title: 'Mr',
  contact_name: '',
  contact_phone: '',
  residence_no: '',
  bank_name: '',
  bank_branch: '',
  account_type: '',
  account_no: '',
  ifsc_code: '',
  micr_code: '',
  sister_concerns: '',
  reference_note: '',
  capability_notes: '',
  employee_strength: '',
  site_branch_count: '',
  associated_with_firm: '',
  associated_years: '',
  speciality: '',
  inspection_objection: '',
  inspection_objection_details: '',
  recommended: '',
  approval_reasons: [],
  approval_reason_notes: '',
  approver_name: '',
  approver_designation: '',
  approved_at: '',
}

export type VendorFieldErrors = {
  gst_number?: string
  email?: string
  contact_phone?: string
}

function yn(v: '' | 'yes' | 'no'): boolean | null {
  if (v === 'yes') return true
  if (v === 'no') return false
  return null
}

export function toCreateSupplierInput(form: VendorFormValues) {
  const reasons = [...form.approval_reasons]
  if (form.approval_reason_notes.trim()) reasons.push(form.approval_reason_notes.trim())
  const phone = normalizeIndianMobile(form.contact_phone)
  return {
    name: form.name,
    companyAddress: form.company_address,
    gstNumber: normalizeGstin(form.gst_number),
    email: form.email.trim().toLowerCase(),
    zipcode: form.zipcode || null,
    contactTitle: form.contact_title || null,
    contactName: form.contact_name || null,
    contactPhone: phone || null,
    productSupplied: form.product_supplied || null,
    telFaxNo: form.tel_fax_no || null,
    residenceNo: form.residence_no || null,
    bankName: form.bank_name || null,
    bankBranch: form.bank_branch || null,
    accountType: form.account_type || null,
    accountNo: form.account_no || null,
    ifscCode: form.ifsc_code || null,
    micrCode: form.micr_code || null,
    sisterConcerns: form.sister_concerns || null,
    referenceNote: form.reference_note || null,
    capabilityNotes: form.capability_notes || null,
    employeeStrength: form.employee_strength || null,
    siteBranchCount: form.site_branch_count || null,
    associatedWithFirm: yn(form.associated_with_firm),
    associatedYears: form.associated_years || null,
    speciality: form.speciality || null,
    inspectionObjection: yn(form.inspection_objection),
    inspectionObjectionDetails: form.inspection_objection_details || null,
    recommended: yn(form.recommended),
    approvalReason: reasons.length ? reasons.join(' / ') : null,
    approverName: form.approver_name || null,
    approverDesignation: form.approver_designation || null,
    approvedAt: form.approved_at || null,
  }
}

export function validateVendorForm(form: VendorFormValues): {
  error: string
  fieldErrors: VendorFieldErrors
} {
  const fieldErrors: VendorFieldErrors = {}
  if (!form.name.trim() || !form.company_address.trim() || !form.gst_number.trim() || !form.email.trim()) {
    return {
      error: 'Company name, address, GST number, and email are required',
      fieldErrors,
    }
  }
  const gstin = normalizeGstin(form.gst_number)
  const email = form.email.trim().toLowerCase()
  const phone = normalizeIndianMobile(form.contact_phone)
  if (!isValidGstin(gstin)) {
    fieldErrors.gst_number =
      gstin.length < 15
        ? 'GSTIN must be 15 characters'
        : 'Invalid GSTIN format (e.g. 24AAAAA0000A1Z5)'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = 'Enter a valid email address'
  }
  if (phone && !isValidIndianMobile(phone)) {
    fieldErrors.contact_phone = 'Invalid mobile — 10 digits starting with 6–9 (optional +91)'
  }
  return {
    error: fieldErrors.gst_number || fieldErrors.email || fieldErrors.contact_phone ? '' : '',
    fieldErrors,
  }
}
