'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useIOFactory } from '@/contexts/IOFactoryContext'
import { useIoFeatures } from '@/contexts/IoFeaturesContext'
import { fetchInternationals, saveInternational, deleteInternational, fetchCompanies, fetchProducts, fmtDate, today, type IoDocListQuery } from '@madstoq/io-system/api'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from '@/lib/monthlyMaterial'
import type { IOInternational, IOLineItem, IOCompany, IOProduct } from '@madstoq/io-system/types'
import ProductModal from '@/components/io/ProductModal'
import CompanyModal from '@/components/io/CompanyModal'
import CompanyComboSearch from '@/components/io/CompanyComboSearch'
import IoFormModalShell from '@/components/io/IoFormModalShell'
import IoOutwardStyleLineItems from '@/components/io/IoOutwardStyleLineItems'
import { IO_FIELD_LABEL, ioInputClass } from '@/components/io/io-form-styles'
import { Plus, Pencil, Trash2, X, Save, Download, Search, Upload, Printer, Eye, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw, MoreVertical } from 'lucide-react'
import { printLetterHeadInvoice, printLabelForInternational } from '@madstoq/io-system/print'
import { ListPager } from '@/components/ui/ListPager'
import { LIST_PAGE_SIZE } from '@/lib/list-page'

const EMPTY_ITEM = (): IOLineItem => ({ product_id: '', quantity: 1, price: 0, remarks: '' })

