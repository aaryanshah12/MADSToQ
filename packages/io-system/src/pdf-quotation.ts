import type { IOProduct, IOQuotation, IOQuotationItem } from './types/index'
import { fmtDate } from './api/client'

function productNameById(products: IOProduct[], id: string) {
  return products.find(p => p.id === id)?.product_name ?? ''
}

function safeText(v: unknown) {
  return String(v ?? '').trim()
}

function normalizeLinesPreserveNewlines(text: string) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function wrapParagraphLines(paragraph: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number) {
  const words = safeText(paragraph).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(next, size) <= maxWidth) { cur = next; continue }
    if (cur) lines.push(cur)
    cur = w
  }
  if (cur) lines.push(cur)
  return lines
}

function renderTextBlock(opts: {
  text: string; page: { drawText: (t: string, o: object) => void }; x: number; y: number
  font: { widthOfTextAtSize: (t: string, s: number) => number }
  size: number; maxWidth: number; lineHeight: number; maxLines?: number
}) {
  const { text, page, x, font, size, maxWidth, lineHeight } = opts
  let { y } = opts
  const maxLines = opts.maxLines ?? Number.POSITIVE_INFINITY
  const out: { line: string; indent: number }[] = []

  for (const rawLine of normalizeLinesPreserveNewlines(text)) {
    if (!rawLine.trim()) { out.push({ line: '', indent: 0 }); continue }
    const trimmed = rawLine.trim()
    const isBullet = /^\*\s+/.test(trimmed)
    if (isBullet) {
      const bulletText = trimmed.replace(/^\*\s+/, '')
      const bulletPrefix = '• '
      const bulletPrefixW = font.widthOfTextAtSize(bulletPrefix, size)
      const wrapped = wrapParagraphLines(bulletText, font, size, Math.max(20, maxWidth - bulletPrefixW))
      wrapped.forEach((l, idx) => { out.push({ line: (idx === 0 ? bulletPrefix : '  ') + l, indent: 0 }) })
      continue
    }
    wrapParagraphLines(trimmed, font, size, maxWidth).forEach(l => out.push({ line: l, indent: 0 }))
  }

  for (const row of out.slice(0, maxLines)) {
    if (row.line === '') { y -= lineHeight; continue }
    page.drawText(row.line, { x: x + row.indent, y, size, font })
    y -= lineHeight
  }
  return y
}

function formatINR(amount: unknown) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return ''
  return `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

/** Build quotation / purchase-order PDF bytes (letter-head template required). */
export async function buildLetterHeadQuotationPdfBytes(
  row: IOQuotation,
  products: IOProduct[],
  letterHeadPdf: ArrayBuffer,
  options?: { documentTitle?: string },
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const pdf = await PDFDocument.load(letterHeadPdf)
  const page = pdf.getPages()[0]
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()

  const marginX = 56
  const contentW = width - marginX * 2
  let y = height * 0.78

  const qNo = safeText(row.quotation_number)
  const qDate = fmtDate(row.quotation_date)
  const customerName = safeText(row.customer?.company_name ?? '')
  const rightX = marginX + contentW * 0.65
  const docTitle = options?.documentTitle ?? 'QUOTATION'

  page.drawText(`Date: ${qDate || '—'}`, { x: rightX, y, size: 10.5, font })

  const greeting = `Respected Mr. ${customerName},`
  page.drawText(greeting, { x: marginX, y, size: 11, font: fontBold })
  y -= 18

  const headerText = safeText(row.header_content ?? '')
  if (headerText) {
    const cleanHeader = headerText.replace(/^Respected Mr,?\s*/i, '').replace(/^Greetings of the Day\s*!!!\s*/i, 'Greetings of the Day !!!\n\n')
    y = renderTextBlock({ text: cleanHeader, page, x: marginX, y, font, size: 10.5, maxWidth: contentW, lineHeight: 14 })
  }

  y -= 10

  page.drawText(docTitle, { x: marginX, y, size: 14, font: fontBold })
  page.drawText(`${docTitle === 'PURCHASE ORDER' ? 'PO' : 'Quotation'} No: ${qNo || '—'}`, { x: rightX, y, size: 10.5, font: fontBold })

  y -= 25

  const tableW = Math.min(520, contentW)
  const x0 = (width - tableW) / 2
  const col1 = x0
  const col2 = x0 + tableW * 0.22
  const col3 = x0 + tableW * 0.80

  page.drawText('Outward Ref', { x: col1, y, size: 10, font: fontBold })
  page.drawText('Product', { x: col2, y, size: 10, font: fontBold })
  page.drawText('Price', { x: col3, y, size: 10, font: fontBold })
  y -= 16

  const items: IOQuotationItem[] = row.items ?? []
  for (const it of items) {
    const ref = safeText(it.reference_no ?? '')
    const name = safeText(it.product_name_override || productNameById(products, it.product_id || ''))
    const price = formatINR(it.price)
    page.drawText(ref || '—', { x: col1, y, size: 10, font })
    page.drawText(name || '—', { x: col2, y, size: 10, font })
    page.drawText(price || '—', { x: col3, y, size: 10, font })
    y -= 14
    if (y < height * 0.18) break
  }

  y -= 20
  const footerText = safeText(row.footer_content ?? '')
  if (footerText && y > height * 0.10) {
    renderTextBlock({ text: footerText, page, x: marginX, y, font, size: 10, maxWidth: contentW, lineHeight: 13 })
  }

  return pdf.save()
}
