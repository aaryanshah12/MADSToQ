'use client'
import { useState, useEffect, useRef } from 'react'
import { useIOFactory } from '@/contexts/IOFactoryContext'
import { fetchDomestics, saveDomestic, deleteDomestic, fetchCompanies, fetchProducts, fmtDate, today } from '@/lib/io/api'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from '@/lib/monthlyMaterial'
import type { IODomestic, IOLineItem, IOCompany, IOProduct } from '@/lib/io/types'
import ProductModal from '@/components/io/ProductModal'
import CompanyModal from '@/components/io/CompanyModal'
import { Plus, Pencil, Trash2, X, Save, Download, Search, Upload, Printer, Eye } from 'lucide-react'
import { printLetterHeadInvoice, printLabelForDomestic } from '@/lib/io/print'
import ProductComboSearch from '@/components/io/ProductComboSearch'

const EMPTY_ITEM = (): IOLineItem => ({ product_id: '', quantity: 1, price: 0, remarks: '' })

export default function DomesticPage() {
  const { factoryId, factories } = useIOFactory()
  const [rows, setRows] = useState<IODomestic[]>([])
  const [companies, setCompanies] = useState<IOCompany[]>([])
  const [products, setProducts] = useState<IOProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [fiscalYear, setFiscalYear] = useState(() => getCurrentFiscalYear())
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<IODomestic | null>(null)
  const [form, setForm] = useState({ invoice_date: today(), customer_id: '', tax_invoice_number: '', remarks: '', factory_id: '' })
  const [items, setItems] = useState<IOLineItem[]>([EMPTY_ITEM()])
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importGroups, setImportGroups] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [printDropdownId, setPrintDropdownId] = useState<string | null>(null)
  const [viewRow, setViewRow] = useState<IODomestic | null>(null)
  const [visibleCount, setVisibleCount] = useState(60)

  useEffect(() => { loadData() }, [factoryId])

  async function loadData() {
    setLoading(true)
    try {
      const [r, c, p] = await Promise.all([fetchDomestics(factoryId || undefined), fetchCompanies('customer', factoryId || undefined), fetchProducts(factoryId || undefined)])
      setRows(r); setCompanies(c); setProducts(p)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const domesticCompanies = companies.filter(c => (c.country?.name ?? '').toLowerCase() === 'india')

  function openNew() { setEditing(null); setForm({ invoice_date: today(), customer_id: '', tax_invoice_number: '', remarks: '', factory_id: factoryId }); setItems([EMPTY_ITEM()]); setShowForm(true) }
  function openEdit(row: IODomestic) { setEditing(row); setForm({ invoice_date: row.invoice_date, customer_id: row.customer_id ?? '', tax_invoice_number: row.tax_invoice_number ?? '', remarks: row.remarks ?? '', factory_id: row.factory_id ?? factoryId }); setItems(row.items?.length ? row.items.map(it => ({ ...it })) : [EMPTY_ITEM()]); setShowForm(true) }
  async function handleSave(printType: 'invoice' | 'label' | false = false) {
    const validItems = items.filter(it => it.product_id)
    if (!validItems.length) { alert('Add at least one product.'); return }
    setSaving(true)
    try {
      const saved = await saveDomestic({ id: editing?.id, invoice_date: form.invoice_date, customer_id: form.customer_id || null, tax_invoice_number: form.tax_invoice_number || null, remarks: form.remarks || null, factory_id: form.factory_id || factoryId || null, items: validItems })
      setShowForm(false)
      const next = await fetchDomestics(factoryId || undefined)
      setRows(next)
      if (printType) {
        const full = next.find(r => r.id === saved.id) ?? (editing ?? null)
        if (full) {
          if (printType === 'invoice') await printLetterHeadInvoice('Domestic', full as any, products)
          else await printLabelForDomestic(full as any, products)
        }
      }
    }
    catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function handlePrint(row: IODomestic, printType: 'invoice' | 'label') {
    try {
      if (printType === 'invoice') await printLetterHeadInvoice('Domestic', row as any, products)
      else await printLabelForDomestic(row as any, products)
    } catch (e: any) { alert(e.message) }
  }
  async function handleDelete(id: string) { if (!confirm('Delete?')) return; await deleteDomestic(id); loadData() }
  function setItem(i: number, field: keyof IOLineItem, value: any) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it)) }

  function downloadTemplate() {
    const csv = 'Invoice No,Date,Customer,Factory,Product,Qty,Price (₹),Remarks\n,2024-01-15,Customer Name,Factory Name,Product Name,10,500,Optional notes'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'domestic_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''
    let headers: string[] = []
    let dataRows: string[][] = []
    if (file.name.endsWith('.xlsx')) {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.worksheets[0]
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const vals = (row.values as any[]).slice(1).map(v => String(v ?? '').trim())
        if (rowNumber === 1) { headers = vals.map(h => h.toLowerCase()); return }
        dataRows.push(vals)
      })
    } else {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length) headers = lines[0].split(',').map(s => s.trim().toLowerCase())
      dataRows = lines.slice(1).map(line => line.split(',').map(s => s.trim()))
    }
    const col = (row: string[], name: string) => { const idx = headers.findIndex(h => h === name); return idx >= 0 ? (row[idx] ?? '') : '' }
    const map: Record<string, any> = {}
    for (const cols of dataRows) {
      const date = col(cols, 'date'); const customerName = col(cols, 'customer'); const factoryName = col(cols, 'factory'); const productName = col(cols, 'product'); const qtyStr = col(cols, 'qty'); const priceStr = col(cols, 'price (₹)') || col(cols, 'price'); const remarks = col(cols, 'remarks')
      const company = companies.find(c => c.company_name.toLowerCase() === customerName.toLowerCase())
      const factory = factories.find(f => f.name.toLowerCase() === factoryName.toLowerCase())
      const product = products.find(p => p.product_name.toLowerCase() === productName.toLowerCase())
      const key = `${date}|${company?.id ?? customerName}|${factory?.id ?? ''}`
      if (!map[key]) {
        const errors: string[] = []
        if (!company) errors.push(`Customer "${customerName}" not found`)
        const chosenFactoryId = factory?.id ?? factoryId
        if (!chosenFactoryId && factories.length > 1 && factoryName) errors.push(`Factory "${factoryName}" not found`)
        map[key] = { invoice_date: date, customer_id: company?.id ?? '', customer_name: company?.company_name ?? customerName, factory_id: chosenFactoryId, factory_name: factory?.name ?? factoryName ?? '', items: [], errors }
      }
      map[key].items.push({ product_id: product?.id ?? '', product_name: product?.product_name ?? productName, quantity: parseFloat(qtyStr) || 0, price: parseFloat(priceStr) || 0, remarks: remarks ?? '', error: !product ? `"${productName}" not found` : '' })
    }
    setImportGroups(Object.values(map)); setImportOpen(true)
  }
  async function handleImportConfirm() {
    const valid = importGroups.filter(g => !g.errors.length && g.items.some((it: any) => it.product_id))
    if (!valid.length) return
    setImporting(true)
    try {
      for (const g of valid) {
        await saveDomestic({ invoice_date: g.invoice_date, customer_id: g.customer_id || null, remarks: null, factory_id: g.factory_id || null, items: g.items.filter((it: any) => it.product_id).map((it: any) => ({ product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks })) })
      }
      setImportOpen(false); setImportGroups([]); loadData()
    } catch (e: any) { alert(e.message) } finally { setImporting(false) }
  }

  async function handleExport() {
    if (!filtered.length) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Domestic')
    const headers = ['Invoice No', 'Date', 'Customer', 'Factory', 'Product', 'Qty', 'Price (₹)', 'Remarks']
    const hRow = ws.addRow(headers)
    hRow.font = { bold: true, size: 11 }
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    hRow.border = { bottom: { style: 'thin', color: { argb: 'FFCCA300' } } }
    hRow.alignment = { vertical: 'middle' }
    filtered.forEach(r => {
      const base = [r.invoice_number, r.invoice_date, r.customer?.company_name ?? '', r.factory?.name ?? '']
      if (!(r.items ?? []).length) { ws.addRow([...base, '', '', '', '']); return }
      ;(r.items ?? []).forEach((it: IOLineItem) => ws.addRow([...base, it.product?.product_name ?? products.find(p => p.id === it.product_id)?.product_name ?? '', it.quantity, it.price, it.remarks ?? '']))
    })
    ws.columns.forEach((col, i) => { col.width = Math.min(Math.max(headers[i].length + 4, 14), 40) })
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'domestic.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  const rowTotal = (its: IOLineItem[]) => its.reduce((s, it) => s + it.price * it.quantity, 0)
  const fiscalYears = getFiscalYears(5)
  const filtered = rows.filter(r => {
    const matchSearch =
      (r.tax_invoice_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.invoice_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.customer?.company_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCustomer = customerFilter === 'all' || r.customer_id === customerFilter
    const rowDate = new Date(r.invoice_date)
    const fyStart = Number(fiscalYear.replace('FY', '').split('-')[0])
    const matchFiscalYear = rowDate >= new Date(fyStart, 3, 1) && rowDate < new Date(fyStart + 1, 3, 1)
    const matchMonth = !selectedMonth || (rowDate.getMonth() + 1) === Number(selectedMonth)
    const matchDate = !selectedDate || r.invoice_date === selectedDate
    return matchSearch && matchCustomer && matchFiscalYear && matchMonth && matchDate
  })
  const visibleRows = filtered.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(60)
  }, [search, customerFilter, fiscalYear, selectedMonth, selectedDate])

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div><h1 className="text-xl font-bold text-primary">Domestic</h1><p className="text-sm text-muted mt-0.5">{filtered.length} invoices</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportFile}/>
          <button onClick={() => importRef.current?.click()} className="btn btn-ghost"><Upload size={14}/> Import</button>
          <button onClick={handleExport} className="btn btn-ghost"><Download size={14}/> Export</button>
          <button onClick={openNew} className="btn btn-inputer"><Plus size={15}/> New Invoice</button>
        </div>
      </div>
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 mb-4">
        <div className="input flex items-center gap-2 w-full md:w-[320px]">
          <Search size={14} className="text-muted flex-shrink-0"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"/>
        </div>
        <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="input w-full md:w-[220px] text-sm">
          <option value="all">All Customers</option>
          {domesticCompanies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} className="input w-full md:w-[170px] text-sm">
          {fiscalYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
        </select>
        <div className="w-full md:w-auto md:flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <label className="flex flex-col gap-1">
              <span className="px-1 text-xs font-medium text-muted">Month</span>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input w-full text-sm">
                <option value="">All Months</option>
                {monthOptions.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="px-1 text-xs font-medium text-muted">Date</span>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-full text-sm" aria-label="Filter by date"/>
            </label>
          </div>
        </div>
      </div>
      <div className="card overflow-visible">
        <div className="sm:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {loading ? <div className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin"/></div>
          : filtered.length === 0 ? <div className="py-12 text-center text-muted text-sm">No domestic invoices</div>
          : visibleRows.map(row => (
            <div key={row.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono font-semibold text-xs text-inputer">{row.tax_invoice_number || row.invoice_number || '—'}</div>
                  <div className="text-xs text-muted mt-0.5">{fmtDate(row.invoice_date)}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setViewRow(row)} className="p-2 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="View"><Eye size={14}/></button>
                  <div className="relative">
                    <button onClick={() => setPrintDropdownId(printDropdownId === row.id ? null : row.id)} className="p-2 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="Print"><Printer size={14}/></button>
                    {printDropdownId === row.id && (
                      <div className="absolute z-20 right-0 top-full mt-1 w-36 rounded-lg border border-border shadow-lg overflow-hidden" style={{ background: 'var(--color-panel)' }}>
                        <button onMouseDown={() => { handlePrint(row, 'invoice'); setPrintDropdownId(null) }} className="w-full text-left px-3 py-2 text-xs hover:bg-layer text-primary">Invoice</button>
                        <button onMouseDown={() => { handlePrint(row, 'label'); setPrintDropdownId(null) }} className="w-full text-left px-3 py-2 text-xs hover:bg-layer text-primary">Label</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => openEdit(row)} className="p-2 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={14}/></button>
                  <button onClick={() => handleDelete(row.id)} className="p-2 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                </div>
              </div>
              <div className="text-sm font-medium text-primary">{row.customer?.company_name ?? '—'}</div>
              {(row.items ?? []).length > 0 && (
                <div className="text-xs text-muted truncate">{(row.items ?? []).map(it => it.product?.product_name ?? products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ')}</div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-xs text-muted">{row.items?.length ?? 0} items</span>
                <span className="font-bold text-sm text-primary">₹{rowTotal(row.items ?? []).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-visible">
          <table className="data-table">
            <thead><tr><th>Tax Invoice No</th><th>Date</th><th>Customer</th><th>Products</th><th className="text-right">Amount</th><th className="text-right">Items</th><th/></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin"/></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted text-sm">No domestic invoices</td></tr>
              : visibleRows.map(row => (
                <tr key={row.id}>
                  <td className="font-mono font-semibold text-xs">{row.tax_invoice_number || row.invoice_number || '—'}</td>
                  <td className="text-xs">{fmtDate(row.invoice_date)}</td>
                  <td>{row.customer?.company_name ?? '—'}</td>
                  <td className="text-xs text-muted max-w-[180px]"><div className="truncate" title={(row.items ?? []).map(it => it.product?.product_name ?? products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ')}>{(row.items ?? []).map(it => it.product?.product_name ?? products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ') || '—'}</div></td>
                  <td className="text-right font-semibold text-xs">₹{rowTotal(row.items ?? []).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="text-right text-xs text-muted">{row.items?.length ?? 0}</td>
                  <td className="text-right"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewRow(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="View"><Eye size={13}/></button>
                    <div className="relative">
                      <button onClick={() => setPrintDropdownId(printDropdownId === row.id ? null : row.id)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="Print"><Printer size={13}/></button>
                      {printDropdownId === row.id && (
                        <div className="absolute z-20 right-0 top-full mt-1 w-36 rounded-lg border border-border shadow-lg overflow-hidden" style={{ background: 'var(--color-panel)' }}>
                          <button onMouseDown={() => { handlePrint(row, 'invoice'); setPrintDropdownId(null) }} className="w-full text-left px-3 py-2 text-xs hover:bg-layer text-primary">Invoice</button>
                          <button onMouseDown={() => { handlePrint(row, 'label'); setPrintDropdownId(null) }} className="w-full text-left px-3 py-2 text-xs hover:bg-layer text-primary">Label</button>
                        </div>
                      )}
                    </div>
                    <button onClick={() => openEdit(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={13}/></button>
                    <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!loading && visibleRows.length < filtered.length && (
        <div className="mt-3 flex justify-center">
          <button className="btn btn-ghost" onClick={() => setVisibleCount(v => v + 60)}>
            Load More ({filtered.length - visibleRows.length} remaining)
          </button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
          <div className="rounded-2xl shadow-2xl w-full max-w-3xl min-w-0 my-4 sm:my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2">
              <h2 className="text-base font-bold text-primary">{editing ? 'Edit Invoice' : 'New Domestic Invoice'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Tax Invoice Number</label>
                  <input value={form.tax_invoice_number} onChange={e => setForm(f => ({ ...f, tax_invoice_number: e.target.value }))} placeholder="Enter invoice number" className="input w-full"/>
                </div>
                <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Date</label><input type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} className="input w-full"/></div>
                {factories.length > 1 && <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Factory</label><select value={form.factory_id} onChange={e => setForm(f => ({ ...f, factory_id: e.target.value }))} className="input w-full"><option value="">— Select —</option>{factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5"><label className="text-xs font-medium text-muted uppercase tracking-wider">Customer</label><button onClick={() => setShowCompanyModal(true)} className="text-[11px] text-inputer hover:underline">+ Add New</button></div>
                  <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="input w-full"><option value="">— Select Customer —</option>{domesticCompanies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
                  {companies.length > 0 && domesticCompanies.length === 0 && (
                    <p className="text-[11px] text-muted mt-1">No India customers found in master.</p>
                  )}
                </div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional notes" className="input w-full"/></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-primary">Line Items</h3><button onClick={() => setItems(p => [...p, EMPTY_ITEM()])} className="text-xs text-inputer hover:underline flex items-center gap-1"><Plus size={12}/> Add Row</button></div>
                <div className="border border-border rounded-xl overflow-x-auto sm:overflow-visible -mx-1 px-1 sm:mx-0 sm:px-0">
                  <table className="w-full text-xs min-w-[520px] sm:min-w-0">
                    <thead style={{ background: 'var(--color-surface)' }}><tr className="border-b border-border"><th className="text-left px-3 py-2 font-semibold text-muted">Product</th><th className="text-right px-3 py-2 font-semibold text-muted">QTY (KGs)</th><th className="text-right px-3 py-2 font-semibold text-muted">Price</th><th className="text-right px-3 py-2 font-semibold text-muted">Total</th><th className="text-left px-3 py-2 font-semibold text-muted">Remarks</th><th className="px-2"/></tr></thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-2 py-2 min-w-[180px]"><div className="flex gap-1"><ProductComboSearch products={products} value={it.product_id} onChange={v => setItem(i, 'product_id', v)} className="flex-1"/><button onClick={() => setShowProductModal(true)} className="btn btn-inputer px-2 py-1.5 text-xs">+</button></div></td>
                          <td className="px-2 py-2"><input type="number" min={0} value={it.quantity || ''} placeholder="0" onChange={e => setItem(i, 'quantity', parseFloat(e.target.value) || 0)} className="input w-20 text-right py-1.5 text-xs"/></td>
                          <td className="px-2 py-2"><input type="number" min={0} value={it.price || ''} placeholder="0" onChange={e => setItem(i, 'price', parseFloat(e.target.value) || 0)} className="input w-24 text-right py-1.5 text-xs"/></td>
                          <td className="px-2 py-2 text-right font-semibold text-primary whitespace-nowrap">₹{(it.price * it.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          <td className="px-2 py-2"><input value={it.remarks ?? ''} onChange={e => setItem(i, 'remarks', e.target.value)} placeholder="optional" className="input w-28 py-1.5 text-xs"/></td>
                          <td className="px-2 py-2">{items.length > 1 && <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="text-muted hover:text-red-400"><X size={13}/></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ background: 'var(--color-surface)' }}><tr className="border-t border-border"><td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-muted">Total</td><td className="px-3 py-2 text-right text-sm font-bold text-primary">₹{items.reduce((s, it) => s + it.price * it.quantity, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td><td colSpan={2}/></tr></tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 flex-wrap px-4 sm:px-6 py-4 border-t border-border">
              <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => handleSave('label')} disabled={saving} className="btn btn-ghost">{saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Printer size={14}/>}{editing ? 'Update & Label' : 'Save & Label'}</button>
              <button onClick={() => handleSave('invoice')} disabled={saving} className="btn btn-ghost">{saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Printer size={14}/>}{editing ? 'Update & Invoice' : 'Save & Invoice'}</button>
              <button onClick={() => handleSave(false)} disabled={saving} className="btn btn-inputer">{saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Save size={14}/>}{editing ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setViewRow(null) }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-3xl min-w-0 my-4 sm:my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2">
              <h2 className="text-base font-bold text-primary">Domestic — {viewRow.tax_invoice_number || viewRow.invoice_number}</h2>
              <button onClick={() => setViewRow(null)} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Date</div><div className="text-sm font-medium text-primary">{fmtDate(viewRow.invoice_date)}</div></div>
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Customer</div><div className="text-sm font-medium text-primary">{viewRow.customer?.company_name ?? '—'}</div></div>
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Invoice No</div><div className="text-sm font-medium text-primary">{viewRow.tax_invoice_number || viewRow.invoice_number || '—'}</div></div>
                {viewRow.remarks && <div className="col-span-2"><div className="text-xs text-muted uppercase tracking-wider mb-1">Remarks</div><div className="text-sm text-primary">{viewRow.remarks}</div></div>}
              </div>
              {(viewRow.items ?? []).length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead style={{ background: 'var(--color-surface)' }}><tr className="border-b border-border"><th className="text-left px-3 py-2 text-muted font-semibold">Product</th><th className="text-right px-3 py-2 text-muted font-semibold">Qty</th><th className="text-right px-3 py-2 text-muted font-semibold">Price</th><th className="text-right px-3 py-2 text-muted font-semibold">Total</th><th className="text-left px-3 py-2 text-muted font-semibold">Remarks</th></tr></thead>
                    <tbody>
                      {(viewRow.items ?? []).map((it, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-medium text-primary">{it.product?.product_name ?? products.find(p => p.id === it.product_id)?.product_name ?? '—'}</td>
                          <td className="px-3 py-2 text-right">{it.quantity}</td>
                          <td className="px-3 py-2 text-right">₹{it.price}</td>
                          <td className="px-3 py-2 text-right font-semibold">₹{(it.price * it.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          <td className="px-3 py-2 text-muted">{it.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ background: 'var(--color-surface)' }}><tr className="border-t border-border"><td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-muted">Total</td><td className="px-3 py-2 text-right font-bold text-sm text-primary">₹{(viewRow.items ?? []).reduce((s, it) => s + it.price * it.quantity, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td><td/></tr></tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-border">
              <button onClick={() => setViewRow(null)} className="btn btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
          <div className="rounded-2xl shadow-2xl w-full max-w-4xl my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2">
              <div>
                <h2 className="text-base font-bold text-primary">Import Domestic Invoices</h2>
                <p className="text-xs text-muted mt-0.5">{importGroups.filter(g => !g.errors.length && g.items.some((it: any) => it.product_id)).length} valid / {importGroups.length} total records</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadTemplate} className="btn btn-ghost text-xs"><Download size={12}/> Template</button>
                <button onClick={() => { setImportOpen(false); setImportGroups([]) }} className="text-muted hover:text-primary"><X size={18}/></button>
              </div>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="w-full text-xs">
                <thead style={{ background: 'var(--color-surface)', position: 'sticky', top: 0 }}>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-muted font-semibold w-8"></th>
                    <th className="text-left px-3 py-2 text-muted font-semibold">Date</th>
                    <th className="text-left px-3 py-2 text-muted font-semibold">Customer</th>
                    <th className="text-left px-3 py-2 text-muted font-semibold">Factory</th>
                    <th className="text-right px-3 py-2 text-muted font-semibold">Items</th>
                    <th className="text-left px-3 py-2 text-muted font-semibold">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {importGroups.map((g, i) => {
                    const itemErrors = g.items.filter((it: any) => it.error).map((it: any) => it.error)
                    const allErrors = [...g.errors, ...itemErrors]
                    const valid = allErrors.length === 0 && g.items.some((it: any) => it.product_id)
                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-center">{valid ? <span className="text-green-500 font-bold text-sm">✓</span> : <span className="text-red-400 font-bold text-sm">✗</span>}</td>
                        <td className="px-3 py-2 font-mono">{g.invoice_date}</td>
                        <td className="px-3 py-2">{g.customer_name || '—'}</td>
                        <td className="px-3 py-2 text-muted">{g.factory_name || '—'}</td>
                        <td className="px-3 py-2 text-right">{g.items.length}</td>
                        <td className="px-3 py-2 text-red-400">{allErrors.length ? allErrors.join('; ') : <span className="text-green-500">OK</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-xs text-muted">Rows with ✗ will be skipped. Ensure company and product names match exactly.</p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setImportOpen(false); setImportGroups([]) }} className="btn btn-ghost">Cancel</button>
                <button onClick={handleImportConfirm} disabled={importing || !importGroups.some(g => !g.errors.length && g.items.some((it: any) => it.product_id))} className="btn btn-inputer">
                  {importing ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Upload size={14}/>}
                  Import {importGroups.filter(g => !g.errors.length && g.items.some((it: any) => it.product_id)).length} Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProductModal && <ProductModal factoryId={factoryId} onClose={() => setShowProductModal(false)} onSaved={async (p) => { const upd = await fetchProducts(factoryId || undefined); setProducts(upd); setItems(prev => { const last = prev[prev.length-1]; return last && !last.product_id ? [...prev.slice(0,-1), {...last, product_id: p.id}] : prev }); setShowProductModal(false) }}/>}
      {showCompanyModal && <CompanyModal factoryId={factoryId} defaultType="customer" lockCountryName="India" lockCountry={true} onClose={() => setShowCompanyModal(false)} onSaved={async (c) => { const upd = await fetchCompanies('customer', factoryId || undefined); setCompanies(upd); setForm(f => ({ ...f, customer_id: c.id })); setShowCompanyModal(false) }}/>}
    </div>
  )
}
