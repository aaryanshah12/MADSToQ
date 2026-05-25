'use client'
import { useState, useEffect, useRef } from 'react'
import { useIOFactory } from '@/contexts/IOFactoryContext'
import { getAuthHeaders } from '@madstoq/core'
import { invalidatePdfTemplateCache } from '@madstoq/io-system/print'
import {
  fetchProducts, saveProduct, deleteProduct,
  fetchCompanies, saveCompany, deleteCompany,
  fetchNumberingConfig, saveNumberingConfig,
  fetchUnits, saveUnit, deleteUnit,
  fetchCountries, saveCountry, deleteCountry,
  fetchStates, saveState, deleteState,
  fetchCities, saveCity, deleteCity,
} from '@madstoq/io-system/api'
import type {
  IOProduct, IOUnit, IOCompany, IOCountry, IOState, IOCity, CompanyType,
} from '@madstoq/io-system/types'
import ProductModal from '@/components/io/ProductModal'
import CompanyModal from '@/components/io/CompanyModal'
import clsx from 'clsx'
import {
  Package, Building2, Ruler, MapPin, FileText, Hash,
  Plus, Pencil, Trash2, Search, Upload, X, Save, CheckCircle, AlertCircle, Printer,
} from 'lucide-react'

type Tab = 'products' | 'companies' | 'units' | 'locations' | 'pdfs' | 'numbering'
type LocTab = 'countries' | 'states' | 'cities'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'products',   label: 'Products',   icon: Package   },
  { key: 'companies',  label: 'Companies',  icon: Building2 },
  { key: 'units',      label: 'Units',      icon: Ruler     },
  { key: 'locations',  label: 'Locations',  icon: MapPin    },
  { key: 'pdfs',       label: 'PDFs',       icon: FileText  },
  { key: 'numbering',  label: 'Numbering',  icon: Hash      },
]

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'both',     label: 'Both'     },
]

// ── CSV parser (no deps) ────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''))
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? []
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').replace(/^"|"$/g, '').trim() })
    return obj
  }).filter(r => Object.values(r).some(v => v))
}

