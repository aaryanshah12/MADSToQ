import '@/load-root-env'
import { NextResponse } from 'next/server'

/** Server-side label print settings (read from deployment env). */
export async function GET() {
  const num = (name: string, fallback: number) => {
    const raw = String(process.env[name] ?? '').trim()
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }

  const boolEnv = (name: string) =>
    ['1', 'true', 'yes', 'on', 'y'].includes(String(process.env[name] ?? '').trim().toLowerCase())

  return NextResponse.json({
    layout: String(process.env.NEXT_PUBLIC_LABEL_LAYOUT ?? 'legacy').trim().toLowerCase() || 'legacy',
    labelFontBold: boolEnv('NEXT_PUBLIC_LABEL_FONT_BOLD'),
    labelRemarksWrap: boolEnv('NEXT_PUBLIC_LABEL_REMARKS_WRAP'),
    pageRotationDeg: num('NEXT_PUBLIC_LABEL_ROTATION_DEG', 90),
    textRotateDeg: num('NEXT_PUBLIC_LABEL_TEXT_ROTATE_DEG', 0),
    showFieldNames: ['1', 'true', 'yes', 'on', 'y'].includes(
      String(process.env.NEXT_PUBLIC_LABEL_SHOW_FIELD_NAMES ?? '').trim().toLowerCase(),
    ),
    dateFormat: String(process.env.NEXT_PUBLIC_LABEL_DATE_FORMAT ?? '').trim().toLowerCase(),
    xLeftPct: num('NEXT_PUBLIC_LABEL_X_LEFT_PCT', 0.1),
    yProductPct: num('NEXT_PUBLIC_LABEL_Y_PRODUCT_PCT', 0.66),
    yMeta1Pct: num('NEXT_PUBLIC_LABEL_Y_META1_PCT', 0.45),
    yMeta2Pct: num('NEXT_PUBLIC_LABEL_Y_META2_PCT', 0.32),
    remarksXPct: num('NEXT_PUBLIC_LABEL_REMARKS_X_PCT', 0.72),
    remarksYPct: num('NEXT_PUBLIC_LABEL_REMARKS_Y_PCT', 0.5),
    remarksRotateDeg: num('NEXT_PUBLIC_LABEL_REMARKS_ROTATE_DEG', 0),
  })
}
