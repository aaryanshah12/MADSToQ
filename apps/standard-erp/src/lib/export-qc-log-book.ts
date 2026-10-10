import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import {
  logBookCell,
  logBookColumnWidths,
  logBookColumns,
  logBookHeaderRows,
  logBookIdLine,
  logBookTitle,
  parseInstrumentDocMeta,
  sanitizeLogBookFilename,
  type LogBookEntryRow,
} from '@/lib/qc-log-book'

export type { LogBookEntryRow }

export type LogBookExportInstrument = {
  code: string
  name: string
  type: string
  doc_meta?: unknown
}

export type LogBookExportFactory = {
  name: string
  company_address?: string | null
  location?: string | null
}

const A4 = { w: 595.28, h: 841.89 }
const INK = { r: 0, g: 0, b: 0 }

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function pdfSafeText(text: string): string {
  return text
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00B0C/gi, 'C')
    .replace(/\u00B0/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

function wrapLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = pdfSafeText(text).replace(/\r/g, '').split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
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
  }
  return lines.length ? lines : ['']
}

type AbsHeaderCell = {
  text: string
  col: number
  span: number
  row: number
  rowSpan: number
}

function absoluteHeaderCells(type: string): AbsHeaderCell[] {
  const rows = logBookHeaderRows(type)
  const occupied: boolean[][] = [[], []]
  const out: AbsHeaderCell[] = []
  rows.forEach((row, ri) => {
    let col = row.offset
    for (const cell of row.cells) {
      while (occupied[ri]?.[col]) col += 1
      const rowSpan = cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : 1
      out.push({ text: cell.text, col, span: cell.span, row: ri, rowSpan })
      for (let r = ri; r < ri + rowSpan; r++) {
        const rowOcc = occupied[r] ?? []
        occupied[r] = rowOcc
        for (let c = col; c < col + cell.span; c++) rowOcc[c] = true
      }
      col += cell.span
    }
  })
  return out
}