export default function MasterPage() {
  const { factoryId, factories } = useIOFactory()
  const factoryName = factories.find(f => f.id === factoryId)?.name
  const [tab, setTab] = useState<Tab>('products')

  // ── Products ──────────────────────────────────────────────────────────────
  const [products, setProducts]       = useState<IOProduct[]>([])
  const [units, setUnits]             = useState<IOUnit[]>([])
  const [prodSearch, setProdSearch]   = useState('')
  const [prodLoading, setProdLoading] = useState(true)
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct]     = useState<IOProduct | null>(null)

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null)
  const [showImport, setShowImport]   = useState(false)
  const [csvRows, setCsvRows]         = useState<Record<string, string>[]>([])
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; fail: number } | null>(null)

  // ── Companies ─────────────────────────────────────────────────────────────
  const [companies, setCompanies]       = useState<IOCompany[]>([])
  const [compSearch, setCompSearch]     = useState('')
  const [compType, setCompType]         = useState<CompanyType | 'all'>('all')
  const [compLoading, setCompLoading]   = useState(true)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [editingCompany, setEditingCompany]     = useState<IOCompany | null>(null)

  // Company CSV import
  const compFileRef = useRef<HTMLInputElement>(null)
  const [showCompImport, setShowCompImport]     = useState(false)
  const [compCsvRows, setCompCsvRows]           = useState<Record<string, string>[]>([])
  const [compImporting, setCompImporting]       = useState(false)
  const [compImportResult, setCompImportResult] = useState<{ ok: number; fail: number } | null>(null)

  // ── Units ─────────────────────────────────────────────────────────────────
  const [unitLoading, setUnitLoading] = useState(true)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [editingUnit, setEditingUnit]   = useState<IOUnit | null>(null)
  const [unitForm, setUnitForm]         = useState({ name: '', abbreviation: '' })
  const [unitSaving, setUnitSaving]     = useState(false)

  // ── PDFs ──────────────────────────────────────────────────────────────────
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfStatus, setPdfStatus] = useState('')
  const [pdfFiles, setPdfFiles] = useState<string[]>([])
  const [pdfSelected, setPdfSelected] = useState<Record<'label' | 'letter-head' | 'customer-print', string>>({
    label: '/Label.pdf',
    'letter-head': '/letter-head.pdf',
    'customer-print': '',
  })
  const [pdfUseFor, setPdfUseFor] = useState<'label' | 'letter-head' | 'customer-print'>('label')
  const pdfUploadRef = useRef<HTMLInputElement>(null)

  async function parsePdfApiError(res: Response): Promise<string> {
    try {
      const data = await res.json()
      return data?.error || res.statusText || 'Request failed'
    } catch {
      return (await res.text()) || res.statusText || 'Request failed'
    }
  }

  async function loadPdfConfig() {
    if (!factoryId) {
      setPdfStatus('Select a factory in the header to load PDF settings for that factory.')
      return
    }
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/io/upload-pdf?factoryId=${encodeURIComponent(factoryId)}`, { cache: 'no-store', headers })
      if (!res.ok) throw new Error(await parsePdfApiError(res))
      const data = await res.json()
      setPdfFiles(data.files ?? [])
      setPdfSelected(prev => ({ ...prev, ...(data.selected ?? {}) }))
      setPdfStatus('')
    } catch (e: any) {
      setPdfStatus(`Error: ${e.message}`)
    }
  }

  async function handlePdfUpload(file: File) {
    if (!factoryId) { alert('Select a factory first'); return }
    setPdfUploading(true)
    setPdfStatus('')
    try {
      const fd = new FormData()
      fd.append('action', 'upload')
      fd.append('factoryId', factoryId)
      fd.append('file', file)
      const headers = await getAuthHeaders()
      const res = await fetch('/api/io/upload-pdf', { method: 'POST', headers, body: fd })
      if (!res.ok) throw new Error(await parsePdfApiError(res))
      const data = await res.json()
      setPdfFiles(data.files ?? [])
      invalidatePdfTemplateCache(factoryId)
      setPdfStatus('Uploaded successfully')
    } catch (e: any) {
      setPdfStatus(`Error: ${e.message}`)
    } finally {
      setPdfUploading(false)
    }
  }

  async function assignPdf(slot: 'label' | 'letter-head' | 'customer-print', filePath: string) {
    if (!factoryId) { alert('Select a factory first'); return }
    setPdfStatus('')
    try {
      const fd = new FormData()
      fd.append('action', 'assign')
      fd.append('factoryId', factoryId)
      fd.append('slot', slot)
      fd.append('filePath', filePath)
      const headers = await getAuthHeaders()
      const res = await fetch('/api/io/upload-pdf', { method: 'POST', headers, body: fd })
      if (!res.ok) throw new Error(await parsePdfApiError(res))
      const data = await res.json()
      setPdfSelected(prev => ({ ...prev, ...(data.selected ?? {}) }))
      invalidatePdfTemplateCache(factoryId)
      setPdfStatus('Template mapping saved for this factory')
    } catch (e: any) {
      setPdfStatus(`Error: ${e.message}`)
    }
  }

  // ── Numbering ─────────────────────────────────────────────────────────────
  const [numbering, setNumbering] = useState<Record<string, { prefix: string; suffix: string }>>({
    inward: { prefix: '', suffix: '' },
    outward: { prefix: '', suffix: '' },
    domestic: { prefix: '', suffix: '' },
    international: { prefix: '', suffix: '' },
    quotation: { prefix: '', suffix: '' },
  })
  const [numberingLoading, setNumberingLoading] = useState(false)
  const [numberingSaved, setNumberingSaved] = useState(false)
  const [numberingError, setNumberingError] = useState('')

  function getNum(key: string) { return numbering[key] ?? { prefix: '', suffix: '' } }
  function setNum(key: string, field: 'prefix' | 'suffix', val: string) {
    setNumbering(n => ({ ...n, [key]: { ...getNum(key), [field]: val } }))
    setNumberingSaved(false)
    setNumberingError('')
  }
  async function loadNumbering() {
    if (!factoryId) return
    setNumberingLoading(true)
    setNumberingError('')
    try {
      const cfg = await fetchNumberingConfig(factoryId)
      setNumbering(cfg)
    } catch (e: any) {
      console.error(e)
      setNumberingError(e.message || 'Failed to load numbering settings')
    } finally {
      setNumberingLoading(false)
    }
  }
  async function saveNumbering() {
    if (!factoryId) { alert('Select a factory to save numbering settings'); return }
    setNumberingError('')
    try {
      await saveNumberingConfig(factoryId, numbering as any)
      setNumberingSaved(true)
      setTimeout(() => setNumberingSaved(false), 2000)
    } catch (e: any) {
      console.error(e)
      setNumberingError(e.message || 'Failed to save numbering settings')
      alert(e.message || 'Failed to save numbering settings')
    }
  }

  // ── Locations ─────────────────────────────────────────────────────────────
  const [locTab, setLocTab]         = useState<LocTab>('countries')
  const [countries, setCountries]   = useState<IOCountry[]>([])
  const [states, setStates]         = useState<IOState[]>([])
  const [cities, setCities]         = useState<IOCity[]>([])
  const [locLoading, setLocLoading] = useState(true)
  const [locSaving, setLocSaving]   = useState(false)
  const [countryFilter, setCountryFilter] = useState('')
  const [stateFilter, setStateFilter]     = useState('')
  const [showLocForm, setShowLocForm] = useState(false)
  const [editingLocId, setEditingLocId] = useState<number | null>(null)
  const [locForm, setLocForm]         = useState<Record<string, string>>({})

  // ── Load on tab or factory change ────────────────────────────────────────
  useEffect(() => {
    if (tab === 'products')  loadProducts()
    if (tab === 'companies') loadCompanies()
    if (tab === 'units')     loadUnits()
    if (tab === 'locations') loadLocations()
    if (tab === 'pdfs')      loadPdfConfig()
    if (tab === 'numbering') loadNumbering()
  }, [tab, factoryId])

  async function loadProducts() {
    setProdLoading(true)
    try { const [p, u] = await Promise.all([fetchProducts(factoryId || undefined), fetchUnits()]); setProducts(p); setUnits(u) }
    catch (e) { console.error(e) } finally { setProdLoading(false) }
  }
  async function loadCompanies() {
    setCompLoading(true)
    try { setCompanies(await fetchCompanies('all', factoryId || undefined)) }
    catch (e) { console.error(e) } finally { setCompLoading(false) }
  }
  async function loadUnits() {
    setUnitLoading(true)
    try { setUnits(await fetchUnits()) }
    catch (e) { console.error(e) } finally { setUnitLoading(false) }
  }
  async function loadLocations() {
    setLocLoading(true)
    try { const [c, s, ci] = await Promise.all([fetchCountries(), fetchStates(), fetchCities()]); setCountries(c); setStates(s); setCities(ci) }
    catch (e) { console.error(e) } finally { setLocLoading(false) }
  }

  // ── Units CRUD ────────────────────────────────────────────────────────────
  function openNewUnit() { setEditingUnit(null); setUnitForm({ name: '', abbreviation: '' }); setShowUnitForm(true) }
  function openEditUnit(u: IOUnit) { setEditingUnit(u); setUnitForm({ name: u.name, abbreviation: u.abbreviation ?? '' }); setShowUnitForm(true) }
  async function handleSaveUnit() {
    if (!unitForm.name.trim()) { alert('Name required'); return }
    setUnitSaving(true)
    try { await saveUnit({ id: editingUnit?.id, name: unitForm.name.trim(), abbreviation: unitForm.abbreviation || null }); setShowUnitForm(false); loadUnits() }
    catch (e: any) { alert(e.message) } finally { setUnitSaving(false) }
  }
  async function handleDeleteUnit(id: number) { if (!confirm('Delete unit?')) return; await deleteUnit(id); loadUnits() }

  // ── Locations CRUD ────────────────────────────────────────────────────────
  function openNewLoc() {
    setEditingLocId(null)
    setLocForm(locTab === 'countries' ? { name: '', code: '' } : locTab === 'states' ? { name: '', code: '', country_id: '' } : { name: '', state_id: '' })
    setShowLocForm(true)
  }
  function openEditLoc(row: IOCountry | IOState | IOCity) {
    setEditingLocId(row.id)
    if (locTab === 'countries') { const c = row as IOCountry; setLocForm({ name: c.name, code: c.code ?? '' }) }
    else if (locTab === 'states') { const s = row as IOState; setLocForm({ name: s.name, code: s.code ?? '', country_id: s.country_id.toString() }) }
    else { const ci = row as IOCity; setLocForm({ name: ci.name, state_id: ci.state_id.toString() }) }
    setShowLocForm(true)
  }
  async function handleSaveLoc() {
    if (!locForm.name?.trim()) { alert('Name required'); return }
    setLocSaving(true)
    try {
      if (locTab === 'countries') await saveCountry({ id: editingLocId ?? undefined, name: locForm.name.trim(), code: locForm.code || null })
      else if (locTab === 'states') { if (!locForm.country_id) { alert('Select country'); setLocSaving(false); return }; await saveState({ id: editingLocId ?? undefined, name: locForm.name.trim(), code: locForm.code || null, country_id: parseInt(locForm.country_id) }) }
      else { if (!locForm.state_id) { alert('Select state'); setLocSaving(false); return }; await saveCity({ id: editingLocId ?? undefined, name: locForm.name.trim(), state_id: parseInt(locForm.state_id) }) }
      setShowLocForm(false); loadLocations()
    } catch (e: any) { alert(e.message) } finally { setLocSaving(false) }
  }
  async function handleDeleteLoc(id: number) {
    if (!confirm('Delete?')) return
    if (locTab === 'countries') await deleteCountry(id)
    else if (locTab === 'states') await deleteState(id)
    else await deleteCity(id)
    loadLocations()
  }

  // ── CSV Import ────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { const rows = parseCSV(ev.target?.result as string); setCsvRows(rows); setImportResult(null) }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvRows.length) return
    setImporting(true); let ok = 0; let fail = 0
    for (const row of csvRows) {
      const name = row['product_name'] || row['name'] || row['product name']
      if (!name) { fail++; continue }
      try {
        await saveProduct({
          factory_id: factoryId || null,
          product_name: name,
          hsn_code: row['hsn_code'] || row['hsn'] || null,
          rate: row['rate'] ? parseFloat(row['rate']) : null,
          description: row['description'] || null,
          is_active: true,
        })
        ok++
      } catch { fail++ }
    }
    setImportResult({ ok, fail }); setImporting(false)
    if (ok > 0) loadProducts()
  }

  // ── Company CSV Import ────────────────────────────────────────────────────
  function handleCompFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { const rows = parseCSV(ev.target?.result as string); setCompCsvRows(rows); setCompImportResult(null) }
    reader.readAsText(file)
  }

  async function handleCompImport() {
    if (!compCsvRows.length) return
    setCompImporting(true); let ok = 0; let fail = 0
    for (const row of compCsvRows) {
      const name = row['company_name'] || row['name'] || row['company name']
      if (!name) { fail++; continue }
      const rawType = (row['company_type'] || row['type'] || 'supplier').toLowerCase().trim()
      const type: CompanyType = rawType === 'customer' ? 'customer' : rawType === 'both' ? 'both' : 'supplier'
      try {
        await saveCompany({
          factory_id: factoryId || null,
          company_name: name,
          company_type: type,
          person_name: row['person_name'] || row['contact'] || null,
          mobile: row['mobile'] || row['phone'] || null,
          email: row['email'] || null,
          address: row['address'] || null,
          pincode: row['pincode'] || row['zip'] || null,
          is_active: true,
        })
        ok++
      } catch { fail++ }
    }
    setCompImportResult({ ok, fail }); setCompImporting(false)
    if (ok > 0) loadCompanies()
  }

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p => p.product_name.toLowerCase().includes(prodSearch.toLowerCase()) || (p.hsn_code ?? '').toLowerCase().includes(prodSearch.toLowerCase()))
  const filteredCompanies = companies.filter(c => {
    const matchType = compType === 'all' || c.company_type === compType || c.company_type === 'both'
    const matchSearch = c.company_name.toLowerCase().includes(compSearch.toLowerCase()) || (c.person_name ?? '').toLowerCase().includes(compSearch.toLowerCase())
    return matchType && matchSearch
  })
  const filteredStates = states.filter(s => !countryFilter || s.country_id.toString() === countryFilter)
  const filteredCities  = cities.filter(c => !stateFilter || c.state_id.toString() === stateFilter)

  const typeBadge = (t: CompanyType) => ({ supplier: 'badge badge-inputer', customer: 'badge badge-chemist', both: 'badge badge-owner' }[t])

  const Spinner = () => <div className="py-12 text-center"><div className="inline-block w-6 h-6 border-2 border-inputer border-t-transparent rounded-full animate-spin"/></div>

  function printCompanyDetails(company: IOCompany) {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    const location = [company.city?.name, company.state?.name, company.country?.name, company.pincode].filter(Boolean).join(', ')
    const fullAddress = [company.address, location].filter(Boolean).join(', ')
    const contactBits = [company.person_name, company.mobile].filter(Boolean) as string[]
    const contactLine = contactBits.join('. ')

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(company.company_name)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            .to { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
            .contact { font-size: 14px; margin: 0 0 6px; }
            .address {
              font-size: 14px;
              line-height: 1.4;
              margin: 0;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              text-overflow: ellipsis;
              max-height: calc(1.4em * 2);
            }
            @media print { @page { margin: 12mm; } }
          </style>
        </head>
        <body>
          <p class="to">To ${escapeHtml(company.company_name)}</p>
          ${contactLine ? `<p class="contact">${escapeHtml(contactLine)}</p>` : ''}
          ${fullAddress ? `<p class="address">${escapeHtml(fullAddress)}</p>` : '<p class="address">No address available</p>'}
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary">Master</h1>
        <p className="text-sm text-muted mt-0.5">Manage products, companies, units and locations</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 mb-6" style={{ background: 'var(--color-surface)', borderRadius: '0.75rem', padding: '4px' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all',
              tab === key
                ? 'bg-inputer/15 text-inputer border border-inputer/30'
                : 'text-muted hover:text-primary hover:bg-layer-sm'
            )}>
            <Icon size={14}/> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── PRODUCTS TAB ─────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-muted">{filteredProducts.length} products</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShowImport(true)} className="btn btn-ghost"><Upload size={14}/> Import CSV</button>
              <button onClick={() => { setEditingProduct(null); setShowProductModal(true) }} className="btn btn-inputer"><Plus size={14}/> New Product</button>
            </div>
          </div>
          <div className="input flex items-center gap-2 w-full">
            <Search size={14} className="text-muted flex-shrink-0"/>
            <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Search products, HSN code…" className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"/>
          </div>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Product Name</th><th>HSN Code</th><th>Unit</th><th className="text-right">Rate</th><th/></tr></thead>
              <tbody>
                {prodLoading ? <tr><td colSpan={5}><Spinner/></td></tr>
                : filteredProducts.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-muted text-sm">No products found</td></tr>
                : filteredProducts.map(row => (
                  <tr key={row.id}>
                    <td className="font-medium text-primary">{row.product_name}</td>
                    <td className="font-mono text-xs text-muted">{row.hsn_code ?? '—'}</td>
                    <td className="text-xs text-muted">{row.unit ? `${row.unit.name}${row.unit.abbreviation ? ` (${row.unit.abbreviation})` : ''}` : '—'}</td>
                    <td className="text-right text-xs">{row.rate != null ? `₹${row.rate}` : '—'}</td>
                    <td className="text-right"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditingProduct(row); setShowProductModal(true) }} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={13}/></button>
                      <button onClick={async () => { if (!confirm('Delete product?')) return; await deleteProduct(row.id); loadProducts() }} className="p-1.5 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COMPANIES TAB ─────────────────────────────────────────────────── */}
      {tab === 'companies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-muted">{filteredCompanies.length} companies</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShowCompImport(true)} className="btn btn-ghost"><Upload size={14}/> Import CSV</button>
              <button onClick={() => { setEditingCompany(null); setShowCompanyModal(true) }} className="btn btn-inputer"><Plus size={14}/> New Company</button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="input flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={14} className="text-muted flex-shrink-0"/>
              <input value={compSearch} onChange={e => setCompSearch(e.target.value)} placeholder="Search companies…" className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"/>
            </div>
            <select value={compType} onChange={e => setCompType(e.target.value as any)} className="input">
              <option value="all">All Types</option>
              {COMPANY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Company</th><th>Contact</th><th>Type</th><th>Location</th><th/></tr></thead>
              <tbody>
                {compLoading ? <tr><td colSpan={5}><Spinner/></td></tr>
                : filteredCompanies.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-muted text-sm">No companies found</td></tr>
                : filteredCompanies.map(row => (
                  <tr key={row.id}>
                    <td>
                      <div className="font-medium text-primary">{row.company_name}</div>
                      {row.email && <div className="text-[11px] text-muted">{row.email}</div>}
                    </td>
                    <td className="text-xs text-muted">
                      <div>{row.person_name ?? '—'}</div>
                      {row.mobile && <div>{row.mobile}</div>}
                    </td>
                    <td><span className={typeBadge(row.company_type)}>{row.company_type}</span></td>
                    <td className="text-xs text-muted">{[row.city?.name, row.state?.name, row.country?.name].filter(Boolean).join(', ') || '—'}</td>
                    <td className="text-right"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => printCompanyDetails(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors" title="Print company"><Printer size={13}/></button>
                      <button onClick={() => { setEditingCompany(row); setShowCompanyModal(true) }} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={13}/></button>
                      <button onClick={async () => { if (!confirm('Deactivate company?')) return; await deleteCompany(row.id); loadCompanies() }} className="p-1.5 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── UNITS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'units' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{units.length} units</p>
            <button onClick={openNewUnit} className="btn btn-inputer"><Plus size={14}/> New Unit</button>
          </div>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Abbreviation</th><th/></tr></thead>
              <tbody>
                {unitLoading ? <tr><td colSpan={3}><Spinner/></td></tr>
                : units.length === 0 ? <tr><td colSpan={3} className="py-12 text-center text-muted text-sm">No units</td></tr>
                : units.map(row => (
                  <tr key={row.id}>
                    <td className="font-medium text-primary">{row.name}</td>
                    <td className="font-mono text-xs text-muted">{row.abbreviation ?? '—'}</td>
                    <td className="text-right"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditUnit(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={13}/></button>
                      <button onClick={() => handleDeleteUnit(row.id)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LOCATIONS TAB ─────────────────────────────────────────────────── */}
      {tab === 'locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1" style={{ background: 'var(--color-surface)', borderRadius: '0.5rem', padding: '3px' }}>
              {(['countries', 'states', 'cities'] as LocTab[]).map(lt => (
                <button key={lt} onClick={() => setLocTab(lt)}
                  className={clsx('px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-all', locTab === lt ? 'bg-inputer/15 text-inputer' : 'text-muted hover:text-primary')}>
                  {lt}
                </button>
              ))}
            </div>
            <button onClick={openNewLoc} className="btn btn-inputer"><Plus size={14}/> Add</button>
          </div>
          {locTab === 'states' && (
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="input w-full">
              <option value="">All Countries</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {locTab === 'cities' && (
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="input w-full">
              <option value="">All States</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Code / Parent</th><th/></tr></thead>
              <tbody>
                {locLoading ? <tr><td colSpan={3}><Spinner/></td></tr> : <>
                  {locTab === 'countries' && (countries.length === 0
                    ? <tr><td colSpan={3} className="py-12 text-center text-muted text-sm">No countries</td></tr>
                    : countries.map(row => (
                      <tr key={row.id}>
                        <td className="font-medium text-primary">{row.name}</td>
                        <td className="font-mono text-xs text-muted">{row.code ?? '—'}</td>
                        <td className="text-right"><div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditLoc(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={13}/></button>
                          <button onClick={() => handleDeleteLoc(row.id)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                        </div></td>
                      </tr>
                    ))
                  )}
                  {locTab === 'states' && (filteredStates.length === 0
                    ? <tr><td colSpan={3} className="py-12 text-center text-muted text-sm">No states</td></tr>
                    : filteredStates.map(row => (
                      <tr key={row.id}>
                        <td className="font-medium text-primary">{row.name}</td>
                        <td className="text-xs text-muted"><span className="font-mono">{row.code ?? '—'}</span>{row.country && <span className="ml-2">· {row.country.name}</span>}</td>
                        <td className="text-right"><div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditLoc(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={13}/></button>
                          <button onClick={() => handleDeleteLoc(row.id)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                        </div></td>
                      </tr>
                    ))
                  )}
                  {locTab === 'cities' && (filteredCities.length === 0
                    ? <tr><td colSpan={3} className="py-12 text-center text-muted text-sm">No cities</td></tr>
                    : filteredCities.map(row => (
                      <tr key={row.id}>
                        <td className="font-medium text-primary">{row.name}</td>
                        <td className="text-xs text-muted">{row.state?.name ?? '—'}</td>
                        <td className="text-right"><div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditLoc(row)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-inputer transition-colors"><Pencil size={13}/></button>
                          <button onClick={() => handleDeleteLoc(row.id)} className="p-1.5 rounded hover:bg-layer text-muted hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                        </div></td>
                      </tr>
                    ))
                  )}
                </>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PDFs TAB ──────────────────────────────────────────────────────── */}
      {tab === 'pdfs' && (
        <div className="space-y-4">
          {!factoryId && (
            <p className="text-sm text-amber-500 flex items-center gap-2"><AlertCircle size={14}/> Select a factory in the header — PDF templates are saved per factory for your account.</p>
          )}
          {factoryId && (
            <p className="text-sm text-muted">
              Settings for <span className="font-medium text-primary">{factoryName ?? 'selected factory'}</span>.
              Upload PDFs and map slots; printing uses this factory&apos;s templates only.
            </p>
          )}
          <p className="text-sm text-muted">
            Built-in templates: <span className="font-mono">Label.pdf</span>, <span className="font-mono">letter-head.pdf</span>, and <span className="font-mono">address print.pdf</span> in public. Upload here only if this factory needs different layouts.
          </p>

          <div className="card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <select value={pdfUseFor} onChange={e => setPdfUseFor(e.target.value as any)} className="input sm:w-56">
                <option value="label">Use for: Label</option>
                <option value="letter-head">Use for: Letter Head</option>
                <option value="customer-print">Use for: Customer Print</option>
              </select>
              <input
                ref={pdfUploadRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handlePdfUpload(f)
                  e.target.value = ''
                }}
              />
              <button onClick={() => pdfUploadRef.current?.click()} disabled={pdfUploading || !factoryId} className="btn btn-inputer">
                {pdfUploading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Upload size={14}/>}
                Upload PDF
              </button>
            </div>
            {pdfStatus && (
              <p className={`text-xs ${pdfStatus.startsWith('Error') ? 'text-red-400' : 'text-green-500'}`}>{pdfStatus}</p>
            )}
          </div>

          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Usage</th><th>Selected PDF</th><th className="text-right">Action</th></tr></thead>
              <tbody>
                {([
                  { slot: 'label', label: 'Label Print', hint: 'Inward / Outward / Domestic / International labels' },
                  { slot: 'letter-head', label: 'Letter Head Print', hint: 'Domestic / International invoices + quotation prints' },
                  { slot: 'customer-print', label: 'Customer Print', hint: 'Customer details print template (optional)' },
                ] as const).map(row => (
                  <tr key={row.slot}>
                    <td>
                      <div className="font-medium text-primary">{row.label}</div>
                      <div className="text-[11px] text-muted">{row.hint}</div>
                    </td>
                    <td>
                      <select
                        value={pdfSelected[row.slot] || ''}
                        onChange={e => assignPdf(row.slot, e.target.value)}
                        className="input w-full"
                      >
                        {row.slot !== 'customer-print' && (
                          <option value={row.slot === 'label' ? '/Label.pdf' : '/letter-head.pdf'}>
                            Default ({row.slot === 'label' ? '/Label.pdf' : '/letter-head.pdf'})
                          </option>
                        )}
                        {row.slot === 'customer-print' && (
                          <>
                            <option value="">Built-in simple print</option>
                            <option value="/address print.pdf">Default (/address print.pdf)</option>
                          </>
                        )}
                        {pdfFiles.map(f => <option key={`${row.slot}-${f}`} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td className="text-right">
                      {pdfSelected[row.slot] ? (
                        <a
                          href={`/api/io/pdf?path=${encodeURIComponent(pdfSelected[row.slot])}${factoryId ? `&factoryId=${encodeURIComponent(factoryId)}` : ''}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-inputer hover:underline"
                        >
                          Preview
                        </a>
                      ) : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NUMBERING TAB ─────────────────────────────────────────────────── */}
      {tab === 'numbering' && (
        <div className="space-y-4">
          {!factoryId && (
            <p className="text-sm text-amber-500 flex items-center gap-2"><AlertCircle size={14}/> Select a factory in the header — numbering is saved per factory for your account.</p>
          )}
          {factoryId && (
            <p className="text-sm text-muted mb-1">
              Numbering for <span className="font-medium text-primary">{factoryName ?? 'selected factory'}</span>.
            </p>
          )}
          <p className="text-sm text-muted">
            Prefix and suffix wrap the numeric core only (e.g. <span className="font-mono">1/05/26</span>), not a second copy of VH.
            Inward, Outward, and Quotation default to prefix <span className="font-mono">VH </span>; Domestic and International use no prefix.
            Example with prefix <span className="font-mono">AB</span>: <span className="font-mono">AB1/05/26</span> — not <span className="font-mono">ABVH1/05/26</span>.
            Settings are saved per selected factory.
          </p>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Document Type</th><th>Prefix</th><th>Suffix</th><th>Preview</th></tr></thead>
              <tbody>
                {numberingLoading ? (
                  <tr><td colSpan={4}><Spinner/></td></tr>
                ) : ([
                  { key: 'inward',        label: 'Inward Number'         },
                  { key: 'outward',       label: 'Outward Number'        },
                  { key: 'domestic',      label: 'Domestic Invoice'      },
                  { key: 'international', label: 'International Invoice'  },
                  { key: 'quotation',     label: 'Quotation'             },
                ] as const).map(({ key, label }) => (
                  <tr key={key}>
                    <td className="font-medium text-primary text-sm">{label}</td>
                    <td className="w-40"><input value={getNum(key).prefix} onChange={e => setNum(key, 'prefix', e.target.value)} placeholder="e.g. IN/" className="input w-full py-1.5 text-sm font-mono"/></td>
                    <td className="w-40"><input value={getNum(key).suffix} onChange={e => setNum(key, 'suffix', e.target.value)} placeholder="e.g. /24-25" className="input w-full py-1.5 text-sm font-mono"/></td>
                    <td className="text-xs font-mono text-muted whitespace-nowrap">
                      {(getNum(key).prefix || '') + '1/05/26' + (getNum(key).suffix || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {numberingError && <p className="text-xs text-red-400">{numberingError}</p>}
          <div className="flex items-center justify-end gap-3">
            {numberingSaved && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={13}/> Saved</span>}
            <button onClick={saveNumbering} disabled={!factoryId} className="btn btn-inputer"><Save size={14}/> Save Settings</button>
          </div>
        </div>
      )}

      {/* ── SHARED MODALS ──────────────────────────────────────────────────── */}
      {showProductModal && (
        <ProductModal
          editing={editingProduct}
          factoryId={factoryId || null}
          onClose={() => { setShowProductModal(false); setEditingProduct(null) }}
          onSaved={() => { setShowProductModal(false); setEditingProduct(null); loadProducts() }}
        />
      )}
      {showCompanyModal && (
        <CompanyModal
          editing={editingCompany}
          factoryId={factoryId || null}
          onClose={() => { setShowCompanyModal(false); setEditingCompany(null) }}
          onSaved={() => { setShowCompanyModal(false); setEditingCompany(null); loadCompanies() }}
        />
      )}

      {/* ── UNIT FORM MODAL ─────────────────────────────────────────────────── */}
      {showUnitForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-sm border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-primary">{editingUnit ? 'Edit Unit' : 'New Unit'}</h2>
              <button onClick={() => setShowUnitForm(false)} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Name *</label><input value={unitForm.name} onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kilogram" className="input w-full" autoFocus/></div>
              <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Abbreviation</label><input value={unitForm.abbreviation} onChange={e => setUnitForm(f => ({ ...f, abbreviation: e.target.value }))} placeholder="e.g. kg" className="input w-full"/></div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowUnitForm(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSaveUnit} disabled={unitSaving} className="btn btn-inputer">{unitSaving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Save size={14}/>}{editingUnit ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOCATION FORM MODAL ─────────────────────────────────────────────── */}
      {showLocForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-sm border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-primary">{editingLocId ? 'Edit' : 'Add'} {locTab === 'countries' ? 'Country' : locTab === 'states' ? 'State' : 'City'}</h2>
              <button onClick={() => setShowLocForm(false)} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              {locTab === 'states' && <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Country *</label><select value={locForm.country_id ?? ''} onChange={e => setLocForm(f => ({ ...f, country_id: e.target.value }))} className="input w-full"><option value="">— Select —</option>{countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
              {locTab === 'cities' && <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">State *</label><select value={locForm.state_id ?? ''} onChange={e => setLocForm(f => ({ ...f, state_id: e.target.value }))} className="input w-full"><option value="">— Select —</option>{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
              <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Name *</label><input value={locForm.name ?? ''} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className="input w-full" autoFocus/></div>
              {locTab !== 'cities' && <div><label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Code</label><input value={locForm.code ?? ''} onChange={e => setLocForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. IN" className="input w-full"/></div>}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowLocForm(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSaveLoc} disabled={locSaving} className="btn btn-inputer">{locSaving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Save size={14}/>}{editingLocId ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV IMPORT MODAL ────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-primary">Import Products from CSV</h2>
              <button onClick={() => { setShowImport(false); setCsvRows([]); setImportResult(null); if (fileRef.current) fileRef.current.value = '' }} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Format hint */}
              <div className="rounded-xl p-4 border border-border" style={{ background: 'var(--color-surface)' }}>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Expected CSV columns</p>
                <code className="text-xs text-inputer font-mono">product_name, hsn_code, rate, description</code>
                <p className="text-[11px] text-muted mt-1">Only <strong>product_name</strong> is required. Other columns are optional.</p>
              </div>

              {/* File picker */}
              <div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" id="csv-upload"/>
                <label htmlFor="csv-upload" className="btn btn-ghost cursor-pointer w-full justify-center">
                  <Upload size={15}/> {csvRows.length > 0 ? `${csvRows.length} rows loaded — click to change` : 'Choose CSV file'}
                </label>
              </div>

              {/* Preview */}
              {csvRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Preview ({Math.min(csvRows.length, 5)} of {csvRows.length} rows)</p>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="data-table">
                      <thead><tr><th>Product Name</th><th>HSN Code</th><th className="text-right">Rate</th><th>Description</th></tr></thead>
                      <tbody>
                        {csvRows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td className="font-medium text-primary">{row['product_name'] || row['name'] || <span className="text-red-400">missing</span>}</td>
                            <td className="font-mono text-xs text-muted">{row['hsn_code'] || row['hsn'] || '—'}</td>
                            <td className="text-right text-xs">{row['rate'] ? `₹${row['rate']}` : '—'}</td>
                            <td className="text-xs text-muted">{row['description'] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Result */}
              {importResult && (
                <div className={clsx('flex items-center gap-3 rounded-xl px-4 py-3 border', importResult.fail === 0 ? 'border-green-500/20 bg-green-500/10' : 'border-yellow-500/20 bg-yellow-500/10')}>
                  {importResult.fail === 0 ? <CheckCircle size={16} className="text-green-400 flex-shrink-0"/> : <AlertCircle size={16} className="text-yellow-400 flex-shrink-0"/>}
                  <span className="text-sm text-primary">
                    <strong>{importResult.ok}</strong> products imported
                    {importResult.fail > 0 && <>, <strong>{importResult.fail}</strong> failed (missing name or duplicate)</>}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowImport(false); setCsvRows([]); setImportResult(null) }} className="btn btn-ghost">Close</button>
              {csvRows.length > 0 && !importResult && (
                <button onClick={handleImport} disabled={importing} className="btn btn-inputer">
                  {importing ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Upload size={14}/>}
                  Import {csvRows.length} Products
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── COMPANY CSV IMPORT MODAL ─────────────────────────────────────────── */}
      {showCompImport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl my-6 border border-border" style={{ background: 'var(--color-panel)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-primary">Import Companies from CSV</h2>
              <button onClick={() => { setShowCompImport(false); setCompCsvRows([]); setCompImportResult(null); if (compFileRef.current) compFileRef.current.value = '' }} className="text-muted hover:text-primary"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Format hint */}
              <div className="rounded-xl p-4 border border-border" style={{ background: 'var(--color-surface)' }}>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Expected CSV columns</p>
                <code className="text-xs text-inputer font-mono">company_name, company_type, person_name, mobile, email, address, pincode</code>
                <p className="text-[11px] text-muted mt-1">Only <strong>company_name</strong> is required. <strong>company_type</strong> can be <em>supplier</em>, <em>customer</em>, or <em>both</em> (defaults to supplier).</p>
              </div>

              {/* File picker */}
              <div>
                <input ref={compFileRef} type="file" accept=".csv,text/csv" onChange={handleCompFileChange} className="hidden" id="comp-csv-upload"/>
                <label htmlFor="comp-csv-upload" className="btn btn-ghost cursor-pointer w-full justify-center">
                  <Upload size={15}/> {compCsvRows.length > 0 ? `${compCsvRows.length} rows loaded — click to change` : 'Choose CSV file'}
                </label>
              </div>

              {/* Preview */}
              {compCsvRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Preview ({Math.min(compCsvRows.length, 5)} of {compCsvRows.length} rows)</p>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="data-table">
                      <thead><tr><th>Company Name</th><th>Type</th><th>Contact</th><th>Mobile</th><th>Email</th></tr></thead>
                      <tbody>
                        {compCsvRows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            <td className="font-medium text-primary">{row['company_name'] || row['name'] || <span className="text-red-400">missing</span>}</td>
                            <td className="text-xs text-muted">{row['company_type'] || row['type'] || 'supplier'}</td>
                            <td className="text-xs text-muted">{row['person_name'] || row['contact'] || '—'}</td>
                            <td className="text-xs text-muted">{row['mobile'] || row['phone'] || '—'}</td>
                            <td className="text-xs text-muted">{row['email'] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Result */}
              {compImportResult && (
                <div className={clsx('flex items-center gap-3 rounded-xl px-4 py-3 border', compImportResult.fail === 0 ? 'border-green-500/20 bg-green-500/10' : 'border-yellow-500/20 bg-yellow-500/10')}>
                  {compImportResult.fail === 0 ? <CheckCircle size={16} className="text-green-400 flex-shrink-0"/> : <AlertCircle size={16} className="text-yellow-400 flex-shrink-0"/>}
                  <span className="text-sm text-primary">
                    <strong>{compImportResult.ok}</strong> companies imported
                    {compImportResult.fail > 0 && <>, <strong>{compImportResult.fail}</strong> failed (missing name or duplicate)</>}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowCompImport(false); setCompCsvRows([]); setCompImportResult(null) }} className="btn btn-ghost">Close</button>
              {compCsvRows.length > 0 && !compImportResult && (
                <button onClick={handleCompImport} disabled={compImporting} className="btn btn-inputer">
                  {compImporting ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <Upload size={14}/>}
                  Import {compCsvRows.length} Companies
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
