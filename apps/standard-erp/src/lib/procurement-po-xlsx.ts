import type { Alignment, Borders, Fill, Font, Worksheet } from 'exceljs'
import { amountInWordsInr } from '@/lib/amount-in-words'
import {
  padAddressLines,
  poFilename,
  poInstructionLines,
  resolvePoTax,
  type ProcurementPoDocData,
} from '@/lib/procurement-po-format'
import { loadPoLogo } from '@/lib/procurement-po-logo'

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } }
const BORDER: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const WHITE: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
const Arial = (size: number, bold = false, italic = false): Partial<Font> => ({
  name: 'Arial',
  size,
  bold,
  italic,
  color: { argb: 'FF000000' },
})
const wrapCenter: Partial<Alignment> = {
  wrapText: true,
  vertical: 'middle',
  horizontal: 'center',
}
const wrapLeft: Partial<Alignment> = {
  wrapText: true,
  vertical: 'middle',
  horizontal: 'left',
}
const wrapRight: Partial<Alignment> = {
  wrapText: true,
  vertical: 'middle',
  horizontal: 'right',
}

const LINE_START = 18
const LINE_END = 23

function cell(ws: Worksheet, addr: string) {
  return ws.getCell(addr)
}

function paint(ws: Worksheet, addr: string, opts: {
  value?: string | number | Date
  font?: Partial<Font>
  align?: Partial<Alignment>
  numFmt?: string
  bordered?: boolean
}) {
  const c = cell(ws, addr)
  if (opts.value !== undefined) c.value = opts.value
  c.font = opts.font ?? Arial(12)
  c.alignment = opts.align ?? wrapLeft
  c.border = opts.bordered === false ? {} : BORDER
  c.fill = WHITE
  if (opts.numFmt) c.numFmt = opts.numFmt
  return c
}

function merge(ws: Worksheet, range: string) {
  ws.mergeCells(range)
}

/**
 * Excel purchase order matching the commercial "other party" sheet:
 * letterhead, consigner/consignee, GST lines, item grid, tax, T&C.
 * Values come from the issuing factory and selected vendor — no client name is baked in.
 */
