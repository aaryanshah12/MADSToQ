'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useIOFactory } from '@/contexts/IOFactoryContext'
import { fetchQuotations, saveQuotation, deleteQuotation, fetchCompanies, fetchProducts, fetchOutwardByRefNo, searchOutwards, fmtDate, today, type IoDocListQuery } from '@madstoq/io-system/api'
import { getCurrentFiscalYear, getFiscalYears, monthOptions } from '@/lib/monthlyMaterial'
import type { IOQuotation, IOQuotationItem, IOCompany, IOProduct, QuotationPriceUnit } from '@madstoq/io-system/types'
import { DEFAULT_QUOTATION_PRICE_UNIT, formatQuotationPrice, quotationItemsTotalLabel, QUOTATION_PRICE_UNITS } from '@madstoq/io-system/quotation-price'
import ProductModal from '@/components/io/ProductModal'
import CompanyModal from '@/components/io/CompanyModal'
import CompanyComboSearch from '@/components/io/CompanyComboSearch'
import IoFormModalShell from '@/components/io/IoFormModalShell'
import OutwardRefSearchInput from '@/components/io/OutwardRefSearchInput'
import { IO_FIELD_LABEL, ioInputClass } from '@/components/io/io-form-styles'
import RichTextEditor from '@madstoq/ui/io-rich-text-editor'
import { Plus, Pencil, Trash2, X, Save, Download, Search, Upload, Printer, Eye, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw, MoreVertical } from 'lucide-react'
import { printLetterHeadQuotation } from '@madstoq/io-system/print'
import { ListPager } from '@/components/ui/ListPager'
import { LIST_PAGE_SIZE } from '@/lib/list-page'

const EMPTY_ITEM = (): IOQuotationItem => ({
  reference_no: '',
  product_id: '',
  product_name_override: '',
  price: 0,
  price_unit: DEFAULT_QUOTATION_PRICE_UNIT,
})

function QuotationPriceInput({
  price,
  priceUnit,
  invalid,
  onPriceChange,
  onUnitChange,
}: {
  price: number
  priceUnit?: QuotationPriceUnit | null
  invalid?: boolean
  onPriceChange: (value: number) => void
  onUnitChange: (value: QuotationPriceUnit) => void
}) {
  const unit = priceUnit ?? DEFAULT_QUOTATION_PRICE_UNIT
  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(5.5rem,1fr)_5.85rem]">
      <input
        type="number"
        min={0}
        step="any"
        value={price > 0 ? price : ''}
        placeholder="0"
        onChange={e => onPriceChange(parseFloat(e.target.value) || 0)}
        className={`${ioInputClass(invalid)} w-full text-right`}
      />
      <select
        value={unit}
        onChange={e => onUnitChange(e.target.value as QuotationPriceUnit)}
        className={`${ioInputClass()} w-full px-2 text-xs sm:min-w-[5.85rem]`}
        aria-label="Price unit"
      >
        {QUOTATION_PRICE_UNITS.map(u => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
    </div>
  )
}

function QuotationPriceAmountInput({
  price,
  invalid,
  onPriceChange,
}: {
  price: number
  invalid?: boolean
  onPriceChange: (value: number) => void
}) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      value={price > 0 ? price : ''}
      placeholder="0"
      onChange={e => onPriceChange(parseFloat(e.target.value) || 0)}
      className={`${ioInputClass(invalid)} w-full text-right`}
    />
  )
}

function QuotationPriceUnitSelect({
  priceUnit,
  onUnitChange,
}: {
  priceUnit?: QuotationPriceUnit | null
  onUnitChange: (value: QuotationPriceUnit) => void
}) {
  const unit = priceUnit ?? DEFAULT_QUOTATION_PRICE_UNIT
  return (
    <select
      value={unit}
      onChange={e => onUnitChange(e.target.value as QuotationPriceUnit)}
      className={`${ioInputClass()} w-full px-2 text-xs`}
      aria-label="Price unit"
    >
      {QUOTATION_PRICE_UNITS.map(u => (
        <option key={u} value={u}>{u}</option>
      ))}
    </select>
  )
}

