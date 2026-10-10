import { NextResponse } from 'next/server'

function envEnabled(name: string, defaultEnabled = true): boolean {
  const raw = process.env[name]
  if (raw === undefined || String(raw).trim() === '') return defaultEnabled
  const s = String(raw).trim().toLowerCase()
  if (['0', 'false', 'no', 'off', 'n'].includes(s)) return false
  if (['1', 'true', 'yes', 'on', 'y'].includes(s)) return true
  return defaultEnabled
}

/** Server-side IO module flags (read from deployment env at request time). */
export async function GET() {
  return NextResponse.json({
    domestic: envEnabled('NEXT_PUBLIC_IO_ENABLE_DOMESTIC', true),
    international: envEnabled('NEXT_PUBLIC_IO_ENABLE_INTERNATIONAL', true),
  })
}
