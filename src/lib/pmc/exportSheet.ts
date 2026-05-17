import type { PMCProduct, PMCPricingResult, PMCReference } from './types'

function safeFilename(part: string): string {
  return part.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 80)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type SheetExportInput = {
  product: PMCProduct
  reference: PMCReference
  result: PMCPricingResult
}

async function buildWorkbook(sheets: SheetExportInput[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PMC Portal'
  wb.created = new Date()

  for (const { product, reference, result } of sheets) {
    const wsName = reference.ref_number.slice(0, 31)
    const ws = wb.addWorksheet(wsName)

    const title = ws.addRow([`Pricing sheet — ${product.name}`])
    title.font = { bold: true, size: 14 }
    ws.addRow(['Reference', reference.ref_number])
    ws.addRow(['Date', new Date(reference.created_at).toLocaleString()])
    if (product.code) ws.addRow(['Product code', product.code])
    ws.addRow([])

    const paramHeader = ws.addRow(['Parameter', 'Value'])
    paramHeader.font = { bold: true }
    ws.addRow(['Overhead', result.overhead])
    ws.addRow(['Batch multiplier', result.batch_multiplier])
    ws.addRow(['Yield', result.yield_value])
    ws.addRow(['Primary material', `${result.primary_material_name} (${result.primary_material_qty})`])
    ws.addRow(['Real Final Product', result.real_final_product])
    ws.addRow([])

    const headers = ['Raw material', 'Primary', 'Base qty', 'Effective qty', 'Price', 'Line total']
    const hRow = ws.addRow(headers)
    hRow.font = { bold: true, size: 11 }
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E0F7' } }
    hRow.alignment = { vertical: 'middle' }

    for (const line of result.lines) {
      ws.addRow([
        line.raw_material_name,
        line.is_primary ? 'Yes' : 'No',
        line.base_qty,
        line.effective_qty,
        line.price,
        line.line_total,
      ])
    }

    const totalRow = ws.addRow(['Material total', '', '', '', '', result.material_total])
    totalRow.font = { bold: true }
    ws.addRow([])
    ws.addRow(['Unit before overhead', result.unit_before_overhead])
    ws.addRow(['Overhead', result.overhead])
    const rmcRow = ws.addRow(['Final RMC', result.final_rmc])
    rmcRow.font = { bold: true, size: 12 }

    ws.columns.forEach((col, i) => {
      const widths = [28, 10, 12, 14, 12, 16]
      col.width = widths[i] ?? 14
    })
    ws.getColumn(3).numFmt = '#,##0.00'
    ws.getColumn(4).numFmt = '#,##0.00'
    ws.getColumn(5).numFmt = '#,##0.00'
    ws.getColumn(6).numFmt = '#,##0.00'
  }

  return wb
}

export async function exportPricingSheetToXlsx(input: SheetExportInput): Promise<void> {
  const wb = await buildWorkbook([input])
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const name = safeFilename(
    `${input.product.name}_${input.reference.ref_number}_pricing.xlsx`
  )
  triggerDownload(blob, name)
}

export async function exportProductPricingSheetsToXlsx(
  product: PMCProduct,
  sheets: { reference: PMCReference; result: PMCPricingResult }[]
): Promise<void> {
  if (sheets.length === 0) return
  const wb = await buildWorkbook(
    sheets.map(({ reference, result }) => ({ product, reference, result }))
  )
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const name = safeFilename(`${product.name}_pricing_sheets.xlsx`)
  triggerDownload(blob, name)
}