export async function buildProcurementPoWorkbook(data: ProcurementPoDocData) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MADSTOQ'
  wb.created = new Date()

  const ws = wb.addWorksheet('Purchase Order', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.07, right: 0.18, top: 0.85, bottom: 0.43, header: 0.3, footer: 0.21 },
    },
    views: [{ showGridLines: true, zoomScale: 85 }],
  })

  ws.columns = [
    { width: 9.14 },
    { width: 16.57 },
    { width: 9.71 },
    { width: 35.57 },
    { width: 14 },
    { width: 11.29 },
    { width: 16.57 },
    { width: 23.57 },
    { width: 26.71 },
  ]

  const tax = resolvePoTax(data)
  const vendorLines = padAddressLines(data.vendorAddress, 4)
  const companyLines = padAddressLines(data.companyAddress, 4)
  const deliveryPlace = (data.deliveryPlace || '').trim() || '—'
  const schedule = (data.scheduleDate || data.deliverySchedule || '').trim() || '—'
  const transporter = (data.transporter || '').trim() || '-'
  const remarks = [data.lineRemarks, data.qualityRef].filter(Boolean).join(' · ') || '-'
  const instructionLines = poInstructionLines(data.specialInstructions)
  const logo = await loadPoLogo(data)

  const merges = [
    ...(logo ? (['B1:C1', 'D1:I1'] as const) : (['B1:I1'] as const)),
    'B2:I2', 'B7:C7', 'D7:F7', 'G7:H7',
    'B8:C8', 'D8:F8', 'G8:H8', 'B9:I9',
    'C10:F10', 'H10:I10',
    'B11:B14', 'C11:F11', 'C12:F12', 'C13:F13', 'C14:F14',
    'G11:G14', 'H11:I11', 'H12:I12', 'H13:I13', 'H14:I14',
    'C15:F15', 'H15:I15', 'B16:I16',
    'C17:D17',
    'C18:D18', 'C19:D19', 'C20:D20', 'C21:D21', 'C22:D22', 'C23:D23',
    'B24:F24', 'B25:H25', 'B26:H26', 'B27:H27', 'B28:H28',
    'B29:I29', 'B30:C30', 'D30:I30', 'B31:I31', 'B32:I32',
    'B33:C33', 'D33:I33', 'B34:C34', 'D34:I34', 'B35:C35', 'D35:I35',
    'B36:I36', 'B37:I37', 'B38:I38', 'B39:I39', 'B40:I40', 'B41:I41', 'B42:I42', 'B43:I43',
    'B44:G45', 'H44:I44', 'H45:I45', 'B46:I46',
  ]
  for (const range of merges) merge(ws, range)

  // Letterhead: logo + company name on row 1, PURCHASE ORDER on row 2.
  for (let r = 1; r <= 6; r++) {
    for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const) {
      const c = cell(ws, `${col}${r}`)
      c.fill = WHITE
      c.border = {}
    }
  }
  for (let r = 7; r <= 46; r++) {
    if (r === 9) continue
    for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const) {
      const c = cell(ws, `${col}${r}`)
      c.border = BORDER
      c.fill = WHITE
    }
  }
  for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const) {
    cell(ws, `${col}9`).fill = WHITE
    cell(ws, `${col}9`).border = {}
  }

  ws.getRow(1).height = 56
  ws.getRow(2).height = 22
  ws.getRow(3).height = 0
  ws.getRow(4).height = 0
  ws.getRow(5).height = 0
  ws.getRow(6).height = 10
  ws.getRow(7).height = 19.5
  ws.getRow(8).height = 21
  ws.getRow(10).height = 22
  ws.getRow(17).height = 44.25
  ws.getRow(38).height = 24.75
  ws.getRow(39).height = 38.25
  ws.getRow(40).height = 54.75
  ws.getRow(45).height = 40.5

  paint(ws, logo ? 'D1' : 'B1', {
    value: data.companyName.toUpperCase(),
    font: Arial(22, true),
    align: { wrapText: false, vertical: 'middle', horizontal: 'center' },
    bordered: false,
  })
  paint(ws, 'B2', {
    value: 'PURCHASE ORDER',
    font: Arial(16, true, true),
    align: wrapCenter,
    bordered: false,
  })

  paint(ws, 'B7', { value: 'Po No.', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'D7', { value: data.poNumber, font: Arial(12), align: wrapLeft })
  paint(ws, 'G7', { value: 'Delivery Place', font: Arial(12, true), align: wrapLeft })
  paint(ws, 'I7', { value: deliveryPlace, font: Arial(12), align: wrapLeft })

  paint(ws, 'B8', { value: 'Po Date', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'D8', { value: data.poDate, font: Arial(12), align: wrapLeft })
  paint(ws, 'G8', { value: 'Date of Schedule', font: Arial(12, true), align: wrapLeft })
  paint(ws, 'I8', { value: schedule, font: Arial(12), align: wrapLeft })

  paint(ws, 'B10', { value: 'Consigner,', font: Arial(13, true), align: wrapLeft })
  paint(ws, 'C10', {
    value: data.vendorName,
    font: Arial(14, true),
    align: { wrapText: false, vertical: 'middle', horizontal: 'left' },
  })
  paint(ws, 'G10', { value: 'Consignee,', font: Arial(13, true), align: wrapLeft })
  paint(ws, 'H10', {
    value: data.companyName,
    font: Arial(14, true),
    align: { wrapText: false, vertical: 'middle', horizontal: 'left' },
  })

  paint(ws, 'B11', { value: 'Address', font: Arial(12, true), align: { ...wrapCenter, textRotation: 0 } })
  paint(ws, 'C11', { value: vendorLines[0], font: Arial(12), align: wrapLeft })
  paint(ws, 'C12', { value: vendorLines[1], font: Arial(12), align: wrapLeft })
  paint(ws, 'C13', { value: vendorLines[2], font: Arial(12), align: wrapLeft })
  paint(ws, 'C14', { value: vendorLines[3], font: Arial(12), align: wrapLeft })

  paint(ws, 'G11', { value: 'Consignee Billing Address:', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'H11', { value: companyLines[0], font: Arial(12), align: wrapLeft })
  paint(ws, 'H12', { value: companyLines[1], font: Arial(12), align: wrapLeft })
  paint(ws, 'H13', { value: companyLines[2], font: Arial(12), align: wrapLeft })
  paint(ws, 'H14', { value: companyLines[3], font: Arial(12), align: wrapLeft })

  paint(ws, 'B15', { value: 'Gst No.', font: Arial(14, true), align: wrapLeft })
  paint(ws, 'C15', { value: data.vendorGstin || '—', font: Arial(12), align: wrapLeft })
  paint(ws, 'G15', { value: 'Gst No.', font: Arial(14, true), align: wrapLeft })
  paint(ws, 'H15', { value: data.companyGstin || '—', font: Arial(12), align: wrapLeft })

  paint(ws, 'B17', { value: 'Sr. No.', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'C17', { value: 'Item Description', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'E17', { value: 'Hsn No.', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'F17', { value: 'Unit', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'G17', { value: 'Quantity', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'H17', { value: 'Delivered Rate', font: Arial(12, true), align: wrapCenter })
  paint(ws, 'I17', { value: 'Amount', font: Arial(12, true), align: wrapCenter })

  const qtyFmt = '#,##0.000'
  const moneyFmt = '_ * #,##0.00_ ;_ * -#,##0.00_ ;_ * "-"??_ ;_ @_ '

  for (let r = LINE_START; r <= LINE_END; r++) {
    const isFirst = r === LINE_START
    paint(ws, `B${r}`, { value: isFirst ? 1 : '', font: Arial(12), align: wrapCenter })
    paint(ws, `C${r}`, {
      value: isFirst ? data.materialType : '',
      font: Arial(12, isFirst),
      align: wrapLeft,
    })
    paint(ws, `E${r}`, { value: isFirst ? data.hsnCode || '' : '', font: Arial(12), align: wrapCenter })
    paint(ws, `F${r}`, { value: isFirst ? data.unit : '', font: Arial(12), align: wrapCenter })
    paint(ws, `G${r}`, {
      value: isFirst ? data.qty : '',
      font: Arial(12),
      align: wrapRight,
      numFmt: qtyFmt,
    })
    paint(ws, `H${r}`, {
      value: isFirst ? data.pricePerUnit : '',
      font: Arial(12),
      align: wrapRight,
      numFmt: moneyFmt,
    })
    const amount = cell(ws, `I${r}`)
    amount.value = { formula: `G${r}*H${r}` }
    amount.font = Arial(12)
    amount.alignment = wrapRight
    amount.numFmt = moneyFmt
    amount.border = BORDER
    amount.fill = WHITE
  }

  paint(ws, 'B24', { value: 'Total Qty', font: Arial(12, true), align: wrapLeft })
  cell(ws, 'G24').value = { formula: `SUM(G${LINE_START}:G${LINE_END})` }
  cell(ws, 'G24').numFmt = qtyFmt
  cell(ws, 'G24').font = Arial(12, true)
  cell(ws, 'G24').alignment = wrapRight
  cell(ws, 'G24').border = BORDER
  cell(ws, 'I24').value = { formula: `SUM(I${LINE_START}:I${LINE_END})` }
  cell(ws, 'I24').numFmt = moneyFmt
  cell(ws, 'I24').font = Arial(12, true)
  cell(ws, 'I24').alignment = wrapRight
  cell(ws, 'I24').border = BORDER

  paint(ws, 'B25', { value: `CGST ${tax.cgstRate}%`, font: Arial(12, true), align: wrapLeft })
  cell(ws, 'I25').value = { formula: `I24*${tax.cgstRate}%` }
  cell(ws, 'I25').numFmt = moneyFmt
  cell(ws, 'I25').font = Arial(12)
  cell(ws, 'I25').alignment = wrapRight
  cell(ws, 'I25').border = BORDER

  paint(ws, 'B26', { value: `SGST ${tax.sgstRate}%`, font: Arial(12, true), align: wrapLeft })
  cell(ws, 'I26').value = { formula: 'I25' }
  cell(ws, 'I26').numFmt = moneyFmt
  cell(ws, 'I26').font = Arial(12)
  cell(ws, 'I26').alignment = wrapRight
  cell(ws, 'I26').border = BORDER
  if (tax.sgstRate !== tax.cgstRate) {
    cell(ws, 'I26').value = { formula: `I24*${tax.sgstRate}%` }
  }

  paint(ws, 'B27', { value: tax.igstRate ? `IGST ${tax.igstRate}%` : 'IGST', font: Arial(12, true), align: wrapLeft })
  cell(ws, 'I27').value = tax.igstRate ? { formula: `I24*${tax.igstRate}%` } : 0
  cell(ws, 'I27').numFmt = moneyFmt
  cell(ws, 'I27').font = Arial(12)
  cell(ws, 'I27').alignment = wrapRight
  cell(ws, 'I27').border = BORDER

  paint(ws, 'B28', { value: 'Total Amount', font: Arial(12, true), align: wrapLeft })
  cell(ws, 'I28').value = { formula: 'I24+I25+I26+I27' }
  cell(ws, 'I28').numFmt = moneyFmt
  cell(ws, 'I28').font = Arial(12, true)
  cell(ws, 'I28').alignment = wrapRight
  cell(ws, 'I28').border = BORDER

  paint(ws, 'B30', { value: 'Amount In Word', font: Arial(12, true), align: wrapLeft })
  paint(ws, 'D30', { value: amountInWordsInr(tax.grand), font: Arial(12, true), align: wrapLeft })

  paint(ws, 'B32', { value: 'Terms & Condition :-', font: Arial(14, true), align: wrapLeft })
  paint(ws, 'B33', { value: 'Payment Terms', font: Arial(12, true), align: wrapLeft })
  paint(ws, 'D33', { value: data.paymentTerms, font: Arial(12), align: wrapLeft })
  paint(ws, 'B34', { value: 'Transporter', font: Arial(12, true), align: wrapLeft })
  paint(ws, 'D34', { value: transporter, font: Arial(12), align: wrapLeft })
  paint(ws, 'B35', { value: 'Other Remarks', font: Arial(12, true), align: wrapLeft })
  paint(ws, 'D35', { value: remarks, font: Arial(12), align: wrapLeft })

  paint(ws, 'B37', { value: ' Special Instructions :-', font: Arial(14, true), align: wrapLeft })
  instructionLines.forEach((term, i) => {
    paint(ws, `B${38 + i}`, {
      value: term,
      font: Arial(12),
      align: wrapLeft,
    })
  })

  paint(ws, 'H44', {
    value: `For, ${data.companyName}`,
    font: Arial(16, true),
    align: wrapCenter,
  })
  paint(ws, 'H45', {
    value: 'Electronically Approved',
    font: Arial(16, true),
    align: wrapCenter,
  })
  paint(ws, 'B46', {
    value: '*** This is Computer Generated Document, No Signature Required. ***',
    font: Arial(12, true),
    align: wrapCenter,
  })

  if (logo) {
    const imageId = wb.addImage({
      buffer: typeof Buffer !== 'undefined' ? Buffer.from(logo.bytes) : logo.bytes,
      extension: logo.extension,
    })
    // Logo left of row 1; company name centered in D1:I1; PURCHASE ORDER is row 2.
    ws.addImage(imageId, {
      tl: { col: 1.05, row: 0.1 },
      ext: { width: 210, height: 50 },
      editAs: 'oneCell',
    })
  }

  return wb
}

export async function downloadProcurementPoXlsx(data: ProcurementPoDocData) {
  const wb = await buildProcurementPoWorkbook(data)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = poFilename(data.poNumber, 'xlsx')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return true
}