const DEFAULT_HEADER = `Greetings of the Day !!!

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
  const [savingAction, setSavingAction] = useState<'save' | 'savePrint' | null>(null)
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
  const [expandedItemIndex, setExpandedItemIndex] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importGroups, setImportGroups] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [viewRow, setViewRow] = useState<IOQuotation | null>(null)
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
        fetchQuotations(listQuery(1)),
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
      const r = await fetchQuotations(listQuery(next))
      setRows(r.rows)
      setTotal(r.total)
      setPage(next)
    } catch (e) { console.error(e) } finally { setLoadingMore(false) }
  }

  function openNew() {
    setFormError(null)
    setShowValidation(false)
    setExpandedItemIndex(0)
    setActiveOutwardRow(null)
    setActiveOutwardQuery('')
    setOutwardMatches([])
    setEditing(null)
    setForm({ quotation_date: today(), customer_id: '', factory_id: factoryId, header_content: DEFAULT_HEADER, footer_content: DEFAULT_FOOTER })
    setItems([EMPTY_ITEM()])
    setShowForm(true)
  }
  function openEdit(row: IOQuotation) {
    setFormError(null)
    setShowValidation(false)
    setExpandedItemIndex(0)
    setActiveOutwardRow(null)
    setActiveOutwardQuery('')
    setOutwardMatches([])
    setEditing(row)
    setForm({
      quotation_date: row.quotation_date, customer_id: row.customer_id ?? '',
      factory_id: row.factory_id ?? factoryId,
      header_content: row.header_content ?? DEFAULT_HEADER,
      footer_content: row.footer_content ?? DEFAULT_FOOTER,
    })
    setItems(row.items?.length ? row.items.map(it => ({ ...it })) : [EMPTY_ITEM()])
    setShowForm(true)
  }
  async function handleSave(doPrint = false) {
    const validItems = items.filter(
      it => it.price > 0 && (it.product_id || it.product_name_override) && !!(it.reference_no ?? '').trim(),
    )
    setShowValidation(true)
    if (!form.quotation_date) { setFormError('Select a quotation date before saving.'); return }
    if (!form.customer_id) { setFormError('Select a customer before saving.'); return }
    if (!validItems.length) { setFormError('Add at least one item with outward ref, product, and price before saving.'); return }
    if (validItems.some(it => Number(it.price) < 0)) { setFormError('Price cannot be negative.'); return }
    setFormError(null)
    setSavingAction(doPrint ? 'savePrint' : 'save')
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
      const next = await fetchQuotations(listQuery(1))
      setRows(next.rows)
      setTotal(next.total)
      setPage(1)
      if (doPrint) {
        const full = next.rows.find(r => r.id === saved.id) ?? saved
        if (full) await printLetterHeadQuotation(full, products)
      }
    } catch (e: any) { alert(e.message) } finally { setSavingAction(null) }
  }

  async function handlePrint(row: IOQuotation) {
    try {
      await printLetterHeadQuotation(row, products)
    } catch (e: any) {
      alert(e.message)
    }
  }
  async function handleDelete(id: string) { if (!confirm('Delete?')) return; await deleteQuotation(id); loadData() }
  function setFormField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    if (formError) setFormError(null)
    setForm(prev => ({ ...prev, [field]: value }))
  }
  function updateItems(updater: (prev: IOQuotationItem[]) => IOQuotationItem[]) {
    if (formError) setFormError(null)
    setItems(updater)
  }
  function setItem(i: number, field: keyof IOQuotationItem, value: unknown) {
    updateItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)))
  }
  function getItemProductName(it: IOQuotationItem) {
    return products.find(p => p.id === it.product_id)?.product_name ?? it.product_name_override ?? ''
  }
  function isQuotationItemComplete(it: IOQuotationItem) {
    return !!(it.reference_no ?? '').trim() && !!(it.product_id || it.product_name_override)
  }
  function removeItemRow(index: number) {
    setExpandedItemIndex(current => {
      if (current === index) return Math.max(0, index - 1)
      if (current > index) return current - 1
      return current
    })
    updateItems(prev => prev.filter((_, j) => j !== index))
  }
  function resetFilters() {
    setSearch('')
    setCustomerFilter('all')
    setFiscalYear(getCurrentFiscalYear())
    setSelectedMonth('')
    setSelectedDate('')
    setShowMobileFilters(false)
  }
  function getProductPreview(its: IOQuotationItem[] | null | undefined) {
    return (its ?? []).map(it => it.product_name_override || products.find(p => p.id === it.product_id)?.product_name).filter(Boolean).join(', ')
  }
  function addItemRow() {
    const incompleteIndex = items.findIndex(it => !isQuotationItemComplete(it))
    if (incompleteIndex !== -1) {
      setExpandedItemIndex(incompleteIndex)
      return
    }
    setExpandedItemIndex(items.length)
    updateItems(prev => [...prev, EMPTY_ITEM()])
  }

  function downloadTemplate() {
    const csv = 'Quotation No,Date,Customer,Factory,Ref No,Product,Price,Price Unit\n,2024-01-15,Customer Name,Factory Name,Q001,Product Name,1500,INR/KG'
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
      const date = col(cols, 'date'); const customerName = col(cols, 'customer'); const factoryName = col(cols, 'factory'); const refNo = col(cols, 'ref no'); const productName = col(cols, 'product'); const priceStr = col(cols, 'price (₹)') || col(cols, 'price'); const priceUnitStr = col(cols, 'price unit') || col(cols, 'unit')
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
      map[key].items.push({ reference_no: refNo ?? '', product_id: product?.id ?? '', product_name: product?.product_name ?? productName, product_name_override: product ? '' : (productName ?? ''), price: parseFloat(priceStr) || 0, price_unit: priceUnitStr?.toUpperCase() === 'USD/KG' ? 'USD/KG' : 'INR/KG', error: (!product && !productName) ? 'Missing product' : '' })
    }
    setImportGroups(Object.values(map)); setImportOpen(true)
  }
  async function handleImportConfirm() {
    const valid = importGroups.filter(g => !g.errors.length && g.items.some((it: any) => it.price > 0))
    if (!valid.length) return
    setImporting(true)
    try {
      for (const g of valid) {
        await saveQuotation({ quotation_date: g.quotation_date, customer_id: g.customer_id || null, factory_id: g.factory_id || null, header_content: null, footer_content: null, items: g.items.filter((it: any) => it.price > 0).map((it: any) => ({ reference_no: it.reference_no, product_id: it.product_id || null, product_name_override: it.product_name_override || '', price: it.price, price_unit: it.price_unit || DEFAULT_QUOTATION_PRICE_UNIT })) })
      }
      setImportOpen(false); setImportGroups([]); loadData()
    } catch (e: any) { alert(e.message) } finally { setImporting(false) }
  }

  async function handleExport() {
    const exported = await fetchQuotations(listQuery(1, true))
    const filtered = exported.rows
    if (!filtered.length) return
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Quotations')
    const headers = ['Quotation No', 'Date', 'Customer', 'Factory', 'Ref No', 'Product', 'Price', 'Price Unit']
    const hRow = ws.addRow(headers)
    hRow.font = { bold: true, size: 11 }
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    hRow.border = { bottom: { style: 'thin', color: { argb: 'FFCCA300' } } }
    hRow.alignment = { vertical: 'middle' }
    filtered.forEach(r => {
      const base = [r.quotation_number, r.quotation_date, r.customer?.company_name ?? '', r.factory?.name ?? '']
      if (!(r.items ?? []).length) { ws.addRow([...base, '', '', '']); return }
      ;(r.items ?? []).forEach((it: IOQuotationItem) => ws.addRow([...base, it.reference_no ?? '', it.product_name_override || (products.find(p => p.id === it.product_id)?.product_name ?? ''), it.price, it.price_unit ?? DEFAULT_QUOTATION_PRICE_UNIT]))
    })
    ws.columns.forEach((col, i) => { col.width = Math.min(Math.max(headers[i].length + 4, 14), 40) })
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'quotations.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  const rowAmountLabel = (its: IOQuotationItem[]) => quotationItemsTotalLabel(its)
  const fiscalYears = getFiscalYears(5)
  const canAddItemRow = items.every(it => isQuotationItemComplete(it))
  const filtered = rows
  const visibleRows = rows
  const selectedMonthLabel = monthOptions.find(m => String(m.value) === selectedMonth)?.label
  const activeCustomerLabel = customerFilter === 'all' ? 'All Customers' : companies.find(c => c.id === customerFilter)?.company_name ?? 'Selected Customer'
  const currentFiscalYear = getCurrentFiscalYear()
  const hasAdvancedFilters = !!search.trim() || customerFilter !== 'all' || fiscalYear !== currentFiscalYear || !!selectedMonth || !!selectedDate
  const activeFilterCount = [!!search.trim(), customerFilter !== 'all', fiscalYear !== currentFiscalYear, !!selectedMonth, !!selectedDate].filter(Boolean).length


  function beginOutwardRefSearch(rowIdx: number, query: string) {
    setActiveOutwardRow(rowIdx)
    setActiveOutwardQuery(query)
    setOutwardSearching(true)
  }

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
          price_unit: DEFAULT_QUOTATION_PRICE_UNIT,
        }))
      if (mapped.length) {
        const first = mapped[0]!
        updateItems(prev => {
          const next = [...prev]
          next[rowIdx] = {
            reference_no: first.reference_no,
            product_id: first.product_id,
            product_name_override: first.product_name_override ?? '',
            price: first.price,
            price_unit: first.price_unit ?? DEFAULT_QUOTATION_PRICE_UNIT,
          }
          if (mapped.length > 1) next.splice(rowIdx + 1, 0, ...mapped.slice(1))
          return next
        })
      }
      if (!form.customer_id && out.supplier_id) setFormField('customer_id', String(out.supplier_id))

      // Close suggestions after successful selection
      setActiveOutwardRow(null)
      setActiveOutwardQuery('')
      setOutwardMatches([])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (activeOutwardRow == null) {
      setOutwardMatches([])
      setOutwardSearching(false)
      return
    }

    const q = (activeOutwardQuery ?? '').trim()
    setOutwardSearching(true)
    let cancelled = false

    const t = window.setTimeout(async () => {
      try {
        const res = await searchOutwards(q, form.factory_id || factoryId || undefined)
        if (cancelled) return
        // Hide outwards already added (except for the currently edited row value)
        const used = new Set(items.map(it => (it.reference_no ?? '').trim()).filter(Boolean))
        const current = activeOutwardRow != null ? (items[activeOutwardRow]?.reference_no ?? '').trim() : ''
        if (current) used.delete(current)
        setOutwardMatches((res ?? []).filter((o: any) => !used.has((o.outward_number ?? '').trim())))
      } catch (e) {
        console.error(e)
        if (!cancelled) setOutwardMatches([])
      } finally {
        if (!cancelled) setOutwardSearching(false)
      }
    }, q ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [activeOutwardQuery, activeOutwardRow, items, form.factory_id, factoryId])

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportFile}/>

      <div className="sm:hidden mb-3">
        <div className="card overflow-hidden">
          <div className="h-1 w-full bg-inputer/60" />
          <div className="p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div><h1 className="text-2xl font-bold text-primary">Quotations</h1><p className="mt-1 text-sm text-muted">{total} records</p></div>
              <div className="badge badge-inputer whitespace-nowrap">{fiscalYear}</div>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              <button onClick={openNew} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors" style={{ color: 'var(--color-inputer)', borderColor: 'color-mix(in srgb, var(--color-inputer) 32%, var(--color-border))', background: 'color-mix(in srgb, var(--color-inputer) 12%, var(--color-panel))' }}><Plus size={15}/> New Quotation</button>
              <div className="flex items-center gap-1.5">
                <button onClick={() => importRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel text-primary transition-colors hover:bg-layer" aria-label="Import quotations" title="Import"><Download size={16}/></button>
                <button onClick={handleExport} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel text-primary transition-colors hover:bg-layer" aria-label="Export quotations" title="Export"><Upload size={16}/></button>
              </div>
            </div>
            <div className="border-t border-border pt-2.5">
              <div className="input flex items-center gap-2"><Search size={14} className="text-muted flex-shrink-0"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotation or customer..." className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"/></div>
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
        <div><h1 className="text-xl font-bold text-primary">Quotations</h1><p className="text-sm text-muted mt-0.5">{total} records</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => importRef.current?.click()} className="btn btn-ghost"><Download size={14}/> Import</button>
          <button onClick={handleExport} className="btn btn-ghost"><Upload size={14}/> Export</button>
          <button onClick={openNew} className="btn btn-inputer"><Plus size={15}/> New Quotation</button>
        </div>
      </div>

      <div className="hidden sm:flex flex-wrap lg:flex-nowrap items-center gap-2 mb-4">
        <div className="input flex items-center gap-2 w-full md:w-[320px]">
          <Search size={14} className="text-muted flex-shrink-0"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotation or customer..." className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"/>
        </div>
        <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="input w-full md:w-[220px] text-sm">
          <option value="all">All Customers</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <select value={fiscalYear} onChange={e => setFiscalYear(e.target.value)} className="input w-full md:w-[170px] text-sm">
          {fiscalYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
        </select>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="input w-full md:w-[150px] text-sm">
          <option value="">All Months</option>
          {monthOptions.map(m => <option key={m.value} value={String(m.value)}>{m.label}</option>)}
        </select>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input w-full md:w-[170px] text-sm" aria-label="Filter by date"/>
      </div>

      <div className="card overflow-visible border-transparent bg-transparent shadow-none sm:border-border sm:bg-panel sm:shadow-sm">
        <div className="sm:hidden p-3 space-y-3" style={{ background: 'color-mix(in srgb, var(--color-text) 2%, transparent)' }}>
          <div className="flex items-center justify-between gap-3 px-1">
            <div><div className="text-sm font-semibold text-primary">Records</div><div className="text-xs text-muted">Showing {visibleRows.length} of {total} results · Tap a card to view</div></div>
            {activeFilterCount > 0 && <div className="text-xs text-muted whitespace-nowrap">{activeFilterCount} filters active</div>}
          </div>
          {loading ? <div className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin"/></div>
          : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-panel p-8 text-center text-muted text-sm">No quotations found for the current search and filters.</div>
          : visibleRows.map(row => (
            <div key={row.id} className="rounded-2xl border border-border bg-panel p-4 shadow-sm transition-colors hover:bg-layer-sm" onClick={() => { setOpenMobileRowMenuId(null); setViewRow(row) }} role="button" tabIndex={0}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold text-xs text-inputer">{row.quotation_number}</span><span className="text-xs text-muted">{fmtDate(row.quotation_date)}</span></div>
                  <div className="mt-2 text-lg font-semibold text-primary">{row.customer?.company_name ?? '—'}</div>
                </div>
                <div className="relative flex shrink-0 items-start">
                  <button onClick={(e) => { e.stopPropagation(); setOpenMobileRowMenuId(current => current === row.id ? null : row.id) }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-layer hover:text-primary"><MoreVertical size={15}/></button>
                  {openMobileRowMenuId === row.id && <div className="absolute right-0 top-10 z-10 min-w-[140px] rounded-xl border border-border bg-panel p-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setOpenMobileRowMenuId(null); openEdit(row) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-layer hover:text-primary"><Pencil size={14}/> Edit</button>
                    <button onClick={() => { setOpenMobileRowMenuId(null); handlePrint(row) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-layer hover:text-primary"><Printer size={14}/> Print</button>
                    <button onClick={() => { setOpenMobileRowMenuId(null); handleDelete(row.id) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"><Trash2 size={14}/> Delete</button>
                  </div>}
                </div>
              </div>
              {getProductPreview(row.items) && <div className="mt-3 min-w-0 text-sm font-medium text-primary">{getProductPreview(row.items)}</div>}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                <span className="text-xs text-muted">{row.items?.length ?? 0} items</span>
                <span className="font-bold text-sm text-primary">{rowAmountLabel(row.items ?? [])}</span>
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
                  <td className="text-right font-semibold text-xs">{rowAmountLabel(row.items ?? [])}</td>
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
      {!loading && (
        <div className="mt-4 flex justify-center">
          <ListPager page={page} total={total} disabled={loadingMore} onPage={(next) => void goToPage(next)} />
        </div>
      )}

      <IoFormModalShell
        show={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Quotation' : 'New Quotation'}
        closeAriaLabel="Close quotation form"
        formError={formError}
        savingAction={savingAction}
        editing={!!editing}
        onSave={() => handleSave(false)}
        onSavePrint={() => handleSave(true)}
        savePrintLabel={editing ? 'Update & Print' : 'Save & Print'}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Order Details</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="order-2 md:order-1">
                <div className="mb-1 flex h-7 items-center">
                  <label className={IO_FIELD_LABEL}>
                    Date <span className="text-red-400">*</span>
                  </label>
                </div>
                <input
                  type="date"
                  value={form.quotation_date}
                  onChange={e => setFormField('quotation_date', e.target.value)}
                  className={ioInputClass(showValidation && !form.quotation_date)}
                />
              </div>
              <div className="order-1 md:order-2">
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
              {factories.length > 1 && (
                <div className="order-3 md:col-span-2">
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
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className={IO_FIELD_LABEL}>Header Content</label>
              <button
                type="button"
                onClick={() => setFormField('header_content', DEFAULT_HEADER)}
                className="text-xs font-medium text-inputer hover:underline"
              >
                Reset to default
              </button>
            </div>
            <RichTextEditor
              value={form.header_content}
              onChange={val => setFormField('header_content', val)}
              placeholder="Header shown at top of quotation…"
              minHeight={110}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-primary">Line Items</h3>
              <button
                type="button"
                onClick={addItemRow}
                disabled={!canAddItemRow}
                className="inline-flex items-center gap-1 px-1 py-1 text-xs font-medium text-inputer transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-inputer"
                title={canAddItemRow ? 'Add row' : 'Complete the current outward reference before adding another row'}
              >
                <Plus size={12} /> Add Row
              </button>
            </div>

            <div className="mt-3 space-y-3 md:hidden">
              {items.map((it, i) => {
                const productName = getItemProductName(it)
                const itemIsComplete = isQuotationItemComplete(it)
                const isExpanded = expandedItemIndex === i
                return (
                  <div
                    key={i}
                    className={`rounded-xl border bg-panel transition-colors ${isExpanded ? 'border-inputer/40' : 'border-border/60'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedItemIndex(i)}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Item {i + 1}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${itemIsComplete ? 'bg-layer text-muted' : 'bg-inputer/10 text-inputer'}`}
                          >
                            {itemIsComplete ? 'Ready' : 'Incomplete'}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-primary">
                          {it.reference_no || 'Choose outward ref'}
                        </div>
                        {productName && <div className="mt-1 truncate text-xs text-muted">{productName}</div>}
                      </div>
                      <div className="rounded-md p-1 text-muted">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/50 px-3 pb-3 pt-2.5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="text-xs font-medium text-muted">Item details</div>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(i)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-red-500/20 px-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Outward Ref No</label>
                            <OutwardRefSearchInput
                              value={it.reference_no ?? ''}
                              placeholder="Type and select outward reference"
                              invalid={showValidation && !(it.reference_no ?? '').trim()}
                              searching={outwardSearching}
                              matches={outwardMatches}
                              onFocus={() => beginOutwardRefSearch(i, it.reference_no ?? '')}
                              onChange={v => {
                                setItem(i, 'reference_no', v)
                                beginOutwardRefSearch(i, v)
                              }}
                              onBlur={v => {
                                applyOutwardRefForRow(i, v)
                                setActiveOutwardRow(null)
                              }}
                              onSelect={outwardNumber => {
                                setItem(i, 'reference_no', outwardNumber)
                                setActiveOutwardQuery(outwardNumber)
                                applyOutwardRefForRow(i, outwardNumber)
                              }}
                            />
                          </div>
                          <div>
                            <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Product</label>
                            <input
                              value={productName}
                              readOnly
                              placeholder={it.reference_no ? 'Product from outward' : 'Select outward first'}
                              className={`${ioInputClass()} opacity-80`}
                            />
                          </div>
                          <div>
                            <label className={`mb-1 block ${IO_FIELD_LABEL}`}>Price</label>
                            <QuotationPriceInput
                              price={it.price}
                              priceUnit={it.price_unit}
                              invalid={showValidation && !(it.price > 0)}
                              onPriceChange={value => setItem(i, 'price', value)}
                              onUnitChange={value => setItem(i, 'price_unit', value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-visible rounded-2xl border border-border/60 bg-panel md:block">
              <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.8fr)_minmax(6.5rem,0.9fr)_6.5rem_44px] gap-3 border-b border-border/60 px-4 py-3 text-xs font-semibold text-muted">
                <div>Outward Ref</div>
                <div>Product</div>
                <div className="text-right">Price</div>
                <div>Unit</div>
                <div />
              </div>
              <div className="divide-y divide-border/60">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.8fr)_minmax(6.5rem,0.9fr)_6.5rem_44px] gap-3 px-4 py-3 items-center">
                    <OutwardRefSearchInput
                      value={it.reference_no ?? ''}
                      placeholder="Outward ref"
                      invalid={showValidation && !(it.reference_no ?? '').trim()}
                      searching={outwardSearching}
                      matches={outwardMatches}
                      onFocus={() => beginOutwardRefSearch(i, it.reference_no ?? '')}
                      onChange={v => {
                        setItem(i, 'reference_no', v)
                        beginOutwardRefSearch(i, v)
                      }}
                      onBlur={v => {
                        applyOutwardRefForRow(i, v)
                        setActiveOutwardRow(null)
                      }}
                      onSelect={outwardNumber => {
                        setItem(i, 'reference_no', outwardNumber)
                        setActiveOutwardQuery(outwardNumber)
                        applyOutwardRefForRow(i, outwardNumber)
                      }}
                    />
                    <div>
                      <input
                        value={getItemProductName(it)}
                        readOnly
                        placeholder={it.reference_no ? 'Product from outward' : 'Select outward first'}
                        className={`${ioInputClass()} opacity-80`}
                      />
                    </div>
                    <QuotationPriceAmountInput
                      price={it.price}
                      invalid={showValidation && !(it.price > 0)}
                      onPriceChange={value => setItem(i, 'price', value)}
                    />
                    <QuotationPriceUnitSelect
                      priceUnit={it.price_unit}
                      onUnitChange={value => setItem(i, 'price_unit', value)}
                    />
                    <div className="flex items-center justify-end">
                      {items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeItemRow(i)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-layer hover:text-red-400"
                          aria-label={`Remove item ${i + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <div className="h-9 w-9" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className={IO_FIELD_LABEL}>Footer Content</label>
              <button
                type="button"
                onClick={() => setFormField('footer_content', DEFAULT_FOOTER)}
                className="text-xs font-medium text-inputer hover:underline"
              >
                Reset to default
              </button>
            </div>
            <RichTextEditor
              value={form.footer_content}
              onChange={val => setFormField('footer_content', val)}
              placeholder="Footer text, terms and conditions…"
              minHeight={90}
            />
          </div>
        </div>
      </IoFormModalShell>

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
                          <td className="px-3 py-2 text-right font-semibold">{formatQuotationPrice(it.price, it.price_unit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ background: 'var(--color-surface)' }}><tr className="border-t border-border"><td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-muted">Total</td><td className="px-3 py-2 text-right font-bold text-sm text-primary">{quotationItemsTotalLabel(viewRow.items ?? [])}</td></tr></tfoot>
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
