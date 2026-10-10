import { amountInWordsInr } from '@/lib/amount-in-words'
import {
  fmtMoney,
  fmtQty,
  padAddressLines,
  poInstructionLines,
  poDocLines,
  resolvePoTax,
  type ProcurementPoDocData,
} from '@/lib/procurement-po-format'

export type { ProcurementPoDocData as ProcurementPoHtmlData }

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function addrCell(line: string) {
  return line ? esc(line) : '&nbsp;'
}

/** Full PO HTML matching the commercial letterhead (PDF download, print, vendor email). */
export function buildProcurementPoHtml(data: ProcurementPoDocData): string {
  const tax = resolvePoTax(data)
  const lines = poDocLines(data)
  const vendorLines = padAddressLines(data.vendorAddress, 4)
  const companyLines = padAddressLines(data.companyAddress, 4)
  const deliveryPlace = (data.deliveryPlace || '').trim() || '—'
  const schedule = (data.scheduleDate || data.deliverySchedule || '').trim() || '—'
  const transporter = (data.transporter || '').trim() || '-'
  const remarks = [data.lineRemarks, data.qualityRef].filter(Boolean).join(' · ') || '-'
  const logoSrc = data.logoUrl?.trim()

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(data.poNumber)} — Purchase Order</title>
  <style>
    @page { size: A4; margin: 8mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; margin: 0; }
    .letterhead { margin: 0 0 6px; }
    .letterhead-row {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 64px;
    }
    .letterhead-logo {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      height: 58px;
      width: auto;
      max-width: 230px;
      object-fit: contain;
      background: transparent;
    }
    .letterhead-name {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      text-align: center;
      white-space: nowrap;
      line-height: 1.15;
    }
    .letterhead-title {
      font-size: 16px;
      font-weight: 700;
      font-style: italic;
      text-align: center;
      white-space: nowrap;
      padding: 2px 0 8px;
    }
    table.sheet { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.sheet td, table.sheet th {
      border: 1px solid #000; padding: 4px 6px; vertical-align: middle;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    table.sheet td.gap { border: none; height: 8px; padding: 0; }
    .label { font-weight: 700; }
    .addr-label { font-weight: 700; text-align: center; vertical-align: middle; }
    .muted { font-size: 10px; }
    .terms { font-size: 10px; line-height: 1.4; text-align: left; }
  </style>
</head>
<body>
  <div class="letterhead">
    <div class="letterhead-row">
      ${logoSrc ? `<img class="letterhead-logo" src="${esc(logoSrc)}" alt=""/>` : ''}
      <div class="letterhead-name">${esc(data.companyName)}</div>
    </div>
    <div class="letterhead-title">PURCHASE ORDER</div>
  </div>
  <table class="sheet">
    <tr>
      <td class="label" style="width:14%">Po No.</td>
      <td colspan="2">${esc(data.poNumber)}</td>
      <td class="label" colspan="2">Delivery Place</td>
      <td colspan="2">${esc(deliveryPlace)}</td>
    </tr>
    <tr>
      <td class="label">Po Date</td>
      <td colspan="2">${esc(data.poDate)}</td>
      <td class="label" colspan="2">Date of Schedule</td>
      <td colspan="2">${esc(schedule)}</td>
    </tr>
    <tr><td colspan="7" class="gap"></td></tr>
    <tr>
      <td class="label">Consigner,</td>
      <td colspan="2" style="white-space:nowrap"><strong>${esc(data.vendorName)}</strong></td>
      <td class="label" colspan="2">Consignee,</td>
      <td colspan="2" style="white-space:nowrap"><strong>${esc(data.companyName)}</strong></td>
    </tr>
    <tr>
      <td class="addr-label" rowspan="4">Address</td>
      <td colspan="2">${addrCell(vendorLines[0])}</td>
      <td class="addr-label" colspan="2" rowspan="4">Consignee Billing Address:</td>
      <td colspan="2">${addrCell(companyLines[0])}</td>
    </tr>
    <tr>
      <td colspan="2">${addrCell(vendorLines[1])}</td>
      <td colspan="2">${addrCell(companyLines[1])}</td>
    </tr>
    <tr>
      <td colspan="2">${addrCell(vendorLines[2])}</td>
      <td colspan="2">${addrCell(companyLines[2])}</td>
    </tr>
    <tr>
      <td colspan="2">${addrCell(vendorLines[3])}</td>
      <td colspan="2">${addrCell(companyLines[3])}</td>
    </tr>
    <tr>
      <td class="label">Gst No.</td>
      <td colspan="2">${esc(data.vendorGstin || '—')}</td>
      <td class="label" colspan="2">Gst No.</td>
      <td colspan="2">${esc(data.companyGstin || '—')}</td>
    </tr>
    <tr>
      <th style="width:8%">Sr. No.</th>
      <th>Item Description</th>
      <th style="width:12%">Hsn No.</th>
      <th style="width:8%">Unit</th>
      <th style="width:12%">Quantity</th>
      <th style="width:14%">Delivered Rate</th>
      <th style="width:14%">Amount</th>
    </tr>
    ${lines.map((line, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${esc(line.materialType)}</td>
      <td class="center">${esc(line.hsnCode || '—')}</td>
      <td class="center">${esc(line.unit)}</td>
      <td class="right">${fmtQty(line.qty)}</td>
      <td class="right">${fmtMoney(line.pricePerUnit)}</td>
      <td class="right">${fmtMoney(line.qty * line.pricePerUnit)}</td>
    </tr>`).join('')}
    <tr>
      <td colspan="4" class="label">Total Qty</td>
      <td class="right"><strong>${esc(tax.totalQtyLabel)}</strong></td>
      <td></td>
      <td class="right"><strong>${fmtMoney(tax.lineAmount)}</strong></td>
    </tr>
    <tr>
      <td colspan="6" class="label">CGST ${tax.cgstRate}%</td>
      <td class="right">${fmtMoney(tax.cgst)}</td>
    </tr>
    <tr>
      <td colspan="6" class="label">SGST ${tax.sgstRate}%</td>
      <td class="right">${fmtMoney(tax.sgst)}</td>
    </tr>
    <tr>
      <td colspan="6" class="label">${tax.igstRate ? `IGST ${tax.igstRate}%` : 'IGST'}</td>
      <td class="right">${fmtMoney(tax.igst)}</td>
    </tr>
    <tr>
      <td colspan="6" class="label">Total Amount</td>
      <td class="right"><strong>${fmtMoney(tax.grand)}</strong></td>
    </tr>
    <tr>
      <td class="label">Amount In Word</td>
      <td colspan="6">${esc(amountInWordsInr(tax.grand))}</td>
    </tr>
    <tr><td colspan="7" class="label">Terms &amp; Condition :-</td></tr>
    <tr>
      <td class="label">Payment Terms</td>
      <td colspan="6">${esc(data.paymentTerms)}</td>
    </tr>
    <tr>
      <td class="label">Transporter</td>
      <td colspan="6">${esc(transporter)}</td>
    </tr>
    <tr>
      <td class="label">Other Remarks</td>
      <td colspan="6">${esc(remarks)}</td>
    </tr>
    <tr><td colspan="7" class="label"> Special Instructions :-</td></tr>
    ${poInstructionLines(data.specialInstructions).map((term) =>
      `<tr><td colspan="7" class="terms">${esc(term)}</td></tr>`
    ).join('')}
    <tr>
      <td colspan="4"></td>
      <td colspan="3" class="center">
        <div class="label">For, ${esc(data.companyName)}</div>
        <div style="height:28px"></div>
        <div>Electronically Approved</div>
      </td>
    </tr>
    <tr>
      <td colspan="7" class="center muted">*** This is Computer Generated Document, No Signature Required. ***</td>
    </tr>
  </table>
</body>
</html>`
}

/** Short cover note for the email body (full PO attached as PDF). */
export function buildProcurementPoEmailCover(data: ProcurementPoDocData): string {
  const qty = fmtQty(data.qty)
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#111;line-height:1.55">
      <p>Dear Sir/Madam,</p>
      <p>Please find Purchase Order <strong>${esc(data.poNumber)}</strong> from <strong>${esc(data.companyName)}</strong>.</p>
      <ul>
        <li><strong>Material:</strong> ${esc(data.materialType)}</li>
        <li><strong>Quantity:</strong> ${esc(qty)} ${esc(data.unit)}</li>
        <li><strong>Delivery:</strong> ${esc(data.deliverySchedule)}</li>
        <li><strong>Payment terms:</strong> ${esc(data.paymentTerms)}</li>
      </ul>
      <p>The full purchase order is attached as a PDF.</p>
      <p style="font-size:13px;color:#666">This is an automated message from MADSTOQ ERP.</p>
    </div>
  `.trim()
}
