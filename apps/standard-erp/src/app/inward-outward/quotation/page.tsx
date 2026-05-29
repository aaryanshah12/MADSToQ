'use client'
import { useState, useEffect, useRef } from 'react'
import { useIOFactory } from '@/contexts/IOFactoryContext'
import { fetchQuotations, saveQuotation, deleteQuotation, fetchCompanies, fetchProducts, fetchOutwardByRefNo, searchOutwards, fmtDate, today } from '@madstoq/io-system/api'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from '@/lib/monthlyMaterial'
import type { IOQuotation, IOQuotationItem, IOCompany, IOProduct } from '@madstoq/io-system/types'
import ProductModal from '@/components/io/ProductModal'
import CompanyModal from '@/components/io/CompanyModal'
import RichTextEditor from '@/components/io/RichTextEditor'
import { Plus, Pencil, Trash2, X, Save, Download, Upload, Printer, Eye } from 'lucide-react'
import { ListSearchField, ListSearchToolbar, listSearchBtnClass } from '@/components/layout/ListSearchToolbar'
import { printLetterHeadQuotation } from '@madstoq/io-system/print'

const EMPTY_ITEM = (): IOQuotationItem => ({ reference_no: '', product_id: '', product_name_override: '', price: 0 })

const DEFAULT_HEADER = `Respected Mr,

Greetings of the Day !!!

As per your request, we are offering our current price offer for the below mentioned products.`

const DEFAULT_FOOTER = `The above price is for
* 25 KG HDPE bags or 500Kg Jumbo Bag packing
* Any other type of packing will cost extra`

