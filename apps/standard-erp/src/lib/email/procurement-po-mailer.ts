import { Resend } from 'resend'
import {
  buildProcurementPoEmailCover,
  type ProcurementPoHtmlData,
} from '@/lib/procurement-po-html'
import { buildProcurementPoPdf } from '@/lib/procurement-po-pdf'

export async function sendProcurementPoEmail(params: {
  to: string
  data: ProcurementPoHtmlData
}): Promise<{ sent: boolean; devLogged?: boolean }> {
  const to = params.to.trim().toLowerCase()
  const subject = `Purchase Order ${params.data.poNumber} — ${params.data.companyName}`
  const cover = buildProcurementPoEmailCover(params.data)

  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.PO_EMAIL_FROM?.trim()

  if (!from) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[procurement-po-mailer] PO_EMAIL_FROM unset — would email PO PDF to:', to, subject)
      return { sent: false, devLogged: true }
    }
    throw new Error('PO_EMAIL_FROM is not configured')
  }

  if (!resendKey) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[procurement-po-mailer] RESEND_API_KEY unset — would email PO PDF to:', to, subject)
      return { sent: false, devLogged: true }
    }
    throw new Error('RESEND_API_KEY is not configured')
  }

  const { buffer: pdfBuffer, filename } = await buildProcurementPoPdf(params.data)

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: cover,
    attachments: [
      {
        filename,
        content: pdfBuffer,
      },
    ],
  })

  if (error) {
    throw new Error(error.message)
  }

  return { sent: true }
}