async function embedLetterheadLogo(
  pdf: { embedPng: (bytes: ArrayBuffer) => Promise<PDFImage> },
  factoryName: string,
): Promise<PDFImage | null> {
  if (!/ananta/i.test(factoryName)) return null
  try {
    const res = await fetch('/ananta-fine-chem-logo.png')
    if (!res.ok) return null
    return await pdf.embedPng(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** Paper-style A4 register matching the lab Word log books. */
export async function buildQcLogBookPdf(opts: {
  factory: LogBookExportFactory
  instrument: LogBookExportInstrument
  entries: LogBookEntryRow[]
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const black = rgb(INK.r, INK.g, INK.b)
  const logo = await embedLetterheadLogo(pdf, opts.factory.name)

  const meta = parseInstrumentDocMeta(opts.instrument.doc_meta)
  const title = logBookTitle(opts.instrument)
  const address = (opts.factory.company_address || '').trim()
  const idLine = logBookIdLine(opts.instrument)
  const columns = logBookColumns(opts.instrument.type)
  const headerCells = absoluteHeaderCells(opts.instrument.type)
  const headerRowCount = Math.max(1, ...headerCells.map((c) => c.row + c.rowSpan))

  const marginX = 36
  const marginTop = 28
  const marginBottom = 32
  const tableW = A4.w - marginX * 2
  const rawWidths = logBookColumnWidths(opts.instrument.type)
  const widthSum = rawWidths.reduce((a, b) => a + b, 0) || 1
  const colW = rawWidths.map((w) => (w / widthSum) * tableW)
  const colX: number[] = []
  {
    let x = marginX
    for (const w of colW) {
      colX.push(x)
      x += w
    }
  }
  const spanW = (start: number, span: number) =>
    colW.slice(start, start + span).reduce((a, b) => a + b, 0)

  const lineW = 0.8
  const nameH = 56
  const bandH = 20
  const idH = 18
  const letterH = nameH + bandH * (meta.annexure ? 2 : 1) + idH
  const colHeaderRowH = headerRowCount > 1 ? [28, 16] : [28]
  const colHeaderH = colHeaderRowH.slice(0, headerRowCount).reduce((a, b) => a + b, 0)
  const rowH = 20
  const footerH = 18
  const dataTop = A4.h - marginTop - letterH
  const dataBottom = marginBottom + footerH
  const rowsPerPage = Math.max(10, Math.floor((dataTop - colHeaderH - dataBottom) / rowH))
  const totalPages = Math.max(1, Math.ceil(Math.max(opts.entries.length, 1) / rowsPerPage))

  const strokeRect = (page: PDFPage, x: number, y: number, w: number, h: number) => {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: black,
      borderWidth: lineW,
    })
  }

  const centerText = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    bold: boolean,
  ) => {
    const f = bold ? fontBold : font
    const lines = wrapLines(text, f, size, Math.max(12, w - 6))
    const lineH = size + 1.8
    const block = lines.length * lineH
    let baseline = y + (h + block) / 2 - size
    for (const line of lines) {
      const tw = f.widthOfTextAtSize(line, size)
      page.drawText(line, {
        x: x + Math.max(3, (w - tw) / 2),
        y: baseline,
        size,
        font: f,
        color: black,
      })
      baseline -= lineH
    }
  }

  const leftText = (page: PDFPage, text: string, x: number, y: number, size: number, bold: boolean) => {
    page.drawText(pdfSafeText(text), {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      color: black,
    })
  }

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const page = pdf.addPage([A4.w, A4.h])
    let top = A4.h - marginTop

    const leftW = tableW * 0.33
    const rightW = tableW - leftW
    strokeRect(page, marginX, top - nameH, tableW, nameH)
    page.drawLine({
      start: { x: marginX + leftW, y: top },
      end: { x: marginX + leftW, y: top - nameH },
      thickness: lineW,
      color: black,
    })
    if (logo) {
      const scaled = logo.scale(Math.min((leftW - 12) / logo.width, (nameH - 10) / logo.height))
      page.drawImage(logo, {
        x: marginX + (leftW - scaled.width) / 2,
        y: top - nameH + (nameH - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      })
    }
    const nameSize = 12
    const name = pdfSafeText(opts.factory.name.toUpperCase())
    const nameTw = fontBold.widthOfTextAtSize(name, nameSize)
    page.drawText(name, {
      x: marginX + leftW + Math.max(4, (rightW - nameTw) / 2),
      y: top - 20,
      size: nameSize,
      font: fontBold,
      color: black,
    })
    if (address) {
      centerText(page, address, marginX + leftW, top - nameH, rightW, 34, 9, true)
    }
    top -= nameH

    if (meta.annexure) {
      strokeRect(page, marginX, top - bandH, tableW, bandH)
      centerText(page, `ANNEXURE - ${meta.annexure}`, marginX, top - bandH, tableW, bandH, 11, true)
      top -= bandH
    }

    strokeRect(page, marginX, top - bandH, tableW, bandH)
    centerText(page, title.toUpperCase(), marginX, top - bandH, tableW, bandH, 12, true)
    top -= bandH

    strokeRect(page, marginX, top - idH, tableW, idH)
    if (idLine) {
      leftText(page, idLine, marginX + 8, top - idH + 4, 11, true)
    }
    const pageLabel = `Page ${pageIndex + 1} of ${totalPages}`
    const pageTw = fontBold.widthOfTextAtSize(pageLabel, 11)
    leftText(page, pageLabel, marginX + tableW - pageTw - 8, top - idH + 4, 11, true)
    top -= idH

    const headerTop = top
    const rowHAt = (row: number) => colHeaderRowH[row] ?? 18
    const rowY = (row: number, rowSpan: number) => {
      let above = 0
      for (let r = 0; r < row; r++) above += rowHAt(r)
      let h = 0
      for (let r = row; r < row + rowSpan; r++) h += rowHAt(r)
      return { y: headerTop - above - h, h }
    }
    for (const cell of headerCells) {
      const x = colX[cell.col] ?? marginX
      const w = spanW(cell.col, cell.span)
      const { y, h } = rowY(cell.row, cell.rowSpan)
      strokeRect(page, x, y, w, h)
      centerText(page, cell.text, x, y, w, h, 8, true)
    }

    const start = pageIndex * rowsPerPage
    const pageEntries = opts.entries.slice(start, start + rowsPerPage)
    const rows: string[][] = [
      ...pageEntries.map((entry) => columns.map((col) => logBookCell(entry, col))),
      ...Array.from({ length: rowsPerPage - pageEntries.length }, () => columns.map(() => '')),
    ]

    let rowTop = headerTop - colHeaderH
    for (const values of rows) {
      const y = rowTop - rowH
      values.forEach((value, i) => {
        const x = colX[i] ?? marginX
        const w = colW[i] ?? 40
        strokeRect(page, x, y, w, rowH)
        if (value) centerText(page, value, x, y, w, rowH, 8, false)
      })
      rowTop = y
    }

    if (meta.form_code) {
      leftText(page, meta.form_code, marginX, marginBottom, 10, false)
    }
  }

  return new Uint8Array(await pdf.save())
}

function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const copy = Uint8Array.from(bytes)
  triggerDownload(
    new Blob([copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength)], {
      type: 'application/pdf',
    }),
    filename,
  )
}

export async function exportQcLogBookPdf(opts: {
  factory: LogBookExportFactory
  instrument: LogBookExportInstrument
  entries: LogBookEntryRow[]
}): Promise<void> {
  downloadPdfBytes(await buildQcLogBookPdf(opts), `${sanitizeLogBookFilename(opts.instrument.code)}.pdf`)
}

export async function exportQcLogBooksPdf(opts: {
  factory: LogBookExportFactory
  books: Array<{ instrument: LogBookExportInstrument; entries: LogBookEntryRow[] }>
  filename: string
}): Promise<void> {
  if (opts.books.length === 0) throw new Error('Select at least one log book')
  if (opts.books.length === 1) {
    downloadPdfBytes(await buildQcLogBookPdf({ factory: opts.factory, ...opts.books[0] }), opts.filename)
    return
  }
  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.create()
  for (const book of opts.books) {
    const bytes = await buildQcLogBookPdf({ factory: opts.factory, ...book })
    const src = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(src, src.getPageIndices())
    for (const page of pages) merged.addPage(page)
  }
  downloadPdfBytes(await merged.save(), opts.filename)
}