export default function InternationalPage() {
  const router = useRouter()
  const { factoryId, factories } = useIOFactory()
  const ioFeatures = useIoFeatures()

  useEffect(() => {
    if (!ioFeatures.international) router.replace('/inward-outward/dashboard')
  }, [router, ioFeatures.international])

  const [rows, setRows] = useState<IOInternational[]>([])
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
  const [editing, setEditing] = useState<IOInternational | null>(null)
  const [form, setForm] = useState({ invoice_date: today(), customer_id: '', tax_invoice_number: '', remarks: '', factory_id: '' })
  const [items, setItems] = useState<IOLineItem[]>([EMPTY_ITEM()])
  const [showProductModal, setShowProductModal] = useState(false)
  const [productModalTargetIndex, setProductModalTargetIndex] = useState<number | null>(null)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [expandedItemIndex, setExpandedItemIndex] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importGroups, setImportGroups] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [printDropdownId, setPrintDropdownId] = useState<string | null>(null)
  const [viewRow, setViewRow] = useState<IOInternational | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [openMobileRowMenuId, setOpenMobileRowMenuId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const listQuery = useCallback((pageNum: number, all = false): IoDocListQuery => {
    const fyStart = Number(String(fiscalYear).replace('FY', '').split('-')[0])
    return {
      factory_id: factoryId || undefined,
      q: debouncedSearch.trim() || undefined,
      party_id: customerFilter !== 'all' ? customerFilter : undefined,
      fy_start: Number.isFinite(fyStart) ? fyStart : undefined,
      month: selectedMonth ? Number(selectedMonth) : undefined,
      date: selectedDate || undefined,
      page: pageNum,
      page_size: LIST_PAGE_SIZE,
      all,
    }
  }, [factoryId, debouncedSearch, customerFilter, fiscalYear, selectedMonth, selectedDate])

  const loadData = useCallback(async () => {
    setLoading(true)
    setPage(1)
    try {
      const [r, c, p] = await Promise.all([
        fetchInternationals(listQuery(1)),
        fetchCompanies('customer', factoryId || undefined),
        fetchProducts(factoryId || undefined),
      ])
      setRows(r.rows); setTotal(r.total); setCompanies(c); setProducts(p)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [factoryId, listQuery])

  useEffect(() => { void loadData() }, [loadData])

  async function goToPage(next: number) {
    if (next < 1 || next === page || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await fetchInternationals(listQuery(next))
      setRows(r.rows)
      setTotal(r.total)
      setPage(next)
    } catch (e) { console.error(e) } finally { setLoadingMore(false) }
  }

  function openNew() {
    setFormError(null)
    setShowValidation(false)
    setProductModalTargetIndex(null)
    setExpandedItemIndex(0)
    setEditing(null)
    setForm({ invoice_date: today(), customer_id: '', tax_invoice_number: '', remarks: '', factory_id: factoryId })
    setItems([EMPTY_ITEM()])
    setShowForm(true)
  }
  function openEdit(row: IOInternational) {
    setFormError(null)
    setShowValidation(false)
    setProductModalTargetIndex(null)
    setExpandedItemIndex(0)
    setEditing(row)
    setForm({ invoice_date: row.invoice_date, customer_id: row.customer_id ?? '', tax_invoice_number: row.tax_invoice_number ?? '', remarks: row.remarks ?? '', factory_id: row.factory_id ?? factoryId })
    setItems(row.items?.length ? row.items.map(it => ({ ...it })) : [EMPTY_ITEM()])
    setShowForm(true)
  }
  async function handleSave(printType: 'invoice' | 'label' | false = false) {
    const validItems = items.filter(it => it.product_id)
    setShowValidation(true)
    if (!form.invoice_date) { setFormError('Select an invoice date before saving.'); return }
    if (!form.customer_id) { setFormError('Select a customer before saving.'); return }
    if (!validItems.length) { setFormError('Add at least one product before saving.'); return }
    if (validItems.some(it => Number(it.price) < 0)) { setFormError('Price cannot be negative.'); return }
    setFormError(null)
    setSaving(true)
    try {
      const saved = await saveInternational({ id: editing?.id, invoice_date: form.invoice_date, customer_id: form.customer_id || null, tax_invoice_number: form.tax_invoice_number || null, remarks: form.remarks || null, factory_id: form.factory_id || factoryId || null, items: validItems })
      setShowForm(false)
      const next = await fetchInternationals(listQuery(1))
      setRows(next.rows)
      setTotal(next.total)
      setPage(1)
      if (printType) {
        const full = next.rows.find(r => r.id === saved.id) ?? saved
        if (full) {
          if (printType === 'invoice') await printLetterHeadInvoice('International', full as any, products)
          else await printLabelForInternational(full as any, products)
        }
      }
    }
    catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function handlePrint(row: IOInternational, printType: 'invoice' | 'label') {
    try {
      if (printType === 'invoice') await printLetterHeadInvoice('International', row as any, products)
      else await printLabelForInternational(row as any, products)
    } catch (e: any) { alert(e.message) }
  }
  async function handleDelete(id: string) { if (!confirm('Delete?')) return; await deleteInternational(id); loadData() }
  function setFormField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    if (formError) setFormError(null)
    setForm(prev => ({ ...prev, [field]: value }))
  }
  function updateItems(updater: (prev: IOLineItem[]) => IOLineItem[]) {
    if (formError) setFormError(null)
    setItems(updater)
  }
  function resetFilters() {
    setSearch('')
    setCustomerFilter('all')
    setFiscalYear(getCurrentFiscalYear())
    setSelectedMonth('')
    setSelectedDate('')
    setShowMobileFilters(false)
  }
  function getProductPreview(its: IOLineItem[] | null | undefined) {
    return (its ?? []).map(it => it.product?.product_name ?? products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ')
  }
  function getRemarksPreview(its: IOLineItem[] | null | undefined) {
    return (its ?? []).map(it => it.remarks?.trim()).filter(Boolean).join(' · ')
  }
  function addItemRow() {
    const incompleteIndex = items.findIndex(it => !it.product_id)
    if (incompleteIndex !== -1) {
      setExpandedItemIndex(incompleteIndex)
      return
    }
    setExpandedItemIndex(items.length)
    updateItems(prev => [...prev, EMPTY_ITEM()])
  }

  function downloadTemplate() {
    const csv = 'Invoice No,Date,Customer,Factory,Product,Qty,Price (₹),Remarks\n,2024-01-15,Customer Name,Factory Name,Product Name,10,500,Optional notes'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'international_template.csv'; a.click()
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
        await saveInternational({ invoice_date: g.invoice_date, customer_id: g.customer_id || null, remarks: null, factory_id: g.factory_id || null, items: g.items.filter((it: any) => it.product_id).map((it: any) => ({ product_id: it.product_id, quantity: it.quantity, price: it.price, remarks: it.remarks })) })
      }
      setImportOpen(false); setImportGroups([]); loadData()
    } catch (e: any) { alert(e.message) } finally { setImporting(false) }
  }

  async function handleExport() {
    const exported = await fetchInternationals(listQuery(1, true))
    const filtered = exported.rows
    if (!filtered.length) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('International')
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
    const a = document.createElement('a'); a.href = url; a.download = 'international.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  const rowTotal = (its: IOLineItem[]) => its.reduce((s, it) => s + it.price * it.quantity, 0)
  const fiscalYears = getFiscalYears(5)
  const canAddItemRow = items.every(it => !!it.product_id)
  const filtered = rows
  const visibleRows = rows
  const selectedMonthLabel = monthOptions.find(m => String(m.value) === selectedMonth)?.label
  const activeCustomerLabel = customerFilter === 'all' ? 'All Customers' : companies.find(c => c.id === customerFilter)?.company_name ?? 'Selected Customer'
  const currentFiscalYear = getCurrentFiscalYear()
  const hasAdvancedFilters = !!search.trim() || customerFilter !== 'all' || fiscalYear !== currentFiscalYear || !!selectedMonth || !!selectedDate
  const activeFilterCount = [!!search.trim(), customerFilter !== 'all', fiscalYear !== currentFiscalYear, !!selectedMonth, !!selectedDate].filter(Boolean).length


  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportFile}/>

      <div className="sm:hidden mb-3">
        <div className="card overflow-hidden">
          <div className="h-1 w-full bg-inputer/60" />
          <div className="p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div><h1 className="text-2xl font-bold text-primary">International</h1><p className="mt-1 text-sm text-muted">{total} invoices</p></div>
              <div className="badge badge-inputer whitespace-nowrap">{fiscalYear}</div>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <button onClick={openNew} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors" style={{ color: 'var(--color-inputer)', borderColor: 'color-mix(in srgb, var(--color-inputer) 32%, var(--color-border))', background: 'color-mix(in srgb, var(--color-inputer) 12%, var(--color-panel))' }}><Plus size={15}/> New Invoice</button>
              <div className="flex items-center gap-1.5">
                <button onClick={() => importRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel text-primary transition-colors hover:bg-layer" aria-label="Import international invoices" title="Import"><Download size={16}/></button>
                <button onClick={handleExport} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel text-primary transition-colors hover:bg-layer" aria-label="Export international invoices" title="Export"><Upload size={16}/></button>
              </div>
            </div>
            <div className="border-t border-border pt-2.5">
              <div className="input flex items-center gap-2"><Search size={14} className="text-muted flex-shrink-0"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"/></div>
              <div className="mt-2.5 flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-inputer text-[10px] font-sans">{fiscalYear}</span>
                  {customerFilter !== 'all' && <span className="badge badge-muted text-[10px] font-sans">{activeCustomerLabel}</span>}
                  {selectedMonth && <span className="badge badge-muted text-[10px] font-sans">{selectedMonthLabel}</span>}
                  {selectedDate && <span className="badge badge-muted text-[10px] font-sans">{fmtDate(selectedDate)}</span>}
                </div>
                <button onClick={() => setShowMobileFilters(v => !v)} className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-layer"><span className="flex items-center gap-1.5"><SlidersHorizontal size={13}/> Filters {showMobileFilters ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}</span></button>
              </div>
              {showMobileFilters && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="input w-full text-sm"><option value="all">All Customers</option>{companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
                  <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} className="input w-full text-sm">{fiscalYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}</select>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input w-full text-sm"><option value="">All Months</option>{monthOptions.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}</select>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-full text-sm" aria-label="Filter by date"/>
                  </div>
                  {hasAdvancedFilters && <button onClick={resetFilters} className="mt-1 inline-flex items-center gap-1 self-start rounded-lg px-1 py-1 text-xs font-medium text-muted transition-colors hover:text-primary"><RotateCcw size={13}/> Reset filters</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden sm:flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div><h1 className="text-xl font-bold text-primary">International</h1><p className="text-sm text-muted mt-0.5">{total} invoices</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => importRef.current?.click()} className="btn btn-ghost"><Download size={14}/> Import</button>
          <button onClick={handleExport} className="btn btn-ghost"><Upload size={14}/> Export</button>
          <button onClick={openNew} className="btn btn-inputer"><Plus size={15}/> New Invoice</button>
        </div>
      </div>
      <div className="hidden sm:flex flex-wrap lg:flex-nowrap items-center gap-2 mb-4">
        <div className="input flex items-center gap-2 w-full md:w-[320px]">
          <Search size={14} className="text-muted flex-shrink-0"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"/>
        </div>
        <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="input w-full md:w-[220px] text-sm">
          <option value="all">All Customers</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
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
      <div className="card overflow-visible border-transparent bg-transparent shadow-none sm:border-border sm:bg-panel sm:shadow-sm">
        <div className="sm:hidden p-3 space-y-3" style={{ background: 'color-mix(in srgb, var(--color-text) 2%, transparent)' }}>
          <div className="flex items-center justify-between gap-3 px-1">
            <div><div className="text-sm font-semibold text-primary">Records</div><div className="text-xs text-muted">Showing {visibleRows.length} of {total} results · Tap a card to view</div></div>
            {activeFilterCount > 0 && <div className="text-xs text-muted whitespace-nowrap">{activeFilterCount} filters active</div>}
          </div>
          {loading ? <div className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin"/></div>
          : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-panel p-8 text-center text-muted text-sm">No international invoices found for the current search and filters.</div>
          : visibleRows.map(row => (
            <div key={row.id} className="rounded-2xl border border-border bg-panel p-4 shadow-sm transition-colors hover:bg-layer-sm" onClick={() => { setOpenMobileRowMenuId(null); setViewRow(row) }} role="button" tabIndex={0}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold text-xs text-inputer">{row.tax_invoice_number || row.invoice_number || '—'}</span><span className="text-xs text-muted">{fmtDate(row.invoice_date)}</span></div>
                  <div className="mt-2 text-lg font-semibold text-primary">{row.customer?.company_name ?? '—'}</div>
                </div>
                <div className="relative flex shrink-0 items-start">
                  <button onClick={(e) => { e.stopPropagation(); setOpenMobileRowMenuId(current => current === row.id ? null : row.id) }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-layer hover:text-primary"><MoreVertical size={15}/></button>
                  {openMobileRowMenuId === row.id && <div className="absolute right-0 top-10 z-10 min-w-[150px] rounded-xl border border-border bg-panel p-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setOpenMobileRowMenuId(null); openEdit(row) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-layer hover:text-primary"><Pencil size={14}/> Edit</button>
                    <button onClick={() => { setOpenMobileRowMenuId(null); handlePrint(row, 'invoice') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-layer hover:text-primary"><Printer size={14}/> Invoice</button>
                    <button onClick={() => { setOpenMobileRowMenuId(null); handlePrint(row, 'label') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-layer hover:text-primary"><Printer size={14}/> Label</button>
                    <button onClick={() => { setOpenMobileRowMenuId(null); handleDelete(row.id) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"><Trash2 size={14}/> Delete</button>
                  </div>}
                </div>
              </div>
              {getProductPreview(row.items) && <div className="mt-3 min-w-0 text-sm font-medium text-primary">{getProductPreview(row.items)}</div>}
              {getRemarksPreview(row.items) && <div className="mt-1.5 min-w-0 text-xs text-muted"><span className="font-medium">Remark:</span> {getRemarksPreview(row.items)}</div>}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
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
              : filtered.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-muted text-sm">No international invoices</td></tr>
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
      {!loading && (
        <div className="mt-4 flex justify-center">
          <ListPager page={page} total={total} disabled={loadingMore} onPage={(next) => void goToPage(next)} />
        </div>
      )}

      {/* View Modal */}
      {viewRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setViewRow(null) }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-3xl min-w-0 my-4 sm:my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2">
              <h2 className="text-base font-bold text-primary">Invoice — {viewRow.tax_invoice_number || viewRow.invoice_number}</h2>
              <button onClick={() => setViewRow(null)} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Date</div><div className="text-sm font-medium text-primary">{fmtDate(viewRow.invoice_date)}</div></div>
                <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Customer</div><div className="text-sm font-medium text-primary">{viewRow.customer?.company_name ?? '—'}</div></div>
                {viewRow.factory && <div><div className="text-xs text-muted uppercase tracking-wider mb-1">Factory</div><div className="text-sm font-medium text-primary">{viewRow.factory.name}</div></div>}
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

      <IoFormModalShell
        show={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Invoice' : 'New International Invoice'}
        closeAriaLabel="Close international invoice form"
        editing={!!editing}
        footer={
          <div className="space-y-3">
            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-ghost min-h-0 h-10 justify-center rounded-lg px-4 text-sm sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave('label')}
                disabled={saving}
                className="btn btn-ghost min-h-0 h-10 justify-center rounded-lg px-4 text-sm sm:w-auto"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Printer size={14} />
                )}
                {editing ? 'Update & Label' : 'Save & Label'}
              </button>
              <button
                type="button"
                onClick={() => handleSave('invoice')}
                disabled={saving}
                className="btn btn-ghost min-h-0 h-10 justify-center rounded-lg px-4 text-sm sm:w-auto"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Printer size={14} />
                )}
                {editing ? 'Update & Invoice' : 'Save & Invoice'}
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="btn btn-inputer col-span-2 min-h-0 h-11 justify-center rounded-lg px-4 text-sm sm:col-span-1 sm:w-auto"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Save size={14} />
                )}
                {editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Order Details</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Tax Invoice Number</label>
                <input
                  value={form.tax_invoice_number}
                  onChange={e => setFormField('tax_invoice_number', e.target.value)}
                  placeholder="Enter invoice number"
                  className={ioInputClass()}
                />
              </div>
              <div>
                <div className="mb-1 flex h-7 items-center">
                  <label className={IO_FIELD_LABEL}>
                    Date <span className="text-red-400">*</span>
                  </label>
                </div>
                <input
                  type="date"
                  value={form.invoice_date}
                  onChange={e => setFormField('invoice_date', e.target.value)}
                  className={ioInputClass(showValidation && !form.invoice_date)}
                />
              </div>
              {factories.length > 1 && (
                <div>
                  <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Factory</label>
                  <select
                    value={form.factory_id}
                    onChange={e => setFormField('factory_id', e.target.value)}
                    className={ioInputClass()}
                  >
                    <option value="">— Select —</option>
                    {factories.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <div className="mb-1 flex h-7 items-center justify-between gap-3">
                  <label className={IO_FIELD_LABEL}>
                    Customer <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCompanyModal(true)}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-inputer transition-colors hover:bg-layer hover:text-primary"
                  >
                    <Plus size={12} /> Add Customer
                  </button>
                </div>
                <CompanyComboSearch
                  companies={companies}
                  value={form.customer_id}
                  onChange={v => setFormField('customer_id', v)}
                  placeholder="— Select Customer —"
                  inputClassName={ioInputClass(showValidation && !form.customer_id)}
                />
              </div>
              <div className="md:col-span-2">
                <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Customer Remarks</label>
                <input
                  value={form.remarks}
                  onChange={e => setFormField('remarks', e.target.value)}
                  placeholder="Remarks for customer"
                  className={ioInputClass()}
                />
              </div>
            </div>
          </div>

          <IoOutwardStyleLineItems
            items={items}
            products={products}
            showQuantity
            expandedItemIndex={expandedItemIndex}
            onExpandedItemIndexChange={setExpandedItemIndex}
            onItemsChange={updateItems}
            onAddRow={addItemRow}
            canAddRow={canAddItemRow}
            onOpenProductModal={i => {
              setProductModalTargetIndex(i)
              setShowProductModal(true)
            }}
          />
        </div>
      </IoFormModalShell>

      {/* Import Preview Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
          <div className="rounded-2xl shadow-2xl w-full max-w-4xl my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border gap-2">
              <div>
                <h2 className="text-base font-bold text-primary">Import International Invoices</h2>
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

      {showProductModal && (
        <ProductModal
          factoryId={factoryId}
          onClose={() => { setShowProductModal(false); setProductModalTargetIndex(null) }}
          onSaved={async p => {
            const upd = await fetchProducts(factoryId || undefined)
            setProducts(upd)
            updateItems(prev =>
              prev.map((item, idx) =>
                idx === (productModalTargetIndex ?? prev.findIndex(entry => !entry.product_id))
                  ? { ...item, product_id: p.id }
                  : item,
              ),
            )
            setShowProductModal(false)
            setProductModalTargetIndex(null)
          }}
        />
      )}
      {showCompanyModal && (
        <CompanyModal
          factoryId={factoryId}
          defaultType="customer"
          onClose={() => setShowCompanyModal(false)}
          onSaved={async c => {
            const upd = await fetchCompanies('customer', factoryId || undefined)
            setCompanies(upd)
            setFormField('customer_id', c.id)
            setShowCompanyModal(false)
          }}
        />
      )}
    </div>
  )
}
