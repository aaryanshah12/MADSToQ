// ─── Domain types for the Sales module (madstoq.com/personal/sales) ───

export type SalesDocType = 'quotation' | 'purchase_order' | 'invoice'

export type LeadStatus =
  | 'new' | 'contacted' | 'qualified' | 'proposal'
  | 'negotiation' | 'won' | 'lost' | 'on_hold'

export type SplitMethod = 'equal' | 'custom' | 'percent'

export type DocStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'cancelled'

export type ActivityType =
  | 'note' | 'call' | 'email' | 'meeting'
  | 'status_change' | 'quotation' | 'po' | 'other'

export type NotificationKind =
  | 'expense_added' | 'expense_reminder' | 'expense_settled'
  | 'lead_assigned' | 'document_sent' | 'other'

export interface SalesOrg {
  id: string
  name: string
  slug?: string | null
  email_from: string
  email_cc: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface SalesUser {
  id: string
  user_id: string
  org_id: string
  full_name: string
  email: string
  phone?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface SalesLead {
  id: string
  org_id: string

  company_name: string
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  pincode?: string | null

  source?: string | null
  status: LeadStatus
  expected_value?: number | null
  expected_close_date?: string | null
  notes?: string | null

  assigned_to?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string

  // joined
  assigned_user?: { id: string; full_name: string } | null
}

export interface SalesLeadActivity {
  id: string
  lead_id: string
  activity_type: ActivityType
  title?: string | null
  body?: string | null
  meta?: Record<string, any> | null
  created_by?: string | null
  created_at?: string
  // joined
  author?: { id: string; full_name: string } | null
}

export interface SalesDocument {
  id: string
  org_id: string
  lead_id?: string | null

  doc_type: SalesDocType
  doc_number: string
  doc_date: string

  to_company?: string | null
  to_contact_person?: string | null
  to_email?: string | null
  to_phone?: string | null
  to_address?: string | null

  subject?: string | null
  body_html?: string | null
  body_json?: any
  total_amount?: number | null
  currency?: string | null

  status: DocStatus
  pdf_path?: string | null
  pdf_url?: string | null

  sent_at?: string | null
  sent_to?: string | null
  sent_cc?: string | null
  email_message_id?: string | null

  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface SalesExpense {
  id: string
  org_id: string

  title: string
  description?: string | null
  category?: string | null
  amount: number
  currency: string
  expense_date: string

  paid_by: string
  split_method: SplitMethod

  receipt_path?: string | null
  receipt_url?: string | null
  notes?: string | null

  created_by?: string | null
  created_at?: string
  updated_at?: string

  // joined
  payer?: { id: string; full_name: string } | null
  creator?: { id: string; full_name: string } | null
  splits?: SalesExpenseSplit[]
}

export interface SalesExpenseSplit {
  id: string
  expense_id: string
  user_id: string
  share_amount: number
  share_percent?: number | null
  is_settled: boolean
  settled_at?: string | null
  settled_by?: string | null
  last_reminder_at?: string | null
  reminder_count?: number | null
  created_at?: string
  // joined
  user?: { id: string; full_name: string; email: string } | null
}

export interface SalesNotification {
  id: string
  org_id: string
  user_id: string
  kind: NotificationKind
  title: string
  body?: string | null
  link_url?: string | null
  related_expense_id?: string | null
  related_split_id?: string | null
  related_lead_id?: string | null
  related_document_id?: string | null
  is_read: boolean
  read_at?: string | null
  created_at?: string
}

// Convenience: an expense plus its splits (joined view used in lists/details).
export interface SalesExpenseWithSplits extends SalesExpense {
  splits: SalesExpenseSplit[]
}
