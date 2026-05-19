import { getSupabaseAdmin } from '@madstoq/database'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role, phone } = await request.json()

    // Create auth user using admin API
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Update profile with correct role and phone
    await supabaseAdmin
      .from('profiles')
      .update({ full_name, role, phone: phone || null })
      .eq('id', data.user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
