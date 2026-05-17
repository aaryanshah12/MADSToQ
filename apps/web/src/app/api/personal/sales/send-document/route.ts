import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSalesContext } from '@/lib/sales/server'
import { renderDocumentPdf } from '@/lib/sales/pdf'
import type { SalesDocument } from '@/lib/sales/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUBJECTS: Record<SalesDocument['doc_type'], string> = {
  quotation: 'Quotation',
  purchase_order: 'Purchase Order',
  invoice: 'Tax Invoice',
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export async function POST(req: NextRequest) {
  const ctx = await getSalesContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { document_id } = await req.json()
  if (!document_id) return NextResponse.json({ error: 'document_id required' }, { status: 400 })

  const { data: doc, error } = await ctx.supabase
    .from('sales_documents')
    .select('*')
    .eq('id', document_id)
    .eq('org_id', ctx.org.id)
    .single()
  if (error || !doc) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })

  const recipient = (doc.to_email ?? '').trim()
  if (!recipient) return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })

  // Build PDF
  let pdfBytes: Buffer
  try {
    pdfBytes = await renderDocumentPdf(doc as SalesDocument, ctx.org)
  } catch (e: any) {
    console.error('PDF build failed:', e)
    return NextResponse.json({ error: 'Failed to build PDF: ' + (e.message ?? '') }, { status: 500 })
  }

  // Compose email
  const transporter = nodemailer.createTransport({
    host: process.env.SALES_SMTP_HOST ?? process.env.SMTP_HOST,
    port: Number(process.env.SALES_SMTP_PORT ?? process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SALES_SMTP_USER ?? process.env.SMTP_USER,
      pass: process.env.SALES_SMTP_PASS ?? process.env.SMTP_PASS,
    },
  })

  const fromEmail = ctx.org.email_from || process.env.SALES_SMTP_USER || process.env.SMTP_USER || 'sales@madstoq.com'
  const ccEmail   = ctx.org.email_cc   || 'inquires@madstoq.com'

  const docTypeLabel = SUBJECTS[doc.doc_type as SalesDocument['doc_type']] ?? 'Document'
  const subject = `${docTypeLabel} ${doc.doc_number}${doc.subject ? ' — ' + doc.subject : ''}`
  const greetingName = doc.to_contact_person ? doc.to_contact_person.split(/\s+/)[0] : (doc.to_company ?? 'Sir/Madam')

  const htmlBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#111;line-height:1.55">
      <p>Dear ${escapeHtml(greetingName)},</p>
      <p>Please find attached the ${docTypeLabel.toLowerCase()} <strong>${escapeHtml(doc.doc_number)}</strong>${doc.subject ? ` regarding <em>${escapeHtml(doc.subject)}</em>` : ''}.</p>
      <p>Feel free to reply to this email if you have any questions.</p>
      <p style="margin-top:24px">Best regards,<br/>${escapeHtml(ctx.membership.full_name)}<br/>${escapeHtml(ctx.org.name)}</p>
    </div>
  `

  try {
    const filename = `${(doc.doc_number || 'document').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`
    const info = await transporter.sendMail({
      from: `"${ctx.org.name} — ${ctx.membership.full_name}" <${fromEmail}>`,
      to: recipient,
      cc: ccEmail,
      replyTo: ctx.membership.email || fromEmail,
      subject,
      html: htmlBody,
      attachments: [{ filename, content: pdfBytes, contentType: 'application/pdf' }],
    })

    // Mark sent + record metadata.
    const sentAt = new Date().toISOString()
    await ctx.supabase
      .from('sales_documents')
      .update({
        status: 'sent',
        sent_at: sentAt,
        sent_to: recipient,
        sent_cc: ccEmail,
        email_message_id: info.messageId ?? null,
      })
      .eq('id', doc.id)

    // Log a lead activity if attached to a lead.
    if (doc.lead_id) {
      await ctx.supabase.from('sales_lead_activities').insert({
        lead_id: doc.lead_id,
        activity_type: doc.doc_type === 'purchase_order' ? 'po' : 'quotation',
        title: `${docTypeLabel} ${doc.doc_number} sent`,
        body: `Sent to ${recipient} (cc: ${ccEmail})`,
        meta: { document_id: doc.id },
        created_by: ctx.membership.id,
      })
    }

    return NextResponse.json({ ok: true, messageId: info.messageId })
  } catch (e: any) {
    console.error('Email send failed:', e)
    return NextResponse.json({ error: 'Email send failed: ' + (e.message ?? '') }, { status: 500 })
  }
}
