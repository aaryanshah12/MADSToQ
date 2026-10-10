'use client'

import { useState } from 'react'
import type { QcLogEntry } from '@/components/inventory/QcLabResultForm'
import { poLogoCandidates } from '@/lib/procurement-po-format'

export type CoaCertificate = {
  factory_id: string | null
  factory_name: string | null
  factory_address: string | null
  factory_email: string | null
  mfg_date: string | null
  cas_number: string | null
  coa_description_spec: string | null
  coa_identification_spec: string | null
  coa_specific_gravity_spec: string | null
  coa_water_spec: string | null
  coa_boiling_point_spec: string | null
  coa_gc_purity_spec: string | null
  coa_conclusion: string | null
  coa_storage_condition: string | null
}

export const EMPTY_COA_CERTIFICATE: CoaCertificate = {
  factory_id: null,
  factory_name: null,
  factory_address: null,
  factory_email: null,
  mfg_date: null,
  cas_number: null,
  coa_description_spec: null,
  coa_identification_spec: null,
  coa_specific_gravity_spec: null,
  coa_water_spec: null,
  coa_boiling_point_spec: null,
  coa_gc_purity_spec: null,
  coa_conclusion: null,
  coa_storage_condition: null,
}

type CoaSale = {
  product_name: string
  unit: string
  tally_invoice_no: string | null
  drum_count?: number | null
  coa_issued_at: string | null
}

type CoaLot = {
  invoice_number: string
  qty: number
  coa_no?: string | null
  coa_issued_at?: string | null
}

const COA_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function formatCoaMonth(isoDate: string | null | undefined, addYears = 0) {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate || '')
  if (!match) return '—'
  const year = Number(match[1]) + addYears
  const month = COA_MONTHS[Number(match[2]) - 1]
  if (!month || !Number.isFinite(year)) return '—'
  return `${month}-${year}`
}

function formatDmy(isoDate: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '')
  if (!match) return '—'
  return `${match[3]}/${match[2]}/${match[1]}`
}

function qcNumber(value: unknown) {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : ''
}

function qcLog(logs: QcLogEntry[], type: string) {
  return logs.find((log) => log.instrument_type === type)
}

function compliesResult(log: QcLogEntry | undefined) {
  if (!log) return '—'
  if (log.payload.complies === true) return 'Complies'
  if (log.payload.complies === false) return 'Does not comply'
  return '—'
}

function show(value: string | null | undefined) {
  const text = (value || '').trim()
  return text || '—'
}

const SHEET_CSS = `
.coa-sheet { background:#fff; color:#111; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:1.35; }
.coa-sheet * { box-sizing:border-box; }
.coa-brand { min-height:64px; margin-bottom:6px; text-align:right; }
.coa-logo { height:72px; width:auto; max-width:220px; object-fit:contain; }
.coa-company { margin:8px 0 0; text-align:right; font-size:16px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
.coa-title { margin:4px 0 14px; text-align:center; font-size:16px; font-weight:700; letter-spacing:0.04em; }
.coa-table { width:100%; border-collapse:collapse; margin:0 0 14px; }
.coa-table th, .coa-table td { border:1px solid #222; padding:7px 8px; vertical-align:middle; }
.coa-table th { font-weight:700; text-align:center; }
.coa-label { width:22%; font-weight:700; white-space:nowrap; }
.coa-value { text-align:center; }
.coa-sr { width:8%; text-align:center; font-weight:700; }
.coa-test { width:28%; font-weight:700; }
.coa-spec { width:44%; }
.coa-result { width:20%; text-align:center; }
.coa-notes { margin:2px 0 16px; padding-left:18px; }
.coa-notes li { margin:4px 0; }
.coa-sign td { text-align:center; }
.coa-sign .coa-label { text-align:left; }
.coa-sign-space { height:64px; }
.coa-foot { margin-top:28px; border-top:2px solid #1d3f73; padding-top:8px; color:#1d3f73; font-size:11px; }
.coa-foot-row { display:flex; gap:8px; align-items:flex-start; margin:3px 0; }
.coa-foot-label { flex:0 0 auto; background:#1d3f73; color:#fff; font-size:9px; font-weight:700; letter-spacing:0.04em; padding:2px 6px; }
`

export function printCoaSheet(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src')
    if (src && src.startsWith('/')) img.setAttribute('src', `${window.location.origin}${src}`)
  })
  const popup = window.open('', '_blank')
  if (!popup) return
  popup.document.open()
  popup.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificate of analysis</title>
