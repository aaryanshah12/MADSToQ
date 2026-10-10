import type { prisma } from '@madstoq/database'
import type { SalesDocument } from './types'

type Db = typeof prisma

export async function fetchSalesDocument(db: Db, orgId: string, documentId: string) {
  const rows = await db.$queryRaw<SalesDocument[]>`
    SELECT * FROM sales_documents
    WHERE id = ${documentId}::uuid AND org_id = ${orgId}::uuid
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function markSalesDocumentSent(
  db: Db,
  docId: string,
  meta: {
    sent_to: string
    sent_cc: string
    email_message_id: string | null
  }
) {
  const sentAt = new Date().toISOString()
  await db.$executeRaw`
    UPDATE sales_documents
    SET status = 'sent',
        sent_at = ${sentAt}::timestamptz,
        sent_to = ${meta.sent_to},
        sent_cc = ${meta.sent_cc},
        email_message_id = ${meta.email_message_id}
    WHERE id = ${docId}::uuid
  `
}

export async function insertLeadActivity(
  db: Db,
  row: {
    lead_id: string
    activity_type: string
    title: string
    body: string
    meta: Record<string, unknown>
    created_by: string
  }
) {
  await db.$executeRaw`
    INSERT INTO sales_lead_activities (lead_id, activity_type, title, body, meta, created_by)
    VALUES (
      ${row.lead_id}::uuid,
      ${row.activity_type},
      ${row.title},
      ${row.body},
      ${JSON.stringify(row.meta)}::jsonb,
      ${row.created_by}::uuid
    )
  `
}
