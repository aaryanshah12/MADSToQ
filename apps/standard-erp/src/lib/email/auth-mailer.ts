import { Resend } from 'resend'

export async function sendPasswordResetEmail(params: {
  to: string
  resetUrl: string
  appName?: string
}): Promise<{ sent: boolean; devLogged?: boolean }> {
  const appName = params.appName ?? 'MADSTOQ ERP'
  const subject = `Reset your ${appName} password`
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#111;line-height:1.55">
      <p>You requested a password reset for your ${appName} account.</p>
      <p><a href="${params.resetUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p>
      <p style="font-size:13px;color:#666">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      <p style="font-size:12px;color:#999;word-break:break-all">${params.resetUrl}</p>
    </div>
  `.trim()

  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.AUTH_EMAIL_FROM ?? 'MADSTOQ ERP <noreply@madstoq.com>'

  if (!resendKey) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[auth-mailer] RESEND_API_KEY unset — password reset link:', params.resetUrl)
      return { sent: false, devLogged: true }
    }
    throw new Error('RESEND_API_KEY is not configured')
  }

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject,
    html,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { sent: true }
}