<style>@page{size:A4;margin:14mm} html,body{margin:0;background:#fff;color:#000}</style>
</head><body>${clone.outerHTML}</body></html>`)
  popup.document.close()
  window.setTimeout(() => {
    popup.focus()
    popup.print()
    popup.close()
  }, 400)
}

function Letterhead({ name, factoryId }: { name: string | null; factoryId: string | null }) {
  const urls = poLogoCandidates({
    companyName: name || '',
    factoryId: factoryId || undefined,
  })
  const [index, setIndex] = useState(0)
  const src = urls[index]
  if (src) {
    return (
      <img
        className="coa-logo"
        src={src}
        alt={name || ''}
        onError={() => setIndex((current) => current + 1)}
      />
    )
  }
  if (!name) return null
  return <p className="coa-company">{name}</p>
}

export default function CoaSheet({
  sale,
  lot,
  logs,
  certificate,
}: {
  sale: CoaSale
  lot: CoaLot
  logs: QcLogEntry[]
  certificate: CoaCertificate
}) {
  const density = qcNumber(qcLog(logs, 'density')?.payload.density)
  const water = qcNumber(qcLog(logs, 'karl_fisher')?.payload.result_pct)
  const boiling = qcNumber(qcLog(logs, 'boiling_point')?.payload.result_c)
  const purity = qcNumber(qcLog(logs, 'gc')?.payload.percentage)
  const analysisDates = logs.map((log) => log.entry_date).filter(Boolean).sort()
  const analysisDate = analysisDates[analysisDates.length - 1] || lot.coa_issued_at || sale.coa_issued_at
  const signDate = formatDmy(lot.coa_issued_at || sale.coa_issued_at)
  const rows: Array<{ sr: string; test: string; spec: string; result: string; nested?: boolean }> = [
    {
      sr: '1',
      test: 'Description',
      spec: show(certificate.coa_description_spec),
      result: compliesResult(qcLog(logs, 'description')),
    },
    {
      sr: '2',
      test: 'Identification (By GC)',
      spec: show(certificate.coa_identification_spec),
      result: compliesResult(qcLog(logs, 'identification')),
    },
    {
      sr: '3',
      test: 'Specific gravity (25°C)',
      spec: show(certificate.coa_specific_gravity_spec),
      result: density || '—',
    },
    {
      sr: '4',
      test: 'Water (By KF)',
      spec: show(certificate.coa_water_spec),
      result: water ? `${water}%` : '—',
    },
    {
      sr: '5',
      test: 'Boiling point',
      spec: show(certificate.coa_boiling_point_spec),
      result: boiling ? `${boiling}°C` : '—',
    },
    { sr: '6', test: 'Chromatographic purity (By GC).', spec: '', result: '' },
    {
      sr: '6.1',
      test: 'Purity',
      spec: show(certificate.coa_gc_purity_spec),
      result: purity ? `${purity}%` : '—',
      nested: true,
    },
  ]

  const quantity = lot.qty != null && lot.qty !== 0 ? `${lot.qty} ${sale.unit}` : '—'
  const showFooter = Boolean(certificate.factory_address || certificate.factory_email)

  return (
    <div className="coa-sheet">
      <style>{SHEET_CSS}</style>
      <div className="coa-brand">
        <Letterhead name={certificate.factory_name} factoryId={certificate.factory_id} />
      </div>
      <h3 className="coa-title">CERTIFICATE OF ANALYSIS</h3>
      <table className="coa-table">
        <tbody>
          <tr>
            <td className="coa-label">PRODUCT NAME</td>
            <td className="coa-value" colSpan={3} style={{ textTransform: 'uppercase' }}>
              {sale.product_name}
            </td>
          </tr>
          <tr>
            <td className="coa-label">CAS NO.</td>
            <td className="coa-value">{show(certificate.cas_number)}</td>
            <td className="coa-label">BATCH NO.</td>
            <td className="coa-value">{lot.invoice_number}</td>
          </tr>
          <tr>
            <td className="coa-label">QUANTITY</td>
            <td className="coa-value">{quantity}</td>
            <td className="coa-label">NO.OF DRUMS</td>
            <td className="coa-value">{sale.drum_count != null ? sale.drum_count : '—'}</td>
          </tr>
          <tr>
            <td className="coa-label">INVOICE NO.</td>
            <td className="coa-value">{show(sale.tally_invoice_no)}</td>
            <td className="coa-label">DATE OF ANALYSIS</td>
            <td className="coa-value">{formatDmy(analysisDate)}</td>
          </tr>
          <tr>
            <td className="coa-label">MFG.DATE</td>
            <td className="coa-value">{formatCoaMonth(certificate.mfg_date)}</td>
            <td className="coa-label">RETEST DATE</td>
            <td className="coa-value">{formatCoaMonth(certificate.mfg_date, 1)}</td>
          </tr>
        </tbody>
      </table>
      <table className="coa-table">
        <thead>
          <tr>
            <th className="coa-sr">SR.NO</th>
            <th className="coa-test">TEST</th>
            <th className="coa-spec">SPECIFICATION</th>
            <th className="coa-result">RESULT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sr}>
              <td className="coa-sr">{row.sr}</td>
              <td className="coa-test">{row.test}</td>
              <td className="coa-spec" style={{ whiteSpace: 'pre-wrap' }}>
                {row.spec}
              </td>
              <td className="coa-result">{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {certificate.coa_conclusion || certificate.coa_storage_condition ? (
        <ul className="coa-notes">
          {certificate.coa_conclusion ? (
            <li>
              <strong>Conclusion:</strong> {certificate.coa_conclusion}
            </li>
          ) : null}
          {certificate.coa_storage_condition ? (
            <li>
              <strong>Storage condition:</strong> {certificate.coa_storage_condition}
            </li>
          ) : null}
        </ul>
      ) : null}
      <table className="coa-table coa-sign">
        <tbody>
          <tr>
            <td className="coa-label" />
            <td>
              <strong>Analysed by</strong>
            </td>
            <td>
              <strong>Approved by</strong>
            </td>
          </tr>
          <tr>
            <td className="coa-label">Signature</td>
            <td className="coa-sign-space" />
            <td className="coa-sign-space" />
          </tr>
          <tr>
            <td className="coa-label">Date</td>
            <td>
              <strong>{signDate}</strong>
            </td>
            <td>
              <strong>{signDate}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {showFooter ? (
        <div className="coa-foot">
          {certificate.factory_address ? (
            <div className="coa-foot-row">
              <span className="coa-foot-label">FACTORY</span>
              <span style={{ whiteSpace: 'pre-line' }}>{certificate.factory_address}</span>
            </div>
          ) : null}
          {certificate.factory_email ? (
            <div className="coa-foot-row">
              <span className="coa-foot-label">EMAIL</span>
              <span>{certificate.factory_email}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