export default function QuotationPage() {
  const { factoryId, factories } = useIOFactory()
  const [rows, setRows] = useState<IOQuotation[]>([])
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
  const [editing, setEditing] = useState<IOQuotation | null>(null)
  const [form, setForm] = useState({
    quotation_date: today(), customer_id: '', factory_id: '',
    header_content: DEFAULT_HEADER, footer_content: DEFAULT_FOOTER,
  })
  const [items, setItems] = useState<IOQuotationItem[]>([EMPTY_ITEM()])
  const [showProductModal, setShowProductModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [outwardMatches, setOutwardMatches] = useState<any[]>([])
  const [outwardSearching, setOutwardSearching] = useState(false)
  const [activeOutwardRow, setActiveOutwardRow] = useState<number | null>(null)
  const [activeOutwardQuery, setActiveOutwardQuery] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importGroups, setImportGroups] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [viewRow, setViewRow] = useState<IOQuotation | null>(null)
  const [visibleCount, setVisibleCount] = useState(60)

  useEffect(() => { loadData() }, [factoryId])

  async function loadData() {
    setLoading(true)
    try {
      const [r, c, p] = await Promise.all([fetchQuotations(factoryId || undefined), fetchCompanies('customer', factoryId || undefined), fetchProducts(factoryId || undefined)])
      setRows(r); setCompanies(c); setProducts(p)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  function openNew() {
    setEditing(null)
    setForm({ quotation_date: today(), customer_id: '', factory_id: factoryId, header_content: DEFAULT_HEADER, footer_content: DEFAULT_FOOTER })
    setItems([EMPTY_ITEM()]); setShowForm(true)
  }
  function openEdit(row: IOQuotation) {
    setEditing(row)
    setForm({
      quotation_date: row.quotation_date, customer_id: row.customer_id ?? '',
      factory_id: row.factory_id ?? factoryId,
      header_content: row.header_content ?? DEFAULT_HEADER,
      footer_content: row.footer_content ?? DEFAULT_FOOTER,
    })
    setItems(row.items?.length ? row.items.map(it => ({ ...it })) : [EMPTY_ITEM()]); setShowForm(true)
  }
  async function handleSave(doPrint = false) {
    const validItems = items.filter(it => it.price > 0 && (it.product_id || it.product_name_override))
    if (!validItems.length) { alert('Add at least one item with a price.'); return }
    setSaving(true)
    try {
      const saved = await saveQuotation({
        id: editing?.id,
        quotation_date: form.quotation_date,
        customer_id: form.customer_id || null,
        factory_id: form.factory_id || factoryId || null,
        // backward-compatible: keep outward_ref_no as a comma-separated summary for reporting
        outward_ref_no: Array.from(new Set(validItems.map(it => (it.reference_no ?? '').trim()).filter(Boolean))).join(', ') || null,
        header_content: form.header_content || null,
        footer_content: form.footer_content || null,
        items: validItems,
      })
      setShowForm(false)
      const next = await fetchQuotations(factoryId || undefined)
      setRows(next)
      if (doPrint) {
        const full = next.find(r => r.id === saved.id) ?? (editing ?? null)
        if (full) await printLetterHeadQuotation(full, products)
      }
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function handlePrint(row: IOQuotation) {
    try {
      await printLetterHeadQuotation(row, products)
    } catch (e: any) {
      alert(e.message)
    }
  }
  async function handleDelete(id: string) { if (!confirm('Delete?')) return; await deleteQuotation(id); loadData() }
  function setItem(i: number, field: keyof IOQuotationItem, value: any) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it)) }

  function downloadTemplate() {
    const csv = 'Quotation No,Date,Customer,Factory,Ref No,Product,Price (₹)\n,2024-01-15,Customer Name,Factory Name,Q001,Product Name,1500'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'quotation_template.csv'; a.click()
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
      const date = col(cols, 'date'); const customerName = col(cols, 'customer'); const factoryName = col(cols, 'factory'); const refNo = col(cols, 'ref no'); const productName = col(cols, 'product'); const priceStr = col(cols, 'price (₹)') || col(cols, 'price')
      const company = companies.find(c => c.company_name.toLowerCase() === customerName.toLowerCase())
      const factory = factories.find(f => f.name.toLowerCase() === factoryName.toLowerCase())
      const product = products.find(p => p.product_name.toLowerCase() === productName.toLowerCase())
      const key = `${date}|${company?.id ?? customerName}|${factory?.id ?? ''}`
      if (!map[key]) {
        const errors: string[] = []
        if (!company) errors.push(`Customer "${customerName}" not found`)
        const chosenFactoryId = factory?.id ?? factoryId
        if (!chosenFactoryId && factories.length > 1 && factoryName) errors.push(`Factory "${factoryName}" not found`)
        map[key] = { quotation_date: date, customer_id: company?.id ?? '', customer_name: company?.company_name ?? customerName, factory_id: chosenFactoryId, factory_name: factory?.name ?? factoryName ?? '', items: [], errors }
      }
      map[key].items.push({ reference_no: refNo ?? '', product_id: product?.id ?? '', product_name: product?.product_name ?? productName, product_name_override: product ? '' : (productName ?? ''), price: parseFloat(priceStr) || 0, error: (!product && !productName) ? 'Missing product' : '' })
    }
    setImportGroups(Object.values(map)); setImportOpen(true)
  }
  async function handleImportConfirm() {
    const valid = importGroups.filter(g => !g.errors.length && g.items.some((it: any) => it.price > 0))
    if (!valid.length) return
    setImporting(true)
    try {
      for (const g of valid) {
        await saveQuotation({ quotation_date: g.quotation_date, customer_id: g.customer_id || null, factory_id: g.factory_id || null, header_content: null, footer_content: null, items: g.items.filter((it: any) => it.price > 0).map((it: any) => ({ reference_no: it.reference_no, product_id: it.product_id || null, product_name_override: it.product_name_override || '', price: it.price })) })
      }
      setImportOpen(false); setImportGroups([]); loadData()
    } catch (e: any) { alert(e.message) } finally { setImporting(false) }
  }

  async function handleExport() {
    if (!filtered.length) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Quotations')
    const headers = ['Quotation No', 'Date', 'Customer', 'Factory', 'Ref No', 'Product', 'Price (₹)']
    const hRow = ws.addRow(headers)
    hRow.font = { bold: true, size: 11 }
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    hRow.border = { bottom: { style: 'thin', color: { argb: 'FFCCA300' } } }
    hRow.alignment = { vertical: 'middle' }
    filtered.forEach(r => {
      const base = [r.quotation_number, r.quotation_date, r.customer?.company_name ?? '', r.factory?.name ?? '']
      if (!(r.items ?? []).length) { ws.addRow([...base, '', '', '']); return }
      ;(r.items ?? []).forEach((it: IOQuotationItem) => ws.addRow([...base, it.reference_no ?? '', it.product_name_override || (products.find(p => p.id === it.product_id)?.product_name ?? ''), it.price]))
    })
    ws.columns.forEach((col, i) => { col.width = Math.min(Math.max(headers[i].length + 4, 14), 40) })
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'quotations.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  const rowTotal = (its: IOQuotationItem[]) => its.reduce((s, it) => s + it.price, 0)
  const fiscalYears = getFiscalYears(5)
  const filtered = rows.filter(r => {
    const matchSearch = r.quotation_number.toLowerCase().includes(search.toLowerCase()) || (r.customer?.company_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCustomer = customerFilter === 'all' || r.customer_id === customerFilter
    const rowDate = new Date(r.quotation_date)
    const fyStart = Number(fiscalYear.replace('FY', '').split('-')[0])
    const matchFiscalYear = rowDate >= new Date(fyStart, 3, 1) && rowDate < new Date(fyStart + 1, 3, 1)
    const matchMonth = !selectedMonth || (rowDate.getMonth() + 1) === Number(selectedMonth)
    const matchDate = !selectedDate || r.quotation_date === selectedDate
    return matchSearch && matchCustomer && matchFiscalYear && matchMonth && matchDate
  })
  const visibleRows = filtered.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(60)
  }, [search, customerFilter, fiscalYear, selectedMonth, selectedDate])

  async function applyOutwardRefForRow(rowIdx: number, ref: string) {
    const v = (ref ?? '').trim()
    if (!v) return
    try {
      const out = await fetchOutwardByRefNo(v, form.factory_id || factoryId || undefined)
      if (!out) return
      const outNo = (out.outward_number ?? v).trim()

      // Prevent selecting the same outward twice in a quotation
      const alreadyUsed = items.some((it, idx) => idx !== rowIdx && (it.reference_no ?? '').trim() === outNo)
      if (alreadyUsed) {
        alert(`Outward ${outNo} is already added in this quotation.`)
        return
      }

      const mapped: IOQuotationItem[] = (out.items ?? [])
        .filter((it: any) => it.product_id)
        .map((it: any) => ({
          reference_no: outNo,
          product_id: it.product_id,
          // Store product name for display even if product list isn't loaded yet
          product_name_override: it.product?.product_name ?? '',
          price: Number(it.price) || 0,
        }))
      if (mapped.length) {
        setItems(prev => {
          const next = [...prev]
          // replace current row with first item
          next[rowIdx] = { ...next[rowIdx], ...mapped[0] }
          // insert remaining items after
          if (mapped.length > 1) next.splice(rowIdx + 1, 0, ...mapped.slice(1))
          return next
        })
      }
      if (!form.customer_id && out.supplier_id) setForm(f => ({ ...f, customer_id: String(out.supplier_id) }))

      // Close suggestions after successful selection
      setActiveOutwardRow(null)
      setActiveOutwardQuery('')
      setOutwardMatches([])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    const q = (activeOutwardQuery ?? '').trim()
    if (!q) { setOutwardMatches([]); return }
    const t = window.setTimeout(async () => {
      setOutwardSearching(true)
      try {
        const res = await searchOutwards(q, form.factory_id || factoryId || undefined)
        // Hide outwards already added (except for the currently edited row value)
        const used = new Set(items.map(it => (it.reference_no ?? '').trim()).filter(Boolean))
        const current = activeOutwardRow != null ? (items[activeOutwardRow]?.reference_no ?? '').trim() : ''
        if (current) used.delete(current)
        setOutwardMatches((res ?? []).filter((o: any) => !used.has((o.outward_number ?? '').trim())))
      } catch (e) {
        console.error(e)
      } finally {
        setOutwardSearching(false)
      }
    }, 250)
    return () => window.clearTimeout(t)
  }, [activeOutwardQuery, activeOutwardRow, items, form.factory_id, factoryId])

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div><h1 className="text-xl font-bold text-primary">Quotations</h1><p className="text-sm text-muted mt-0.5">{filtered.length} records</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportFile}/>
          <button onClick={() => importRef.current?.click()} className="btn btn-ghost"><Upload size={14}/> Import</button>
          <button onClick={handleExport} className="btn btn-ghost"><Download size={14}/> Export</button>
        </div>
      </div>

      <ListSearchToolbar className="mb-4 flex-wrap">
        <ListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search quotation or customer..."
        />
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="input list-search-side w-full sm:w-[220px] text-sm"
        >
          <option value="all">All Customers</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(e.target.value)}
          className="input list-search-side w-full sm:w-[170px] text-sm"
        >
          {fiscalYears.map((fy) => (
            <option key={fy} value={fy}>{fy}</option>
          ))}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input list-search-side w-full sm:w-[160px] text-sm"
          aria-label="Filter by month"
        >
          <option value="">All Months</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={String(m.value)}>{m.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input list-search-side w-full sm:w-[160px] text-sm"
          aria-label="Filter by date"
        />
        <button type="button" onClick={openNew} className={listSearchBtnClass('btn-inputer')}>
          <Plus size={15} /> New Quotation
        </button>
      </ListSearchToolbar>

      <div className="card overflow-hidden">
        <div className="sm:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {loading ? <div className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin"/></div>
          : filtered.length === 0 ? <div className="py-12 text-center text-muted text-sm">No quotations</div>
          : visibleRows.map(row => (
            <div key={row.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono font-semibold text-xs text-inputer">{row.quotation_number}</div>
                  <div className="text-xs text-muted mt-0.5">{fmtDate(row.quotation_date)}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setViewRow(row)} className="p-2 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="View"><Eye size={14}/></button>
                  <button onClick={() => handlePrint(row)} className="p-2 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="Print"><Printer size={14}/></button>
                  <button onClick={() => openEdit(row)} className="p-2 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={14}/></button>
                  <button onClick={() => handleDelete(row.id)} className="p-2 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                </div>
              </div>
              <div className="text-sm font-medium text-primary">{row.customer?.company_name ?? '—'}</div>
              {(row.items ?? []).length > 0 && (
                <div className="text-xs text-muted truncate">{(row.items ?? []).map(it => it.product_name_override || it.product?.product_name || products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ')}</div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-xs text-muted">{row.items?.length ?? 0} items</span>
                <span className="font-bold text-sm text-primary">₹{rowTotal(row.items ?? []).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Quotation No</th><th>Date</th><th>Customer</th><th>Products</th><th className="text-right">Total</th><th className="text-right">Items</th><th/></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin"/></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted text-sm">No quotations</td></tr>
              : visibleRows.map(row => (
                <tr key={row.id}>
                  <td className="font-mono font-semibold text-xs">{row.quotation_number}</td>
                  <td className="text-xs">{fmtDate(row.quotation_date)}</td>
                  <td>{row.customer?.company_name ?? '—'}</td>
                  <td className="text-xs text-muted max-w-[180px]"><div className="truncate" title={(row.items ?? []).map(it => it.product_name_override || it.product?.product_name || products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ')}>{(row.items ?? []).map(it => it.product_name_override || it.product?.product_name || products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ') || '—'}</div></td>
                  <td className="text-right font-semibold text-xs">₹{rowTotal(row.items ?? []).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="text-right text-xs text-muted">{row.items?.length ?? 0}</td>
                  <td className="text-right"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewRow(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="View"><Eye size={13}/></button>
                    <button onClick={() => handlePrint(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="Print"><Printer size={13}/></button>
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
          <div className="rounded-2xl shadow-2xl w-full max-w-3xl min-w-0 my-4 sm:my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2">
              <h2 className="text-base font-bold text-primary">{editing ? 'Edit Quotation' : 'New Quotation'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Date</label>
                  <input type="date" value={form.quotation_date} onChange={e => setForm(f => ({ ...f, quotation_date: e.target.value }))} className="input w-full"/>
                </div>
                {factories.length > 1 && (
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Factory</label>
                    <select value={form.factory_id} onChange={e => setForm(f => ({ ...f, factory_id: e.target.value }))} className="input w-full">
                      <option value="">— Select —</option>
                      {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted uppercase tracking-wider">Customer</label>
                    <button onClick={() => setShowCompanyModal(true)} className="text-[11px] text-inputer hover:underline">+ Add New</button>
                  </div>
                  <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="input w-full">
                    <option value="">— Select Customer —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider">Header Content</label>
                  <button onClick={() => setForm(f => ({ ...f, header_content: DEFAULT_HEADER }))} className="text-[11px] text-inputer hover:underline">Reset to default</button>
                </div>
                <RichTextEditor
                  value={form.header_content}
                  onChange={val => setForm(f => ({ ...f, header_content: val }))}
                  placeholder="Header shown at top of quotation…"
                  minHeight={110}
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-primary">Items</h3>
                  <button
                    onClick={() => setItems(p => [...p, EMPTY_ITEM()])}
                    className="text-xs text-inputer hover:underline flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Add Row"
                  >
                    <Plus size={12}/> Add Row
                  </button>
                </div>
                <div className="border border-border rounded-xl overflow-x-auto sm:overflow-visible -mx-1 px-1 sm:mx-0 sm:px-0">
                  <table className="w-full text-xs min-w-[560px] sm:min-w-0">
                    <thead style={{ background: 'var(--color-surface)' }}>
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-muted">Outward Ref No</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted">Product</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted">Price</th>
                        <th className="px-2"/>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-2 py-2">
                            <div className="relative">
                              <input
                                value={it.reference_no ?? ''}
                                onFocus={() => { setActiveOutwardRow(i); setActiveOutwardQuery(it.reference_no ?? '') }}
                                onChange={e => { setItem(i, 'reference_no', e.target.value); setActiveOutwardRow(i); setActiveOutwardQuery(e.target.value) }}
                                onBlur={e => { applyOutwardRefForRow(i, e.target.value); window.setTimeout(() => setActiveOutwardRow(null), 120) }}
                                placeholder="Type & select…"
                                className="input w-40 py-1.5 text-xs"
                              />
                              {/* Show dropdown for the focused row */}
                              {activeOutwardRow === i && (outwardSearching || outwardMatches.length > 0) && (
                                <div className="absolute z-[90] mt-2 w-[360px] max-w-[70vw] border border-border rounded-xl overflow-hidden shadow-lg"
                                  style={{ background: 'var(--color-panel)' }}>
                                  {outwardSearching && (
                                    <div className="px-3 py-2 text-xs text-muted">Searching outwards…</div>
                                  )}
                                  {!outwardSearching && outwardMatches.length > 0 && (
                                    <div className="max-h-[260px] overflow-y-auto">
                                      {outwardMatches.map((o: any) => (
                                        <button
                                          key={o.id}
                                          type="button"
                                          onMouseDown={e => {
                                            e.preventDefault()
                                            setItem(i, 'reference_no', o.outward_number)
                                            setActiveOutwardRow(i)
                                            setActiveOutwardQuery(o.outward_number)
                                            applyOutwardRefForRow(i, o.outward_number)
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-layer-sm transition-colors border-b border-border last:border-b-0"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="font-mono text-xs font-semibold text-inputer">{o.outward_number}</div>
                                            <div className="text-[11px] text-muted">{o.outward_date}</div>
                                          </div>
                                          <div className="text-xs text-primary mt-0.5">{o.supplier?.company_name ?? '—'}</div>
                                          {o.supplier_ref_no && <div className="text-[11px] text-muted mt-0.5">Ref: {o.supplier_ref_no}</div>}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 min-w-[200px]">
                            <input
                              value={products.find(p => p.id === it.product_id)?.product_name ?? it.product_name_override ?? ''}
                              readOnly
                              placeholder={it.reference_no ? 'Product (from outward)' : 'Select outward first'}
                              className="input w-full py-1.5 text-xs opacity-80"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" min={0} value={it.price || ''} placeholder="0" onChange={e => setItem(i, 'price', parseFloat(e.target.value) || 0)} className="input w-28 text-right py-1.5 text-xs"/>
                          </td>
                          <td className="px-2 py-2">
                            {items.length > 1 && <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="text-muted hover:text-red-400"><X size={13}/></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ background: 'var(--color-surface)' }}>
                      <tr className="border-t border-border">
                        <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-muted">Total</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-primary">
                          ₹{items.reduce((s, it) => s + it.price, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider">Footer Content</label>
                  <button onClick={() => setForm(f => ({ ...f, footer_content: DEFAULT_FOOTER }))} className="text-[11px] text-inputer hover:underline">Reset to default</button>
                </div>
                <RichTextEditor
                  value={form.footer_content}
                  onChange={val => setForm(f => ({ ...f, footer_content: val }))}
                  placeholder="Footer text, terms and conditions…"
                  minHeight={90}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 flex-wrap px-4 sm:px-6 py-4 border-t border-border">
              <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => handleSave(true)} disabled={saving} className="btn btn-ghost">
                {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Printer size={14}/>}
                {editing ? 'Update & Print' : 'Save & Print'}
              </button>
              <button onClick={() => handleSave(false)} disabled={saving} className="btn btn-inputer">
                {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Save size={14}/>}
                {editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setViewRow(null) }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-3xl min-w-0 my-4 sm:my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2">
              <h2 className="text-base font-bold text-primary">Quotation — {viewRow.quotation_number}</h2>
              <button onClick={() => setViewRow(null)} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Date</div><div className="text-sm font-medium text-primary">{fmtDate(viewRow.quotation_date)}</div></div>
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Customer</div><div className="text-sm font-medium text-primary">{viewRow.customer?.company_name ?? '—'}</div></div>
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Outward Ref</div><div className="text-sm font-medium text-primary">{viewRow.outward_ref_no || '—'}</div></div>
              </div>
              {(viewRow.items ?? []).length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead style={{ background: 'var(--color-surface)' }}><tr className="border-b border-border"><th className="text-left px-3 py-2 text-muted font-semibold">Outward Ref</th><th className="text-left px-3 py-2 text-muted font-semibold">Product</th><th className="text-right px-3 py-2 text-muted font-semibold">Price</th></tr></thead>
                    <tbody>
                      {(viewRow.items ?? []).map((it, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-muted">{it.reference_no || '—'}</td>
                          <td className="px-3 py-2 font-medium text-primary">{it.product_name_override || it.product?.product_name || products.find(p => p.id === it.product_id)?.product_name || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold">₹{it.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ background: 'var(--color-surface)' }}><tr className="border-t border-border"><td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-muted">Total</td><td className="px-3 py-2 text-right font-bold text-sm text-primary">₹{(viewRow.items ?? []).reduce((s, it) => s + it.price, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end flex-wrap gap-2 px-4 sm:px-6 py-4 border-t border-border">
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
                <h2 className="text-base font-bold text-primary">Import Quotations</h2>
                <p className="text-xs text-muted mt-0.5">{importGroups.filter(g => !g.errors.length && g.items.some((it: any) => it.price > 0)).length} valid / {importGroups.length} total records</p>
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
                    const allErrors = [...g.errors]
                    const valid = allErrors.length === 0 && g.items.some((it: any) => it.price > 0)
                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-center">{valid ? <span className="text-green-500 font-bold text-sm">✓</span> : <span className="text-red-400 font-bold text-sm">✗</span>}</td>
                        <td className="px-3 py-2 font-mono">{g.quotation_date}</td>
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
            <div className="flex items-center justify-between flex-wrap gap-2 px-4 sm:px-6 py-4 border-t border-border">
              <p className="text-xs text-muted">Rows with ✗ will be skipped. Customer names must match exactly.</p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setImportOpen(false); setImportGroups([]) }} className="btn btn-ghost">Cancel</button>
                <button onClick={handleImportConfirm} disabled={importing || !importGroups.some(g => !g.errors.length && g.items.some((it: any) => it.price > 0))} className="btn btn-inputer">
                  {importing ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Upload size={14}/>}
                  Import {importGroups.filter(g => !g.errors.length && g.items.some((it: any) => it.price > 0)).length} Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProductModal && <ProductModal factoryId={factoryId} onClose={() => setShowProductModal(false)} onSaved={async (p) => { const upd = await fetchProducts(factoryId || undefined); setProducts(upd); setItems(prev => { const last = prev[prev.length-1]; return last && !last.product_id ? [...prev.slice(0,-1), {...last, product_id: p.id}] : prev }); setShowProductModal(false) }}/>}
      {showCompanyModal && <CompanyModal factoryId={factoryId} defaultType="customer" onClose={() => setShowCompanyModal(false)} onSaved={async (c) => { const upd = await fetchCompanies('customer', factoryId || undefined); setCompanies(upd); setForm(f => ({ ...f, customer_id: c.id })); setShowCompanyModal(false) }}/>}
    </div>
  )
}
