import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, name, email, company, phone, product, quantity, message } = body

    const subjectMap: Record<string, string> = {
      inquiry: `Product Inquiry: ${product ?? 'N/A'}`,
      quote:   'Free Quote Request',
      contact: 'Contact Form Submission',
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="background:#1a3a6b;padding:24px">
          <h2 style="color:#fff;margin:0;font-size:20px">${subjectMap[type] ?? 'New Inquiry'}</h2>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">MADSToQ â€” Website Inquiry</p>
        </div>
        <div style="padding:24px;background:#f9fafb">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            ${name     ? `<tr><td style="padding:8px 0;color:#6b7280;width:140px">Name</td><td style="padding:8px 0;color:#111827;font-weight:600">${name}</td></tr>` : ''}
            ${email    ? `<tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0;color:#111827;font-weight:600">${email}</td></tr>` : ''}
            ${phone    ? `<tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0;color:#111827;font-weight:600">${phone}</td></tr>` : ''}
            ${company  ? `<tr><td style="padding:8px 0;color:#6b7280">Company</td><td style="padding:8px 0;color:#111827;font-weight:600">${company}</td></tr>` : ''}
            ${product  ? `<tr><td style="padding:8px 0;color:#6b7280">Product</td><td style="padding:8px 0;color:#111827;font-weight:600">${product}</td></tr>` : ''}
            ${quantity ? `<tr><td style="padding:8px 0;color:#6b7280">Quantity</td><td style="padding:8px 0;color:#111827;font-weight:600">${quantity}</td></tr>` : ''}
          </table>
          ${message ? `
            <div style="margin-top:16px;padding:16px;background:#fff;border-radius:6px;border:1px solid #e5e7eb">
              <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Message</p>
              <p style="margin:0;color:#111827;font-size:14px;white-space:pre-wrap">${message}</p>
            </div>` : ''}
        </div>
        <div style="padding:16px 24px;background:#f3f4f6;text-align:center;font-size:12px;color:#9ca3af">
          Sent via madstoq.in website
        </div>
      </div>
    `

    await transporter.sendMail({
      from: `"MADSToQ Website" <${process.env.SMTP_USER}>`,
      to: process.env.INQUIRY_TO ?? 'inquires@madstoq.com',
      replyTo: email,
      subject: subjectMap[type] ?? 'New Inquiry',
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Email send error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

