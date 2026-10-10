'use client'

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

export type PoDocumentData = ProcurementPoDocData

export default function ProcurementPoDocument({ data }: { data: PoDocumentData }) {
  const tax = resolvePoTax(data)
  const lines = poDocLines(data)
  const vendorLines = padAddressLines(data.vendorAddress, 4)
  const companyLines = padAddressLines(data.companyAddress, 4)
  const deliveryPlace = (data.deliveryPlace || '').trim() || '—'
  const schedule = (data.scheduleDate || data.deliverySchedule || '').trim() || '—'
  const transporter = (data.transporter || '').trim() || '-'
  const remarks = [data.lineRemarks, data.qualityRef].filter(Boolean).join(' · ') || '-'
  const logoSrc = data.logoUrl?.trim()

  const cell = 'border border-black px-2 py-1.5 align-middle'
  const label = `${cell} font-semibold`

  return (
    <div className="bg-white text-black font-sans text-[11px] leading-snug print:shadow-none">
      <div className="mb-1.5">
        <div className="relative flex min-h-[64px] items-center justify-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="absolute left-0 top-1/2 h-14 w-auto max-w-[230px] -translate-y-1/2 bg-transparent object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : null}
          <div className="px-2 text-center text-[22px] font-bold uppercase tracking-wide whitespace-nowrap leading-tight">
            {data.companyName}
          </div>
        </div>
        <div className="pb-2 pt-0.5 text-center text-base font-bold italic whitespace-nowrap">
          PURCHASE ORDER
        </div>
      </div>
      <table className="w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <td className={`${label} w-[14%]`}>Po No.</td>
            <td className={cell} colSpan={2}>{data.poNumber}</td>
            <td className={label} colSpan={2}>Delivery Place</td>
            <td className={cell} colSpan={2}>{deliveryPlace}</td>
          </tr>
          <tr>
            <td className={label}>Po Date</td>
            <td className={cell} colSpan={2}>{data.poDate}</td>
            <td className={label} colSpan={2}>Date of Schedule</td>
            <td className={cell} colSpan={2}>{schedule}</td>
          </tr>
          <tr>
            <td className="h-2.5 border-0 p-0" colSpan={7} />
          </tr>
          <tr>
            <td className={label}>Consigner,</td>
            <td className={`${cell} font-semibold whitespace-nowrap`} colSpan={2}>{data.vendorName}</td>
            <td className={label} colSpan={2}>Consignee,</td>
            <td className={`${cell} font-semibold whitespace-nowrap`} colSpan={2}>{data.companyName}</td>
          </tr>
          <tr>
            <td className={`${label} text-center`} rowSpan={4}>Address</td>
            <td className={cell} colSpan={2}>{vendorLines[0]}</td>
            <td className={`${label} text-center`} colSpan={2} rowSpan={4}>Consignee Billing Address:</td>
            <td className={cell} colSpan={2}>{companyLines[0]}</td>
          </tr>
          <tr>
            <td className={cell} colSpan={2}>{vendorLines[1]}</td>
            <td className={cell} colSpan={2}>{companyLines[1]}</td>
          </tr>
          <tr>
            <td className={cell} colSpan={2}>{vendorLines[2]}</td>
            <td className={cell} colSpan={2}>{companyLines[2]}</td>
          </tr>
          <tr>
            <td className={cell} colSpan={2}>{vendorLines[3]}</td>
            <td className={cell} colSpan={2}>{companyLines[3]}</td>
          </tr>
          <tr>
            <td className={label}>Gst No.</td>
            <td className={cell} colSpan={2}>{data.vendorGstin || '—'}</td>
            <td className={label} colSpan={2}>Gst No.</td>
            <td className={cell} colSpan={2}>{data.companyGstin || '—'}</td>
          </tr>
          <tr>
            <th className={`${label} w-[8%]`}>Sr. No.</th>
            <th className={label}>Item Description</th>
            <th className={`${label} w-[12%]`}>Hsn No.</th>
            <th className={`${label} w-[8%]`}>Unit</th>
            <th className={`${label} w-[12%]`}>Quantity</th>
            <th className={`${label} w-[14%]`}>Delivered Rate</th>
            <th className={`${label} w-[14%]`}>Amount</th>
          </tr>
          {lines.map((line, i) => (
          <tr key={`${line.materialType}-${i}`}>
            <td className={`${cell} text-center`}>{i + 1}</td>
            <td className={cell}>{line.materialType}</td>
            <td className={`${cell} text-center`}>{line.hsnCode || '—'}</td>
            <td className={`${cell} text-center`}>{line.unit}</td>
            <td className={`${cell} text-right`}>{fmtQty(line.qty)}</td>
            <td className={`${cell} text-right`}>{fmtMoney(line.pricePerUnit)}</td>
            <td className={`${cell} text-right`}>{fmtMoney(line.qty * line.pricePerUnit)}</td>
          </tr>
          ))}
          <tr>
            <td className={label} colSpan={4}>Total Qty</td>
            <td className={`${cell} text-right font-semibold`}>{tax.totalQtyLabel}</td>
            <td className={cell} />
            <td className={`${cell} text-right font-semibold`}>{fmtMoney(tax.lineAmount)}</td>
          </tr>
          <tr>
            <td className={label} colSpan={6}>CGST {tax.cgstRate}%</td>
            <td className={`${cell} text-right`}>{fmtMoney(tax.cgst)}</td>
          </tr>
          <tr>
            <td className={label} colSpan={6}>SGST {tax.sgstRate}%</td>
            <td className={`${cell} text-right`}>{fmtMoney(tax.sgst)}</td>
          </tr>
          <tr>
            <td className={label} colSpan={6}>{tax.igstRate ? `IGST ${tax.igstRate}%` : 'IGST'}</td>
            <td className={`${cell} text-right`}>{fmtMoney(tax.igst)}</td>
          </tr>
          <tr>
            <td className={label} colSpan={6}>Total Amount</td>
            <td className={`${cell} text-right font-bold`}>{fmtMoney(tax.grand)}</td>
          </tr>
          <tr>
            <td className={label}>Amount In Word</td>
            <td className={cell} colSpan={6}>{amountInWordsInr(tax.grand)}</td>
          </tr>
          <tr>
            <td className={label} colSpan={7}>Terms &amp; Condition :-</td>
          </tr>
          <tr>
            <td className={label}>Payment Terms</td>
            <td className={cell} colSpan={6}>{data.paymentTerms}</td>
          </tr>
          <tr>
            <td className={label}>Transporter</td>
            <td className={cell} colSpan={6}>{transporter}</td>
          </tr>
          <tr>
            <td className={label}>Other Remarks</td>
            <td className={cell} colSpan={6}>{remarks}</td>
          </tr>
          <tr>
            <td className={label} colSpan={7}> Special Instructions :-</td>
          </tr>
          {poInstructionLines(data.specialInstructions).map((term) => (
            <tr key={term}>
              <td className={`${cell} text-[10px] leading-relaxed`} colSpan={7}>
                {term}
              </td>
            </tr>
          ))}
          <tr>
            <td className={cell} colSpan={4} />
            <td className={`${cell} py-4 text-center`} colSpan={3}>
              <p className="font-bold">For, {data.companyName}</p>
              <div className="h-8" />
              <p>Electronically Approved</p>
            </td>
          </tr>
          <tr>
            <td className={`${cell} py-2 text-center text-[10px]`} colSpan={7}>
              *** This is Computer Generated Document, No Signature Required. ***
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
