import {
  formatStickerDmy,
  formatStickerMonthYear,
  type PackQcStickerData,
  type RmQcStickerData,
} from '@/lib/qc-sticker'

function printHtml(title: string, body: string, pageCss: string, pageSize = '90mm 50mm') {
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { size: ${pageSize}; margin: 3mm; }
html, body { margin: 0; background: #fff; color: #000; }
body { font-family: Arial, Helvetica, sans-serif; }
${pageCss}
</style></head><body>${body}</body></html>`

  const popup = window.open('', '_blank')
  if (popup) {
    popup.document.open()
    popup.document.write(doc)
    popup.document.close()
    window.setTimeout(() => {
      popup.focus()
      popup.print()
      popup.close()
    }, 300)
    return true
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const frameDoc = iframe.contentWindow?.document
  if (!frameDoc || !iframe.contentWindow) {
    iframe.remove()
    return false
  }
  frameDoc.open()
  frameDoc.write(doc)
  frameDoc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    iframe.remove()
  }, 300)
  return true
}

function esc(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function printRmQcSticker(data: RmQcStickerData) {
  const body = `
<div class="rm-sticker">
  <p class="rm-title">QC APPROVED :- OK</p>
  <table>
    <colgroup><col class="l"><col class="v"><col class="l"><col class="v"></colgroup>
    <tbody>
      <tr>
        <th>Material Name :-</th><td>${esc(data.material_name)}</td>
        <th>Inward Date :-</th><td>${esc(formatStickerDmy(data.inward_date))}</td>
      </tr>
      <tr>
        <th>Lot No :-</th><td>${esc(data.lot_no)}</td>
        <th>Mfg Date :-</th><td>${esc(formatStickerDmy(data.mfg_date))}</td>
      </tr>
      <tr>
        <th>Supplier :-</th><td>${esc(data.supplier)}</td>
        <th>Exp Date :-</th><td>${esc(formatStickerDmy(data.exp_date))}</td>
      </tr>
      <tr>
        <th>Purity :-</th><td>${esc(data.purity)}${data.purity && !data.purity.includes('%') ? '%' : ''}</td>
        <th>Sampling</th><td>${esc(formatStickerDmy(data.sampling_date))}</td>
      </tr>
      <tr>
        <th>Total Qty :-</th><td>${esc(data.total_qty)}</td>
        <th>Date Release</th><td>${esc(formatStickerDmy(data.release_date))}</td>
      </tr>
    </tbody>
  </table>
</div>`
  return printHtml(
    `RM QC ${data.lot_no}`,
    body,
    `
.rm-sticker { padding: 2mm; }
.rm-title { text-align: center; font-weight: 700; font-size: 13px; margin: 0 0 3mm; letter-spacing: 0.02em; }
table { width: 100%; border-collapse: collapse; font-size: 10px; }
th, td { border: 1px solid #111; padding: 2.5mm 2mm; vertical-align: middle; }
th { font-weight: 700; text-align: left; white-space: nowrap; width: 28%; }
td { font-weight: 600; }
`,
  )
}

function packLabelHtml(data: PackQcStickerData) {
  const purity = data.purity
    ? data.purity.includes('%')
      ? data.purity
      : `${data.purity} %`
    : '—'
  return `
<div class="pack-sticker">
  <p class="pack-title">${esc(data.product_name)}</p>
  <div class="grid">
    <p><span>DRUM NO</span> : <strong>${esc(data.drum_no)}</strong></p>
    <p><span>PURITY</span> : <strong>${esc(purity)}</strong></p>
    <p class="wide"><span>Batch No.</span> : <strong>${esc(data.batch_no)}</strong></p>
    <p><span>Mfg. Date</span> : <strong>${esc(formatStickerMonthYear(data.mfg_date))}</strong></p>
    <p><span>Retest Date</span> : <strong>${esc(formatStickerMonthYear(data.retest_date))}</strong></p>
    <p class="wide weights">
      <span>G.W</span> : <strong>${esc(data.gross_kg || '—')} KGS</strong>
      <span>T.W</span> : <strong>${esc(data.tare_kg || '—')} KGS</strong>
      <span>N.W</span> : <strong>${esc(data.net_kg || '—')} KGS</strong>
    </p>
  </div>
</div>`
}

export function printPackQcStickers(labels: PackQcStickerData[]) {
  const pages = labels.length ? labels : []
  if (pages.length === 0) return false
  const body = pages.map(packLabelHtml).join('')
  return printHtml(
    `Pack labels ${pages[0].batch_no}`,
    body,
    `
.pack-sticker {
  box-sizing: border-box;
  width: 84mm;
  height: 44mm;
  padding: 2.5mm 3.5mm;
  page-break-after: always;
}
.pack-sticker:last-child { page-break-after: auto; }
.pack-title {
  margin: 0 0 2.5mm;
  text-align: center;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6mm 6mm; font-size: 11px; }
.grid p { margin: 0; }
.grid span { font-weight: 700; }
.wide { grid-column: 1 / -1; }
.weights { display: flex; flex-wrap: wrap; gap: 2mm 7mm; }
`,
  )
}

export function printPackQcSticker(data: PackQcStickerData) {
  return printPackQcStickers([data])
}
