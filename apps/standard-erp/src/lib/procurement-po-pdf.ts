import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import { amountInWordsInr } from '@/lib/amount-in-words'
import {
  fmtMoney,
  fmtQty,
  padAddressLines,
  poFilename,
  poInstructionLines,
  poDocLines,
  resolvePoTax,
  type ProcurementPoDocData,
} from '@/lib/procurement-po-format'
import { loadPoLogo } from '@/lib/procurement-po-logo'

const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 22.68
const INK = rgb(0, 0, 0)
const COLS = [0.1, 0.26, 0.12, 0.08, 0.14, 0.15, 0.15] as const

function pdfSafe(text: string) {
  return text
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).replace(/\r/g, '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word
    if (font.widthOfTextAtSize(trial, size) <= maxWidth || !cur) cur = trial
    else {
      lines.push(cur)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  return lines
}

type Align = 'left' | 'center' | 'right'

type Cell = {
  text: string
  span?: number
  bold?: boolean
  align?: Align
  size?: number
}

async function embedLogo(
  pdf: PDFDocument,
  data: ProcurementPoDocData,
): Promise<PDFImage | null> {
  const logo = await loadPoLogo(data)
  if (!logo) return null
  try {
    return logo.extension === 'jpeg' ? await pdf.embedJpg(logo.bytes) : await pdf.embedPng(logo.bytes)
  } catch {
    return null
  }
}

/** Letterhead A4 PO — same fields and tax as the HTML sheet, without launching Chromium. */
export async function buildProcurementPoPdf(data: ProcurementPoDocData): Promise<{
  buffer: Buffer
  filename: string
}> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontBoldOblique = await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  const logo = await embedLogo(pdf, data)

  const tax = resolvePoTax(data)
  const lines = poDocLines(data)
  const vendorLines = padAddressLines(data.vendorAddress, 4)
  const companyLines = padAddressLines(data.companyAddress, 4)
  const deliveryPlace = (data.deliveryPlace || '').trim() || '—'
  const schedule = (data.scheduleDate || data.deliverySchedule || '').trim() || '—'
  const transporter = (data.transporter || '').trim() || '-'
  const remarks = [data.lineRemarks, data.qualityRef].filter(Boolean).join(' · ') || '-'
  const terms = poInstructionLines(data.specialInstructions)

  const tableX = MARGIN
  const tableW = A4.w - MARGIN * 2
  const colW = COLS.map((p) => p * tableW)
  const colX: number[] = []
  {
    let x = tableX
    for (const w of colW) {
      colX.push(x)
      x += w
    }
  }
  const spanW = (start: number, span: number) => colW.slice(start, start + span).reduce((a, b) => a + b, 0)

  let page = pdf.addPage([A4.w, A4.h])
  let y = A4.h - MARGIN

  const ensure = (need: number) => {
    if (y - need >= MARGIN) return
    page = pdf.addPage([A4.w, A4.h])
    y = A4.h - MARGIN
  }

  const pickFont = (bold?: boolean) => (bold ? fontBold : font)

  const drawLetterhead = () => {
    const nameH = 44
    const titleH = 22
    ensure(nameH + titleH + 6)
    if (logo) {
      const maxH = 40
      const maxW = 150
      const scale = Math.min(maxW / logo.width, maxH / logo.height)
      const w = logo.width * scale
      const h = logo.height * scale
      page.drawImage(logo, {
        x: tableX,
        y: y - nameH + (nameH - h) / 2,
        width: w,
        height: h,
      })
    }
    const name = pdfSafe(data.companyName).toUpperCase()
    let nameSize = 16
    while (nameSize > 9 && fontBold.widthOfTextAtSize(name, nameSize) > tableW - 8) nameSize -= 0.5
    const nameW = fontBold.widthOfTextAtSize(name, nameSize)
    page.drawText(name, {
      x: tableX + (tableW - nameW) / 2,
      y: y - nameH / 2 - nameSize / 3,
      size: nameSize,
      font: fontBold,
      color: INK,
    })
    y -= nameH
    const title = 'PURCHASE ORDER'
    const titleSize = 12
    const titleW = fontBoldOblique.widthOfTextAtSize(title, titleSize)
    page.drawText(title, {
      x: tableX + (tableW - titleW) / 2,
      y: y - titleH + 6,
      size: titleSize,
      font: fontBoldOblique,
      color: INK,
    })
    y -= titleH
  }

  const paintCell = (
    start: number,
    span: number,
    h: number,
    text: string,
    opts: { bold?: boolean; align?: Align; size?: number },
  ) => {
    const x = colX[start]!
    const w = spanW(start, span)
    page.drawRectangle({
      x,
      y: y - h,
      width: w,
      height: h,
      borderColor: INK,
      borderWidth: 0.7,
    })
    const size = opts.size ?? 8
    const f = pickFont(opts.bold)
    const pad = 3
    const lines = wrapLines(text, f, size, Math.max(8, w - pad * 2))
    const lineH = size + 2
    const block = lines.length * lineH
    let baseline = y - h + (h + block) / 2 - size
    for (const line of lines) {
      const tw = f.widthOfTextAtSize(line, size)
      let tx = x + pad
      if (opts.align === 'center') tx = x + Math.max(pad, (w - tw) / 2)
      if (opts.align === 'right') tx = x + w - pad - tw
      page.drawText(line, { x: tx, y: baseline, size, font: f, color: INK })
      baseline -= lineH
    }
  }

  const drawRow = (cells: Cell[], minH = 16) => {
    let start = 0
    let need = minH
    for (const cell of cells) {
      const span = cell.span ?? 1
      const f = pickFont(cell.bold)
      const size = cell.size ?? 8
      const lines = wrapLines(cell.text, f, size, Math.max(8, spanW(start, span) - 6))
      need = Math.max(need, lines.length * (size + 2) + 6)
      start += span
    }
    ensure(need)
    start = 0
    for (const cell of cells) {
      const span = cell.span ?? 1
      paintCell(start, span, need, cell.text, cell)
      start += span
    }
    y -= need
  }

  const gap = () => {
    ensure(8)
    y -= 8
  }

  drawLetterhead()

  drawRow([
    { text: 'Po No.', bold: true },
    { text: data.poNumber, span: 2 },
    { text: 'Delivery Place', bold: true, span: 2 },
    { text: deliveryPlace, span: 2 },
  ])
  drawRow([
    { text: 'Po Date', bold: true },
    { text: data.poDate, span: 2 },
    { text: 'Date of Schedule', bold: true, span: 2 },
    { text: schedule, span: 2 },
  ])
  gap()
  drawRow([
    { text: 'Consigner,', bold: true },
    { text: data.vendorName, span: 2, bold: true },
    { text: 'Consignee,', bold: true, span: 2 },
    { text: data.companyName, span: 2, bold: true },
  ])

  const addrH = 14
  const addrBlockH = addrH * 4
  ensure(addrBlockH)
  const addrTop = y
  paintCell(0, 1, addrBlockH, 'Address', { bold: true, align: 'center' })
  paintCell(3, 2, addrBlockH, 'Consignee Billing Address:', { bold: true, align: 'center', size: 7.5 })
  for (let i = 0; i < 4; i++) {
    y = addrTop - i * addrH
    paintCell(1, 2, addrH, vendorLines[i] || ' ', { size: 7.5 })
    paintCell(5, 2, addrH, companyLines[i] || ' ', { size: 7.5 })
  }
  y = addrTop - addrBlockH

  drawRow([
    { text: 'Gst No.', bold: true },
    { text: data.vendorGstin || '—', span: 2 },
    { text: 'Gst No.', bold: true, span: 2 },
    { text: data.companyGstin || '—', span: 2 },
  ])
  drawRow(
    [
      { text: 'Sr. No.', bold: true, align: 'center' },
      { text: 'Item Description', bold: true, align: 'center' },
      { text: 'Hsn No.', bold: true, align: 'center' },
      { text: 'Unit', bold: true, align: 'center' },
      { text: 'Quantity', bold: true, align: 'center' },
      { text: 'Delivered Rate', bold: true, align: 'center' },
      { text: 'Amount', bold: true, align: 'center' },
    ],
    18,
  )
  for (const [i, line] of lines.entries()) {
    drawRow([
      { text: String(i + 1), align: 'center' },
      { text: line.materialType },
      { text: line.hsnCode || '—', align: 'center' },
      { text: line.unit, align: 'center' },
      { text: fmtQty(line.qty), align: 'right' },
      { text: fmtMoney(line.pricePerUnit), align: 'right' },
      { text: fmtMoney(line.qty * line.pricePerUnit), align: 'right' },
    ])
  }
  drawRow([
    { text: 'Total Qty', bold: true, span: 4 },
    { text: tax.totalQtyLabel, bold: true, align: 'right' },
    { text: '' },
    { text: fmtMoney(tax.lineAmount), bold: true, align: 'right' },
  ])
  drawRow([
    { text: `CGST ${tax.cgstRate}%`, bold: true, span: 6 },
    { text: fmtMoney(tax.cgst), align: 'right' },
  ])
  drawRow([
    { text: `SGST ${tax.sgstRate}%`, bold: true, span: 6 },
    { text: fmtMoney(tax.sgst), align: 'right' },
  ])
  drawRow([
    { text: tax.igstRate ? `IGST ${tax.igstRate}%` : 'IGST', bold: true, span: 6 },
    { text: fmtMoney(tax.igst), align: 'right' },
  ])
  drawRow([
    { text: 'Total Amount', bold: true, span: 6 },
    { text: fmtMoney(tax.grand), bold: true, align: 'right' },
  ])
  drawRow([
    { text: 'Amount In Word', bold: true },
    { text: amountInWordsInr(tax.grand), span: 6 },
  ])
  drawRow([{ text: 'Terms & Condition :-', bold: true, span: 7 }])
  drawRow([
    { text: 'Payment Terms', bold: true },
    { text: data.paymentTerms, span: 6 },
  ])
  drawRow([
    { text: 'Transporter', bold: true },
    { text: transporter, span: 6 },
  ])
  drawRow([
    { text: 'Other Remarks', bold: true },
    { text: remarks, span: 6 },
  ])
  drawRow([{ text: ' Special Instructions :-', bold: true, span: 7 }])
  for (const term of terms) {
    drawRow([{ text: term, span: 7, size: 7.5 }])
  }

  const signH = 48
  ensure(signH + 16)
  paintCell(0, 4, signH, ' ', {})
  paintCell(4, 3, signH, '', {})
  const signX = colX[4]!
  const signW = spanW(4, 3)
  const forLine = pdfSafe(`For, ${data.companyName}`)
  const forSize = 8
  const forW = fontBold.widthOfTextAtSize(forLine, forSize)
  page.drawText(forLine, {
    x: signX + (signW - forW) / 2,
    y: y - 12,
    size: forSize,
    font: fontBold,
    color: INK,
  })
  const approved = 'Electronically Approved'
  const apW = font.widthOfTextAtSize(approved, 8)
  page.drawText(approved, {
    x: signX + (signW - apW) / 2,
    y: y - signH + 10,
    size: 8,
    font,
    color: INK,
  })
  y -= signH

  drawRow(
    [
      {
        text: '*** This is Computer Generated Document, No Signature Required. ***',
        span: 7,
        align: 'center',
        size: 7.5,
      },
    ],
    16,
  )

  const bytes = await pdf.save()
  return { buffer: Buffer.from(bytes), filename: poFilename(data.poNumber, 'pdf') }
}
