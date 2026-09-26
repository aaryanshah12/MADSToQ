import { getAdminDb } from '@madstoq/database'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role, phone } = await request.json()

    const db = getAdminDb()
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    })

    if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'Could not create user' }, { status: 400 })

    await db
      .from('profiles')
      .update({ full_name, role, phone: phone || null })
      .eq('id', data.user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
