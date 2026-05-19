import path from 'path'
import { promises as fs } from 'fs'
import { PDFDocument } from 'pdf-lib'
import type { SalesDocument, SalesOrg } from './types/index'

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

const TEMPLATE_CANDIDATES = [
  'public/billing.pdf',
  'public/letter-head.pdf',
  'public/io-pdfs/letter-head.pdf',
]

async function loadTemplate(): Promise<Buffer | null> {
  for (const rel of TEMPLATE_CANDIDATES) {
    const abs = path.join(process.cwd(), rel)
    try {
      const buf = await fs.readFile(abs)
      return buf
    } catch { /* try next */ }
  }
  return null
}

const HEADING_BY_TYPE: Record<SalesDocument['doc_type'], string> = {
  quotation: 'QUOTATION',
  purchase_order: 'PURCHASE ORDER',
  invoice: 'TAX INVOICE',
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function fmtDate(d?: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return d
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

/** Build the HTML document that puppeteer renders into a transparent body PDF. */
export function buildBodyHtml(doc: SalesDocument, org: SalesOrg) {
  const heading = HEADING_BY_TYPE[doc.doc_type]
  const total = doc.total_amount != null ? `₹${Number(doc.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 130px 32px 90px 32px; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; line-height: 1.45; }
  h1, h2, h3 { margin: 0; padding: 0; }
  .meta-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .meta-row .left h1 { font-size: 16px; letter-spacing: 0.18em; }
  .meta-row .right { font-size: 10px; text-align: right; }
  .meta-row .right .num { font-size: 14px; font-weight: bold; }
  .recipient { padding: 10px 12px; border: 1px solid #d4d4d8; border-radius: 6px; margin-bottom: 14px; background: rgba(255,255,255,0.85); }
  .recipient .label { font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: #71717a; margin-bottom: 4px; }
  .recipient .company { font-size: 13px; font-weight: bold; }
  .subject { font-size: 12px; font-weight: bold; margin-bottom: 8px; }
  .body p { margin: 0 0 6px; }
  .body table { border-collapse: collapse; width: 100%; margin: 8px 0; table-layout: fixed; }
  .body th, .body td { border: 1px solid #c4c4c4; padding: 6px 8px; vertical-align: top; word-wrap: break-word; }
  .body th { background: #f3f4f6; font-weight: 600; }
  .body h1 { font-size: 16px; margin: 8px 0; }
  .body h2 { font-size: 14px; margin: 8px 0; }
  .body h3 { font-size: 12px; margin: 8px 0; }
  .total-row { margin-top: 14px; text-align: right; font-size: 12px; font-weight: bold; }
</style>
</head>
<body>
  <div class="meta-row">
    <div class="left">
      <h1>${escapeHtml(heading)}</h1>
    </div>
    <div class="right">
      <div class="num">${escapeHtml(doc.doc_number)}</div>
      <div>Date: ${escapeHtml(fmtDate(doc.doc_date))}</div>
    </div>
  </div>

  <div class="recipient">
    <div class="label">To</div>
    <div class="company">${escapeHtml(doc.to_company ?? '')}</div>
    ${doc.to_contact_person ? `<div>Kind Attn: ${escapeHtml(doc.to_contact_person)}${doc.to_phone ? ' · ' + escapeHtml(doc.to_phone) : ''}</div>` : ''}
    ${doc.to_address ? `<div style="white-space:pre-wrap">${escapeHtml(doc.to_address)}</div>` : ''}
    ${doc.to_email ? `<div>${escapeHtml(doc.to_email)}</div>` : ''}
  </div>

  ${doc.subject ? `<div class="subject">Subject: ${escapeHtml(doc.subject)}</div>` : ''}

  <div class="body">${doc.body_html ?? ''}</div>

  ${total ? `<div class="total-row">Total: ${escapeHtml(total)}</div>` : ''}
</body></html>`
}

export async function renderBodyPdfBuffer(html: string): Promise<Buffer> {
  // Lazy-import puppeteer so dev/serverless cold-starts pay the cost only on render.
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.default.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: false,
      margin: { top: '130px', right: '32px', bottom: '90px', left: '32px' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

/** Stamp every page of a body PDF on top of the static template's first page. */
export async function composeWithTemplate(bodyPdfBytes: Buffer): Promise<Buffer> {
  const tplBuf = await loadTemplate()
  const bodyDoc = await PDFDocument.load(bodyPdfBytes)

  if (!tplBuf) {
    // No template available — return body alone.
    return Buffer.from(await bodyDoc.save())
  }

  const tplDoc = await PDFDocument.load(tplBuf)
  const finalDoc = await PDFDocument.create()

  const tplFirstIdx = 0
  const [embeddedTpl] = await finalDoc.embedPdf(tplDoc, [tplFirstIdx])

  for (let i = 0; i < bodyDoc.getPageCount(); i++) {
    const newPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT])
    newPage.drawPage(embeddedTpl, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT })
    const [embeddedBody] = await finalDoc.embedPdf(bodyDoc, [i])
    newPage.drawPage(embeddedBody, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT })
  }

  return Buffer.from(await finalDoc.save())
}

export async function renderDocumentPdf(doc: SalesDocument, org: SalesOrg): Promise<Buffer> {
  const html = buildBodyHtml(doc, org)
  const body = await renderBodyPdfBuffer(html)
  return composeWithTemplate(body)
}
