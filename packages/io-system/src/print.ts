import type { IODomestic, IOInternational, IOInward, IOOutward, IOProduct, IOQuotation, IOQuotationItem, IOLineItem, IOCompany } from "./types";
import { formatQuotationPrice } from "./quotation-price";
import { fmtDate } from "./api/client";
type InvoiceLike = (IODomestic | IOInternational) & { items?: IOLineItem[] }
type TemplateSlot = 'label' | 'letter-head' | 'customer-print'

let templateCache: Record<string, string> | null = null

type LabelPrintConfig = {
  layout: string
  labelFontBold: boolean
  labelRemarksWrap: boolean
  pageRotationDeg: number
  textRotateDeg: number
  showFieldNames: boolean
  dateFormat: string
  xLeftPct: number
  yProductPct: number
  yMeta1Pct: number
  yMeta2Pct: number
  remarksXPct: number
  remarksYPct: number
  remarksRotateDeg: number
}

const DEFAULT_LABEL_CONFIG: LabelPrintConfig = {
  layout: 'legacy',
  labelFontBold: false,
  labelRemarksWrap: false,
  pageRotationDeg: 90,
  textRotateDeg: 0,
  showFieldNames: false,
  dateFormat: '',
  xLeftPct: 0.1,
  yProductPct: 0.66,
  yMeta1Pct: 0.45,
  yMeta2Pct: 0.32,
  remarksXPct: 0.72,
  remarksYPct: 0.5,
  remarksRotateDeg: 0,
}

let labelConfigCache: LabelPrintConfig | null = null

async function getLabelPrintConfig(): Promise<LabelPrintConfig> {
  if (labelConfigCache) return labelConfigCache
  try {
    const res = await fetch('/api/io/label-config', { cache: 'no-store' })
    if (res.ok) {
      const merged = { ...DEFAULT_LABEL_CONFIG, ...(await res.json()) } as LabelPrintConfig
      labelConfigCache = merged
      return merged
    }
  } catch {
    /* offline / tests */
  }
  labelConfigCache = DEFAULT_LABEL_CONFIG
  return labelConfigCache
}

async function getPdfLib() {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')
  return { PDFDocument, StandardFonts, rgb, degrees }
}

function resolvePdfFetchUrl(webPath: string): string {
  if (webPath.startsWith('/io-pdfs/')) {
    return `/api/io/pdf?path=${encodeURIComponent(webPath)}`
  }
  return webPath
}

async function fetchArrayBuffer(url: string) {
  const res = await fetch(resolvePdfFetchUrl(url))
  if (!res.ok) throw new Error(`Failed to load template: ${url}`)
  return res.arrayBuffer()
}

/** Try primary URL then slot default (uploaded PDFs on Render are lost on redeploy unless committed under public/). */
async function fetchTemplatePdf(slot: TemplateSlot): Promise<ArrayBuffer> {
  const fallbacks: Record<TemplateSlot, string> = {
    label: '/Label.pdf',
    'letter-head': '/letter-head.pdf',
    'customer-print': '/address print.pdf',
  }
  const primary = await getTemplateUrl(slot)
  const urls = [...new Set([primary, fallbacks[slot]].filter(Boolean))]
  let lastErr: Error | null = null
  for (const url of urls) {
    try {
      return await fetchArrayBuffer(url)
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw (
    lastErr ??
    new Error(
      `Failed to load ${slot} template. Add ${fallbacks[slot]} to public/ or re-upload in Master → PDFs after deploy.`,
    )
  )
}

async function getTemplateUrl(slot: TemplateSlot): Promise<string> {
  if (!templateCache) {
    try {
      const res = await fetch('/api/io/upload-pdf', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        templateCache = data?.selected ?? {}
      } else {
        templateCache = {}
      }
    } catch {
      templateCache = {}
    }
  }
  const fallbacks: Record<TemplateSlot, string> = {
    label: '/Label.pdf',
    'letter-head': '/letter-head.pdf',
    'customer-print': LEGACY_ADDRESS_TEMPLATE,
  }
  const selected = templateCache?.[slot]
  if (selected) return selected
  return fallbacks[slot]
}

export function invalidatePdfTemplateCache() {
  templateCache = null
  labelConfigCache = null
}

function openPrintBlob(blob: Blob, _filename: string, format: 'label' | 'a4' = 'a4') {
  const pdfBlobUrl = URL.createObjectURL(blob)

  // Labels: open the PDF in the browser’s native viewer — same tab UX and print preview as File → Print on a PDF (no HTML+embed wrapper).
  if (format === 'label') {
    const win = window.open(pdfBlobUrl, '_blank')
    if (!win) {
      window.location.href = pdfBlobUrl
      return
    }
    let printStarted = false
    const openSystemPrintPreview = () => {
      if (printStarted) return
      printStarted = true
      window.setTimeout(() => {
        try {
          win.focus()
          win.print()
        } catch {
          /* e.g. blocked; user can still use viewer Print */
        }
      }, 350)
    }
    win.addEventListener('load', () => window.setTimeout(openSystemPrintPreview, 600))
    window.setTimeout(openSystemPrintPreview, 2200)
    window.setTimeout(() => URL.revokeObjectURL(pdfBlobUrl), 60_000)
    return
  }

  const pageSize = 'A4'
  const pw = '210mm'
  const ph = '297mm'
  const a4Css = [
    `@page { size: ${pageSize}; margin: 0; }`,
    '* { margin: 0; padding: 0; box-sizing: border-box; }',
    `html, body { width: ${pw}; height: ${ph}; max-width: ${pw}; max-height: ${ph}; overflow: hidden; background: #fff; }`,
    `embed { display: block; width: ${pw}; height: ${ph}; border: none; }`,
  ].join('')
  const html = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
    a4Css,
    '</style></head><body>',
    `<embed src="${pdfBlobUrl}" type="application/pdf">`,
    '<script>',
    'window.addEventListener("load",function(){',
    '  setTimeout(function(){window.print();},500);',
    '});',
    '</script></body></html>',
  ].join('')
  const htmlBlob = new Blob([html], { type: 'text/html' })
  const htmlUrl = URL.createObjectURL(htmlBlob)
  const win = window.open(htmlUrl, '_blank')
  if (!win) {
    window.location.href = pdfBlobUrl
    return
  }
  window.setTimeout(() => {
    URL.revokeObjectURL(pdfBlobUrl)
    URL.revokeObjectURL(htmlUrl)
  }, 60_000)
}

function productNameById(products: IOProduct[], id: string) {
  return products.find(p => p.id === id)?.product_name ?? ''
}

function safeText(v: unknown) {
  return String(v ?? '').trim()
}

function normalizeLinesPreserveNewlines(text: string) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function wrapParagraphLines(paragraph: string, font: any, size: number, maxWidth: number) {
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

function companyLabelLineHeight(size: number) {
  return Math.max(7, Math.round(size * 1.15))
}

/** Stack To / contact / address and shrink font until all lines fit the content band. */
function fitCompanyLabelStack(opts: {
  toLine: string
  contactLine: string
  fullAddress: string
  nameFont: { widthOfTextAtSize: (t: string, s: number) => number }
  bodyFont: { widthOfTextAtSize: (t: string, s: number) => number }
  contentMaxW: number
  availableHeight: number
}): { nameSize: number; bodySize: number; lineHeight: number; lines: { text: string; bold: boolean }[] } {
  const build = (nameSize: number, bodySize: number) => {
    const lineHeight = companyLabelLineHeight(bodySize)
    const nameLineHeight = companyLabelLineHeight(nameSize)
    const nameLines = wrapParagraphLines(opts.toLine, opts.nameFont, nameSize, opts.contentMaxW)
    const lines: { text: string; bold: boolean }[] = nameLines.map((text) => ({ text, bold: true }))
    if (opts.contactLine) {
      lines.push(...wrapParagraphLines(opts.contactLine, opts.bodyFont, bodySize, opts.contentMaxW).slice(0, 1).map((text) => ({ text, bold: false })))
    }
    if (opts.fullAddress) {
      lines.push(...wrapParagraphLines(opts.fullAddress, opts.bodyFont, bodySize, opts.contentMaxW).map((text) => ({ text, bold: false })))
    }
    const bodyLineCount = lines.length - nameLines.length
    const totalH = nameLines.length * nameLineHeight + (bodyLineCount > 0 ? 2 : 0) + bodyLineCount * lineHeight
    return { lines, lineHeight, nameLineHeight, totalH, nameSize, bodySize, nameLines }
  }

  for (const bodySize of [9, 8, 7, 6, 5]) {
    for (const nameSize of [11, 10, 9, 8, 7].filter((s) => s >= bodySize)) {
      const fit = build(nameSize, bodySize)
      if (fit.totalH <= opts.availableHeight) {
        return { nameSize: fit.nameSize, bodySize: fit.bodySize, lineHeight: fit.lineHeight, lines: fit.lines }
      }
    }
  }

  const bodySize = 5
  const nameSize = 7
  const lineHeight = companyLabelLineHeight(bodySize)
  const nameLineHeight = companyLabelLineHeight(nameSize)
  const nameLines = wrapParagraphLines(opts.toLine, opts.nameFont, nameSize, opts.contentMaxW)
  const maxBodyLines = Math.max(
    1,
    Math.floor((opts.availableHeight - nameLines.length * nameLineHeight - 2) / lineHeight),
  )
  const lines: { text: string; bold: boolean }[] = nameLines.map((text) => ({ text, bold: true }))
  const contact = opts.contactLine
    ? wrapParagraphLines(opts.contactLine, opts.bodyFont, bodySize, opts.contentMaxW).slice(0, 1)
    : []
  const address = opts.fullAddress
    ? wrapParagraphLines(opts.fullAddress, opts.bodyFont, bodySize, opts.contentMaxW)
    : []
  const bodyLines = [...contact, ...address].slice(0, maxBodyLines)
  bodyLines.forEach((text) => lines.push({ text, bold: false }))
  return { nameSize, bodySize, lineHeight, lines }
}

function richContentToPlainText(raw: string): string {
  const text = String(raw ?? '')
  if (!text.trim()) return ''
  if (!/<[a-z][\s\S]*>/i.test(text)) return text

  const plain = text
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '* ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

  return plain
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Header body only — greeting line is drawn separately on the PDF. */
function prepareQuotationHeaderBody(raw: string): string {
  const plain = richContentToPlainText(raw)
  if (!plain) return ''
  const lines = plain.split('\n').filter((line) => {
    const t = line.trim()
    if (!t) return true
    return !/^Respected\s+/i.test(t)
  })
  return lines.join('\n').trim()
}

function prepareQuotationFooterBody(raw: string): string {
  return richContentToPlainText(raw)
}

function renderTextBlock(opts: {
  text: string; page: any; x: number; y: number; font: any
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

function quotationSalutation(customer: { person_title?: string | null; person_name?: string | null } | null | undefined) {
  const title = safeText(customer?.person_title)
  const name = safeText(customer?.person_name)
  if (title && name) return `Respected ${title} ${name},`
  if (name) return `Respected ${name},`
  return 'Respected Sir/Madam,'
}

/** Salutation + customer company on the next line (To-block style). */
function drawQuotationAddressee(
  page: any,
  customer: { person_title?: string | null; person_name?: string | null; company_name?: string | null } | null | undefined,
  x: number,
  y: number,
  fontBold: any,
  font: any,
) {
  page.drawText(quotationSalutation(customer), { x, y, size: 11, font: fontBold })
  y -= 16
  const company = safeText(customer?.company_name)
  if (company) {
    page.drawText(company.endsWith(',') ? company : `${company},`, { x, y, size: 10.5, font })
    y -= 14
  }
  return y
}

function drawRightText(page: any, text: string, xRight: number, y: number, size: number, font: any) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: xRight - w, y, size, font })
}

function u8ToArrayBuffer(bytes: Uint8Array) {
  const u8 = Uint8Array.from(bytes)
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
}

// --- REWRITTEN QUOTATION FUNCTION ---
export async function printLetterHeadQuotation(row: IOQuotation, products: IOProduct[]) {
  const { PDFDocument, StandardFonts } = await getPdfLib()
  const ab = await fetchTemplatePdf('letter-head')
  const pdf = await PDFDocument.load(ab)
  const page = pdf.getPages()[0]
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()

  const marginX = 56
  const contentW = width - marginX * 2
  const contentRight = marginX + contentW
  let y = height * 0.78

  const qNo = safeText(row.quotation_number)
  const qDate = fmtDate(row.quotation_date)

  drawRightText(page, `Date: ${qDate || '—'}`, contentRight, y, 10.5, font)
  y = drawQuotationAddressee(page, row.customer, marginX, y, fontBold, font)
  y -= 4

  const headerText = prepareQuotationHeaderBody((row as any).header_content ?? '')
  if (headerText) {
    y = renderTextBlock({ text: headerText, page, x: marginX, y, font, size: 10.5, maxWidth: contentW, lineHeight: 14 })
  }

  y -= 10

  page.drawText('QUOTATION', { x: marginX, y, size: 14, font: fontBold })
  drawRightText(page, `Quotation No: ${qNo || '—'}`, contentRight, y, 10.5, fontBold)

  y -= 25

  const colRefW = contentW * 0.24
  const colProductW = contentW * 0.52
  const colPriceW = contentW * 0.24
  const colRefX = marginX
  const colProductX = colRefX + colRefW
  const colPriceX = colProductX + colProductW
  const colPriceRight = colPriceX + colPriceW

  page.drawText('Outward Ref', { x: colRefX, y, size: 10, font: fontBold })
  page.drawText('Product', { x: colProductX, y, size: 10, font: fontBold })
  drawRightText(page, 'Price', colPriceRight, y, 10, fontBold)
  y -= 16

  const items: IOQuotationItem[] = row.items ?? []
  for (const it of items) {
    const ref = safeText(it.reference_no ?? '')
    const name = safeText(it.product_name_override || productNameById(products, it.product_id || ''))
    const price = formatQuotationPrice(it.price, it.price_unit)
    page.drawText(ref || '—', { x: colRefX, y, size: 10, font })
    const nameLines = wrapParagraphLines(name || '—', font, 10, colProductW - 8).slice(0, 2)
    nameLines.forEach((line, idx) => {
      page.drawText(line, { x: colProductX, y: y - idx * 12, size: 10, font })
    })
    drawRightText(page, price || '—', colPriceRight, y, 10, font)
    y -= Math.max(14, nameLines.length * 12)
    if (y < height * 0.18) break
  }

  // 7. FOOTER
  y -= 20
  const footerText = prepareQuotationFooterBody((row as any).footer_content ?? '')
  if (footerText && y > height * 0.10) {
    renderTextBlock({ text: footerText, page, x: marginX, y, font, size: 10, maxWidth: contentW, lineHeight: 13 })
  }

  const bytes = await pdf.save()
  openPrintBlob(new Blob([u8ToArrayBuffer(bytes)], { type: 'application/pdf' }), `${qNo || 'quotation'}.pdf`)
}

// --- REWRITTEN INVOICE FUNCTION ---
export async function printLetterHeadInvoice(_kind: 'Domestic' | 'International', row: InvoiceLike, products: IOProduct[]) {
  const { PDFDocument, StandardFonts } = await getPdfLib()
  const ab = await fetchTemplatePdf('letter-head')
  const pdf = await PDFDocument.load(ab)
  const page = pdf.getPages()[0]
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()

  const marginX = 56
  const contentW = width - marginX * 2
  let y = height * 0.78

  const invNo = safeText((row as any).invoice_number)
  const taxNo = safeText((row as any).tax_invoice_number ?? '')
  const invDate = fmtDate((row as any).invoice_date)
  const customer = safeText((row as any).customer?.company_name ?? '')
  // 1. TOP HEADER - TO SECTION (Left) & INVOICE NO (Right)
  page.drawText('To,', { x: marginX, y, size: 10, font: fontBold })

  y -= 14
  page.drawText(customer || '—', { x: marginX, y, size: 10, font: fontBold })

  // 2. TAX INVOICE NO & DATE ON THE SAME LINE (Right)
  const taxLine = `Tax Invoice No: ${taxNo || '—'}      Date: ${invDate || '—'}`
  y -= 30
  page.drawText(taxLine, { x: marginX, y, size: 10, font })

  // 3. TABLE START
  y -= 50

  const tableW = Math.min(520, contentW)
  const x0 = (width - tableW) / 2
  const colP = x0
  const colQ = x0 + tableW * 0.65
  const colR = x0 + tableW * 0.78
  const colT = x0 + tableW * 0.90

  page.drawText('Product', { x: colP, y, size: 10, font: fontBold })
  page.drawText('Qty', { x: colQ, y, size: 10, font: fontBold })
  page.drawText('Rate', { x: colR, y, size: 10, font: fontBold })
  page.drawText('Total', { x: colT, y, size: 10, font: fontBold })
  y -= 16

  const items = (row.items ?? []) as IOLineItem[]
  for (const it of items) {
    const name = safeText(it.product?.product_name || productNameById(products, it.product_id))
    const qty = it.quantity != null ? String(Number(it.quantity)) : '0'
    const rate = formatINR(it.price)
    const total = (it.price != null && it.quantity != null) ? formatINR(Number(it.price) * Number(it.quantity)) : '—'

    page.drawText(name || '—', { x: colP, y, size: 10, font })
    page.drawText(qty, { x: colQ, y, size: 10, font })
    page.drawText(rate || '—', { x: colR, y, size: 10, font })
    page.drawText(total || '—', { x: colT, y, size: 10, font })
    y -= 14
    if (y < height * 0.15) break
  }

  const bytes = await pdf.save()
  openPrintBlob(new Blob([u8ToArrayBuffer(bytes)], { type: 'application/pdf' }), `${invNo || 'invoice'}.pdf`)
}

export async function printLabelForInward(row: IOInward, products: IOProduct[]) {
  await printLabelPages('Inward', safeText(row.inward_number), row.inward_date, safeText(row.remarks ?? ''), row.items ?? [], products)
}

export async function printLabelForOutward(row: IOOutward, products: IOProduct[]) {
  await printLabelPages('Outward', safeText(row.outward_number), row.outward_date, safeText(row.remarks ?? ''), row.items ?? [], products)
}

export async function printLabelForDomestic(row: IODomestic, products: IOProduct[]) {
  const id = safeText(row.tax_invoice_number || (row as any).invoice_number)
  await printLabelPages('Domestic', id, (row as any).invoice_date, safeText(row.remarks ?? ''), (row.items ?? []) as any[], products)
}

export async function printLabelForInternational(row: IOInternational, products: IOProduct[]) {
  const id = safeText(row.tax_invoice_number || (row as any).invoice_number)
  await printLabelPages('International', id, (row as any).invoice_date, safeText(row.remarks ?? ''), (row.items ?? []) as any[], products)
}

const LEGACY_ADDRESS_TEMPLATE = '/address print.pdf'

/** Company address label — uses Master → PDFs → Customer Print template. */
export async function printCompanyLabel(company: IOCompany) {
  const { PDFDocument, StandardFonts, degrees } = await getPdfLib()
  const ab = await fetchTemplatePdf('customer-print')
  const src = await PDFDocument.load(ab)

  const pdf = await PDFDocument.create()
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const tplPage = src.getPage(0)
  const { x: tplX, y: tplY, width: tplW, height: tplH } = tplPage.getMediaBox()
  const [embeddedTpl] = await pdf.embedPdf(src, [0])
  const cfg = await getLabelPrintConfig()

  const page = pdf.addPage([tplW, tplH])
  page.setRotation(degrees(cfg.pageRotationDeg))
  page.setMediaBox(0, 0, tplW, tplH)
  page.setCropBox(0, 0, tplW, tplH)
  page.setBleedBox(0, 0, tplW, tplH)
  page.setTrimBox(0, 0, tplW, tplH)
  page.setArtBox(0, 0, tplW, tplH)
  page.drawPage(embeddedTpl, { x: -tplX, y: -tplY, width: tplW, height: tplH })
  const { width, height } = page.getSize()

  const companyName = safeText(company.company_name) || '—'
  const personLabel = [company.person_title, company.person_name].filter(Boolean).join(' ').trim()
  const contactLine = [personLabel, company.mobile].filter(Boolean).join('. ')

  const textRotate = cfg.textRotateDeg ? degrees(cfg.textRotateDeg) : undefined
  const xLeft = width * cfg.xLeftPct
  const contentMaxW = width - xLeft - 8

  const draw = (text: string, x: number, y: number, size: number, f: typeof fontBold) => {
    page.drawText(text, { x, y, size, font: f, ...(textRotate ? { rotate: textRotate } : {}) })
  }

  const toLine = `To ${companyName}`
  const location = [company.city?.name, company.state?.name, company.country?.name, company.pincode]
    .filter(Boolean)
    .join(', ')
  const fullAddress = [company.address, location].filter(Boolean).join(', ')

  const contentTopY = height * cfg.yProductPct
  const contentBottomY = height * Math.max(0.04, cfg.yMeta2Pct - 0.12)
  const availableHeight = Math.max(0, contentTopY - contentBottomY)

  const stack = fitCompanyLabelStack({
    toLine,
    contactLine,
    fullAddress,
    nameFont: fontBold,
    bodyFont: fontBold,
    contentMaxW,
    availableHeight,
  })

  let y = contentTopY
  let drewBody = false
  for (const line of stack.lines) {
    const size = line.bold ? stack.nameSize : stack.bodySize
    draw(line.text, xLeft, y, size, fontBold)
    if (!line.bold && !drewBody) {
      y -= 2
      drewBody = true
    }
    y -= line.bold ? companyLabelLineHeight(stack.nameSize) : stack.lineHeight
  }

  const bytes = await pdf.save()
  const slug = companyName.replace(/[^\w.-]+/g, '_').slice(0, 40) || 'company'
  openPrintBlob(new Blob([u8ToArrayBuffer(bytes)], { type: 'application/pdf' }), `${slug}-label.pdf`, 'label')
}

function fmtLabelDate(d: string | null | undefined, dateFormat: string) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yy = String(dt.getFullYear() % 100).padStart(2, '0')
  const yyyy = String(dt.getFullYear()).padStart(4, '0')

  const fmt = dateFormat.trim().toLowerCase()
  if (fmt === 'dd/mm/yyyy') return `${dd}/${mm}/${yyyy}`
  if (fmt === 'dd-mm-yyyy') return `${dd}-${mm}-${yyyy}`
  return `${dd}-${mm}-${yy}`
}

async function printLabelPages(
  _kind: string,
  number: string,
  date: string,
  remarks: string,
  items: IOLineItem[],
  products: IOProduct[],
) {
  const { PDFDocument, StandardFonts, rgb, degrees } = await getPdfLib()
  const ab = await fetchArrayBuffer(await getTemplateUrl('label'))
  const src = await PDFDocument.load(ab)

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontSmall = await pdf.embedFont(StandardFonts.Helvetica)

  const tplPage = src.getPage(0)
  const { x: tplX, y: tplY, width: tplW, height: tplH } = tplPage.getMediaBox()
  const [embeddedTpl] = await pdf.embedPdf(src, [0])

  // Build canonical pages at (0,0,width,height). Some thermal drivers are sensitive
  // to shifted page boxes / rotation metadata and may feed an extra blank label.
  const validItems = items.filter(it => it != null && (it.product_id != null && it.product_id !== ''))
  const fallbackLine = { product_id: '', quantity: 0, price: 0 } as any
  const pagesRaw = validItems.length ? validItems : [fallbackLine]
  const seen = new Set<string>()
  const pages = pagesRaw.filter((it) => {
    const pid = String(it.product_id ?? '')
    if (!pid || seen.has(pid)) return false
    seen.add(pid)
    return true
  })
  const pagesFinal = pages.length ? pages : [fallbackLine]
  const cfg = await getLabelPrintConfig()
  const pageRotationDeg = cfg.pageRotationDeg
  const middleBand = cfg.layout === 'middle' || cfg.layout === 'vertical'

  pagesFinal.forEach((it) => {
    const page = pdf.addPage([tplW, tplH])
    page.setRotation(degrees(pageRotationDeg))
    page.setMediaBox(0, 0, tplW, tplH)
    page.setCropBox(0, 0, tplW, tplH)
    page.setBleedBox(0, 0, tplW, tplH)
    page.setTrimBox(0, 0, tplW, tplH)
    page.setArtBox(0, 0, tplW, tplH)
    page.drawPage(embeddedTpl, { x: -tplX, y: -tplY, width: tplW, height: tplH })
    const { width, height } = page.getSize()

    const product = safeText(it.product?.product_name || productNameById(products, it.product_id))
    const refVal = number || '—'
    const dateVal = fmtLabelDate(date, cfg.dateFormat) || '—'

    if (middleBand) {
      const textRotate = cfg.textRotateDeg ? degrees(cfg.textRotateDeg) : undefined
      const allBold = cfg.labelFontBold
      const xLeft = width * cfg.xLeftPct
      const yProduct = height * cfg.yProductPct
      const yMeta1 = height * cfg.yMeta1Pct
      const yMeta2 = height * cfg.yMeta2Pct
      const labelSize = 9
      const valueSize = 10
      const labelProduct = 'PRODUCT'
      const labelRef = 'REF. NO.'
      const labelDate = 'DATE'
      const labelFont = allBold ? font : fontSmall
      const labelColW = Math.max(
        labelFont.widthOfTextAtSize(labelProduct, labelSize),
        labelFont.widthOfTextAtSize(labelRef, labelSize),
        labelFont.widthOfTextAtSize(labelDate, labelSize),
      )
      const colonX = xLeft + labelColW + 6
      const xValue = colonX + labelFont.widthOfTextAtSize(':', labelSize) + 6
      const productMaxW = width - xValue - 8
      const productSize = (() => {
        for (const s of [11, 10, 9, 8]) {
          if (font.widthOfTextAtSize(product || '—', s) <= productMaxW) return s
        }
        return 8
      })()

      const drawPart = (text: string, x: number, y: number, size: number, f: typeof font) => {
        page.drawText(text, { x, y, size, font: f, ...(textRotate ? { rotate: textRotate } : {}) })
      }

      const drawRow = (label: string, value: string, y: number, vSize: number, valueBold = false) => {
        if (allBold) {
          drawPart(label, xLeft, y, labelSize, font)
          drawPart(':', colonX, y, labelSize, font)
          drawPart(value, xValue, y, vSize, font)
        } else {
          drawPart(label, xLeft, y, labelSize, fontSmall)
          drawPart(':', colonX, y, labelSize, fontSmall)
          drawPart(value, xValue, y, vSize, valueBold ? font : fontSmall)
        }
      }

      drawRow(labelProduct, product || '—', yProduct, productSize, true)
      drawRow(labelRef, refVal, yMeta1, valueSize)
      drawRow(labelDate, dateVal, yMeta2, valueSize)

      const r = remarks || safeText(it.remarks ?? '')
      if (r) {
        const rowValueFont = allBold ? font : fontSmall
        const leftBlockEnd = xValue + Math.max(
          rowValueFont.widthOfTextAtSize(product || '—', productSize),
          rowValueFont.widthOfTextAtSize(refVal, valueSize),
          rowValueFont.widthOfTextAtSize(dateVal, valueSize),
        )
        const xRemarksFromPct = width * cfg.remarksXPct
        const xRemarks = cfg.labelRemarksWrap
          ? Math.max(xRemarksFromPct, leftBlockEnd + 10)
          : xRemarksFromPct
        if (cfg.labelRemarksWrap) {
          const remarksFont = allBold ? font : fontSmall
          const remarksSize = 8
          const lineH = 10
          const maxW = width - xRemarks - 6
          const maxLines = Math.max(1, Math.floor((yMeta1 - yMeta2) / lineH) + 1)
          const lines = wrapParagraphLines(r, remarksFont, remarksSize, Math.max(20, maxW)).slice(0, maxLines)
          lines.forEach((line, idx) => {
            drawPart(line, xRemarks, yMeta1 - idx * lineH, remarksSize, remarksFont)
          })
        } else {
          const yRemarks = height * cfg.remarksYPct
          if (cfg.remarksRotateDeg) {
            page.drawText(r, { x: xRemarks, y: yRemarks, size: 8, font: fontSmall, rotate: degrees(cfg.remarksRotateDeg) })
          } else {
            drawPart(r, xRemarks, yRemarks, 8, fontSmall)
          }
        }
      }
    } else {
      const textRotate = cfg.textRotateDeg ? degrees(cfg.textRotateDeg) : undefined
      const showFieldNames = cfg.showFieldNames

      const xLeft = width * cfg.xLeftPct
      const yProduct = height * cfg.yProductPct
      const yMeta1 = height * cfg.yMeta1Pct
      const yMeta2 = height * cfg.yMeta2Pct

      const labelSize = 9
      const labelProduct = 'PRODUCT :'
      const labelRef = 'Ref No. :'
      const labelDate = 'Date :'
      const colonX = xLeft + Math.max(
        showFieldNames ? fontSmall.widthOfTextAtSize(labelProduct, labelSize) : 0,
        fontSmall.widthOfTextAtSize(labelRef, labelSize),
        fontSmall.widthOfTextAtSize(labelDate, labelSize),
      )
      const xValue = colonX + 5

      const productMaxW = width * 0.50
      const productSize = (() => {
        for (const s of [16, 13, 11, 9]) {
          if (font.widthOfTextAtSize(product || '—', s) <= productMaxW) return s
        }
        return 9
      })()

      const draw = (text: string, x: number, y: number, size: number, f: typeof font) => {
        page.drawText(text, { x, y, size, font: f, ...(textRotate ? { rotate: textRotate } : {}) })
      }

      if (showFieldNames) {
        draw(labelProduct, colonX - fontSmall.widthOfTextAtSize(labelProduct, labelSize), yProduct, labelSize, fontSmall)
        draw(product || '—', xValue, yProduct, productSize, font)
      } else {
        draw(product || '—', xLeft, yProduct, productSize, font)
      }
      draw(labelRef, colonX - fontSmall.widthOfTextAtSize(labelRef, labelSize), yMeta1, labelSize, fontSmall)
      draw(refVal, xValue, yMeta1, 10, fontSmall)
      draw(labelDate, colonX - fontSmall.widthOfTextAtSize(labelDate, labelSize), yMeta2, labelSize, fontSmall)
      draw(dateVal, xValue, yMeta2, 10, fontSmall)

      const r = remarks || safeText(it.remarks ?? '')
      if (r) {
        const x = width * 0.58
        const y = yMeta1
        const size = 8
        const maxW = width - x - 6
        const lineH = 10
        const lines = wrapParagraphLines(r, fontSmall, size, Math.max(20, maxW)).slice(0, 4)
        lines.forEach((line, idx) => {
          draw(line, x, y - idx * lineH, size, fontSmall)
        })
      }
    }
  })

  const bytes = await pdf.save()
  openPrintBlob(new Blob([u8ToArrayBuffer(bytes)], { type: 'application/pdf' }), `${number || 'label'}.pdf`, 'label')
}