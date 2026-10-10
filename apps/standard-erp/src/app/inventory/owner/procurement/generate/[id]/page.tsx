'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import ProcurementPoDocument, {
  type PoDocumentData,
} from '@/components/inventory/ProcurementPoDocument'
import { inventoryApi } from '@/lib/client/inventory-api'
import { numberingApi, factoriesApi, procurementApi } from '@/lib/api'
import {
  DEFAULT_MATERIAL_HSN,
  parseMaterialCatalog,
  resolveMaterialHsn,
} from '@/lib/procurement-materials'
import {
  formatPoDate,
  gstSplit,
  previewPoNumber,
  resolvePoLogoUrl,
  serializePoLines,
  factoryDeliveryPlace,
} from '@/lib/procurement-po-format'
import {
  buildBillShipParties,
  resolvePartyBlock,
} from '@/lib/bill-ship-parties'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { CheckCircle, Download, Plus } from 'lucide-react'
import { downloadProcurementPo } from '@/lib/procurement-po-print'
import type { Factory } from '@/types'
import { SkeletonPanel } from '@/components/ui'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import VendorRegistrationForm from '@/components/inventory/VendorRegistrationForm'
import {
  emptyVendorForm,
  toCreateSupplierInput,
  validateVendorForm,
  type VendorFieldErrors,
} from '@/lib/vendor-registration'

const FALLBACK_MATERIALS = Object.keys(DEFAULT_MATERIAL_HSN)

function materialList(factory?: Factory | null): string[] {
  const catalog = parseMaterialCatalog(factory?.materials)
  const base = catalog.length > 0 ? catalog.map((m) => m.name) : FALLBACK_MATERIALS
  return [...base, 'Other']
}

type PoFormLine = {
  key: string
  materialType: string
  customMaterial: string
  qty: string
  unit: string
  price: string
}

function newPoLine(partial?: Partial<PoFormLine>): PoFormLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    materialType: '',
    customMaterial: '',
    qty: '',
    unit: 'Kg',
    price: '',
    ...partial,
  }
}

function resolveLineMaterial(line: PoFormLine) {
  return line.materialType === 'Other' ? line.customMaterial.trim() : line.materialType.trim()
}

type MaterialRequest = {
  id: string
  factory_id: string
  material_type: string
  qty: number | null
  unit: string
  needed_by_date: string | null
  notes: string | null
  status: string
}

type SupplierRow = {
  id: string
  name: string
  company_address?: string | null
  gst_number?: string | null
  email?: string | null
  contact_name?: string | null
  contact_phone?: string | null
}

/** Standard commercial payment terms for procurement POs */
const PAYMENT_TERMS = [
  '100% Advance',
  '50% Advance, 50% Against Delivery',
  '30% Advance, 70% Against Delivery',
  'Against Delivery (COD)',
  'Against Invoice',
  'Net 7 days',
  'Net 15 days',
  'Net 21 days',
  'Net 30 days',
  'Net 45 days',
  'Net 60 days',
  'Net 90 days',
  '15 days from invoice',
  '30 days from invoice',
  '45 days from invoice',
  '60 days from invoice',
  '60 days from the date of receipt of material',
  'Letter of Credit (LC)',
  'Documents Against Payment (DP)',
  'Documents Against Acceptance (DA)',
  'Post Dated Cheque (PDC)',
  'Through bank against documents',
] as const

export function GeneratePoForm({
  requestId,
  onClose,
  listHref = '/inventory/owner/procurement',
  accent = 'owner',
}: {
  requestId: string
  onClose?: () => void
  listHref?: string
  accent?: 'owner' | 'accountant'
}) {
  const id = requestId
  const isDirect = id === 'new'
  const { profile } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const router = useRouter()
  const [req, setReq] = useState<MaterialRequest | null>(null)
  const [directFactoryId, setDirectFactoryId] = useState('')
  const [poLines, setPoLines] = useState<PoFormLine[]>([newPoLine()])
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [factoryDetails, setFactoryDetails] = useState<Factory | null>(null)
  const [managementFactories, setManagementFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [vendorSaving, setVendorSaving] = useState(false)
  const [vendorError, setVendorError] = useState('')
  const [vendorForm, setVendorForm] = useState(emptyVendorForm)
  const [vendorFieldErrors, setVendorFieldErrors] = useState<VendorFieldErrors>({})
  const [vendorFactoryId, setVendorFactoryId] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [emailResult, setEmailResult] = useState<{
    emailed_to?: string
    email_sent?: boolean
    email_dev_logged?: boolean
    email_error?: string
  } | null>(null)
  const [generatedOrderId, setGeneratedOrderId] = useState<string | null>(null)
  const [emailing, setEmailing] = useState(false)
  const [lastPoDoc, setLastPoDoc] = useState<PoDocumentData | null>(null)
  const [pdfDownloaded, setPdfDownloaded] = useState(false)
  const [form, setForm] = useState({
    supplier_id: '',
    supplier_name: '',
    bill_to_key: '',
    ship_to_key: '',
    line_remarks: '',
    delivery_date: '',
    payment_terms: '',
    quality_ref: '',
    coa_required: true,
    special_instructions: '',
    transporter: '',
  })
  const [poPrefix, setPoPrefix] = useState('PO')
  /** Track when bill/ship were manually changed so vendor change doesn't overwrite. */
  const [billShipTouched, setBillShipTouched] = useState({ bill_to: false, ship_to: false })

  const factory = factoryDetails || profile?.factories?.[0] || null
  const companyName = factory?.name || 'Issuing factory'
  const activeFactoryId = isDirect ? directFactoryId : req?.factory_id || ''
  const factoryKey = factory ? `factory:${factory.id}` : activeFactoryId ? `factory:${activeFactoryId}` : ''
  const resolvedLines = useMemo(() => {
    return poLines.map((line) => {
      const materialType = resolveLineMaterial(line)
      return {
        materialType,
        hsnCode: resolveMaterialHsn(materialType, factory?.materials),
        qty: Number(line.qty),
        unit: line.unit,
        pricePerUnit: Number(line.price),
      }
    })
  }, [poLines, factory?.materials])
  const firstLine = resolvedLines[0]
  const resolvedMaterial = firstLine?.materialType || ''
  const hsnCode = firstLine?.hsnCode || ''
  const materialOptions = useMemo(() => materialList(factory), [factory])

  const parties = useMemo(
    () => buildBillShipParties(managementFactories.length > 0 ? managementFactories : factory ? [factory] : []),
    [managementFactories, factory],
  )

  useEffect(() => {
    async function load() {
      if (!profile) return
      try {

      let list: Factory[] = []
      try {
        const facRes = await factoriesApi.getAll()
        list = (facRes.factories ?? []) as Factory[]
        if (list.length === 0) list = (profile.factories ?? []) as Factory[]
        setManagementFactories(list)
      } catch {
        list = (profile.factories ?? []) as Factory[]
        setManagementFactories(list)
      }

      if (isDirect) {
        const preferred =
          (ctxFactoryId && list.some((f) => f.id === ctxFactoryId) && ctxFactoryId) ||
          (profile.factories?.[0]?.id ?? '') ||
          (list.find((f) => f.is_active !== false)?.id ?? '') ||
          (list[0]?.id ?? '')
        if (!preferred) {
          setError('No factory available — add one under Management first')
          setLoading(false)
          return
        }
        const fresh = list.find((f) => f.id === preferred) || profile.factories?.find((f) => f.id === preferred) || null
        setDirectFactoryId(preferred)
        setFactoryDetails(fresh)
        const defaultKey = `factory:${preferred}`
        setForm((f) => ({
          ...f,
          bill_to_key: f.bill_to_key || defaultKey,
          ship_to_key: f.ship_to_key || defaultKey,
        }))
        setLoading(false)
        try {
          const { suppliers: rows } = await inventoryApi.getSuppliers(preferred)
          setSuppliers((rows ?? []) as SupplierRow[])
        } catch {
          setSuppliers([])
        }
        return
      }

      if (!profile.factories?.length && list.length === 0) {
        setError('No factory assigned')
        setLoading(false)
        return
      }

      const searchFactoryId = ctxFactoryId || profile.factories?.[0]?.id || list[0]?.id
      const data = await procurementApi.listRequests(searchFactoryId)
      let found = (data.requests ?? []).find((r: MaterialRequest) => r.id === id) as
        | MaterialRequest
        | undefined
      if (!found && profile.factories) {
        for (const f of profile.factories) {
          if (f.id === searchFactoryId) continue
          const more = await procurementApi.listRequests(f.id)
          found = (more.requests ?? []).find((r: MaterialRequest) => r.id === id)
          if (found) break
        }
      }
      if (!found) {
        setError('Request not found or already converted')
        setLoading(false)
        return
      }
      setReq(found)
      setPoLines([
        newPoLine({
          key: 'request',
          materialType: found.material_type,
          qty: found.qty != null ? String(found.qty) : '',
          unit: found.unit || 'Kg',
        }),
      ])
      const profileFactory =
        list.find((f) => f.id === found!.factory_id) ||
        profile.factories?.find((f) => f.id === found!.factory_id) ||
        profile.factories?.[0] ||
        null
      setFactoryDetails(profileFactory)
      let defaultKey = `factory:${found.factory_id}`
      const fresh = list.find((f) => f.id === found!.factory_id)
      if (fresh) setFactoryDetails(fresh)
      if (fresh?.is_active === false) {
        const active = list.find((f) => f.is_active !== false)
        if (active) defaultKey = `factory:${active.id}`
      }
      setForm((f) => ({
        ...f,
        delivery_date: found!.needed_by_date ?? '',
        bill_to_key: f.bill_to_key || defaultKey,
        ship_to_key: f.ship_to_key || defaultKey,
      }))
      const { suppliers: rows } = await inventoryApi.getSuppliers(found.factory_id)
      setSuppliers((rows ?? []) as SupplierRow[])
      setLoading(false)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setLoading(false)
      }
    }
    load()
  }, [id, isDirect, profile, ctxFactoryId])

  useEffect(() => {
    if (!activeFactoryId) return
    let cancelled = false
    numberingApi.get(activeFactoryId).then((data) => {
      const prefix = typeof data.config?.po?.prefix === 'string' ? data.config.po.prefix.trim() : ''
      if (!cancelled && prefix) setPoPrefix(prefix)
    }).catch(() => {
      /* keep generic PO prefix */
    })
    return () => {
      cancelled = true
    }
  }, [activeFactoryId])

  function update(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function setVendor(supplierId: string, supplierName: string) {
    const name = supplierName.trim()
    setForm((f) => ({
      ...f,
      supplier_id: supplierId,
      supplier_name: name,
      // Bill to / Ship to stay on the issuing factory unless the owner changed them
      bill_to_key: billShipTouched.bill_to ? f.bill_to_key : factoryKey || f.bill_to_key,
      ship_to_key: billShipTouched.ship_to ? f.ship_to_key : factoryKey || f.ship_to_key,
    }))
  }

  async function refreshSuppliers(factoryId: string) {
    const { suppliers: rows } = await inventoryApi.getSuppliers(factoryId)
    setSuppliers((rows ?? []) as SupplierRow[])
  }

  function closeAddVendor() {
    setShowAddVendor(false)
    setVendorForm(emptyVendorForm)
    setVendorFieldErrors({})
    setVendorError('')
  }

  async function handleAddVendor() {
    const factoryId = vendorFactoryId || activeFactoryId
    if (!factoryId) {
      setVendorError('Factory is required')
      return
    }
    const { error: vError, fieldErrors: nextFieldErrors } = validateVendorForm(vendorForm)
    setVendorFieldErrors(nextFieldErrors)
    if (vError) {
      setVendorError(vError)
      return
    }
    if (nextFieldErrors.gst_number || nextFieldErrors.email || nextFieldErrors.contact_phone) {
      setVendorError('')
      return
    }
    setVendorSaving(true)
    setVendorError('')
    try {
      const res = await inventoryApi.createSupplier(factoryId, toCreateSupplierInput(vendorForm))
      const created = (res as { supplier?: SupplierRow })?.supplier
      await refreshSuppliers(activeFactoryId || factoryId)
      const name = created?.name || vendorForm.name.trim()
      const matched =
        created ||
        ((await inventoryApi.getSuppliers(activeFactoryId || factoryId)).suppliers as SupplierRow[] | undefined)?.find(
          (s) => s.name === name,
        )
      setVendor(matched?.id || created?.id || '', name)
      closeAddVendor()
    } catch (err: unknown) {
      setVendorError(err instanceof Error ? err.message : 'Failed to add vendor')
    }
    setVendorSaving(false)
  }

  function validateForm(): string | null {
    if (resolvedLines.length === 0) return 'Add at least one material'
    for (const [i, line] of resolvedLines.entries()) {
      if (!line.materialType) return `Material is required on line ${i + 1}`
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        return `Quantity must be greater than zero on line ${i + 1}`
      }
      if (!Number.isFinite(line.pricePerUnit) || line.pricePerUnit < 0) {
        return `Price per unit is required on line ${i + 1}`
      }
    }
    if (!form.payment_terms.trim()) return 'Terms of payment is required'
    if (!form.supplier_name.trim()) return 'Vendor is required — select or add a vendor'
    if (!form.bill_to_key.trim()) return 'Bill to is required'
    if (!form.ship_to_key.trim()) return 'Ship to is required'
    if (!form.delivery_date) return 'Delivery date is required'
    if (req?.needed_by_date && form.delivery_date > req.needed_by_date) {
      return `Delivery date must be on or before ${req.needed_by_date}`
    }
    return null
  }

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === form.supplier_id),
    [suppliers, form.supplier_id],
  )

  function billShipBlocks() {
    const factoryFallback = parties.find((p) => p.key === factoryKey)?.block || companyName
    return {
      billTo: resolvePartyBlock(form.bill_to_key, parties, factoryFallback),
      shipTo: resolvePartyBlock(form.ship_to_key, parties, factoryFallback),
    }
  }

  function buildPoDocument(poNumberOverride?: string): PoDocumentData | null {
    if (!resolvedMaterial) return null
    if (!isDirect && !req) return null
    const qtyNum = firstLine?.qty ?? 0
    const priceNum = firstLine?.pricePerUnit ?? 0
    const { billTo, shipTo } = billShipBlocks()
    const billFactoryId = form.bill_to_key.startsWith('factory:')
      ? form.bill_to_key.slice('factory:'.length)
      : ''
    const shipFactoryId = form.ship_to_key.startsWith('factory:')
      ? form.ship_to_key.slice('factory:'.length)
      : ''
    const billFactory =
      managementFactories.find((f) => f.id === billFactoryId) ||
      factory ||
      null
    const shipFactory =
      managementFactories.find((f) => f.id === shipFactoryId) ||
      billFactory
    const tax = gstSplit(billFactory?.gst_number, selectedSupplier?.gst_number)
    return {
      companyName: billFactory?.name || companyName,
      companyAddress: billFactory?.company_address || billFactory?.location || undefined,
      companyGstin: billFactory?.gst_number || undefined,
      companyPan: billFactory?.pan_number || undefined,
      companyGstRange: billFactory?.gst_range || undefined,
      companyGstDivision: billFactory?.gst_division || undefined,
      companyCommissionerate: billFactory?.commissionerate || undefined,
      vendorName: form.supplier_name.trim(),
      vendorAddress: selectedSupplier?.company_address || undefined,
      vendorGstin: selectedSupplier?.gst_number || undefined,
      vendorEmail: selectedSupplier?.email || undefined,
      poNumber: poNumberOverride?.trim() || previewPoNumber(poPrefix),
      poDate: formatPoDate(new Date().toISOString().slice(0, 10)),
      billTo,
      shipTo,
      deliveryPlace: factoryDeliveryPlace(shipFactory || billFactory) || undefined,
      scheduleDate: form.delivery_date ? formatPoDate(form.delivery_date) : undefined,
      transporter: form.transporter.trim() || undefined,
      materialType: resolvedMaterial,
      hsnCode,
      qty: qtyNum,
      unit: firstLine?.unit || 'Kg',
      pricePerUnit: priceNum,
      lines: resolvedLines.filter((l) => l.materialType),
      lineRemarks: form.line_remarks.trim() || undefined,
      deliverySchedule: form.delivery_date
        ? `On or before ${formatPoDate(form.delivery_date)}`
        : 'As per requirement',
      paymentTerms: form.payment_terms,
      qualityRef: form.quality_ref.trim() || undefined,
      coaRequired: form.coa_required,
      specialInstructions: form.special_instructions.trim() || undefined,
      cgstRate: tax.cgstRate,
      sgstRate: tax.sgstRate,
      igstRate: tax.igstRate,
      factoryId: billFactory?.id,
      logoUrl: resolvePoLogoUrl(billFactory?.name, billFactory?.id),
    }
  }

  function openReview() {
    const err = validateForm()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setShowReview(true)
  }

  async function handleGenerate() {
    const err = validateForm()
    if (err) {
      setError(err)
      return
    }
    if (!profile?.id) return
    if (!isDirect && !req) return
    if (isDirect && (!activeFactoryId || !resolvedMaterial)) return

    setSaving(true)
    setError('')
    setEmailResult(null)

    const qtyNum = firstLine?.qty ?? 0
    const priceNum = firstLine?.pricePerUnit ?? 0
    const vendorName = form.supplier_name.trim()
    const vendorEmail = (selectedSupplier?.email || '').trim().toLowerCase() || undefined
    const { billTo, shipTo } = billShipBlocks()
    const result = await procurementApi.generatePo({
      ...(isDirect
        ? { factory_id: activeFactoryId, material_type: resolvedMaterial }
        : { request_id: req!.id }),
      supplier_id: form.supplier_id || undefined,
      supplier_name: vendorName,
      bill_to: billTo,
      ship_to: shipTo,
      qty: qtyNum,
      unit: firstLine?.unit || 'Kg',
      price_per_unit: priceNum,
      hsn_code: hsnCode || undefined,
      lines: serializePoLines(resolvedLines),
      line_remarks: form.line_remarks.trim() || undefined,
      vendor_email: vendorEmail,
      delivery_date: form.delivery_date,
      payment_terms: form.payment_terms.trim(),
      quality_ref: form.quality_ref.trim() || undefined,
      coa_required: form.coa_required,
      special_instructions: form.special_instructions.trim() || undefined,
      created_by: profile.id,
    })

    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    const savedPoNumber =
      typeof result.order?.po_number === 'string' ? result.order.po_number : undefined
    const orderId = typeof result.order?.id === 'string' ? result.order.id : null
    const doc = buildPoDocument(savedPoNumber)
    let downloaded = false
    if (doc) {
      setLastPoDoc(doc)
      try {
        await downloadProcurementPo(doc)
        downloaded = true
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown error'
        setError(`PO saved, but PDF download failed — use Download PDF below. (${detail})`)
      }
    }
    setPdfDownloaded(downloaded)
    setGeneratedOrderId(orderId)
    setSuccess(true)
    setSaving(false)
  }

  async function handleEmailVendor() {
    if (!generatedOrderId) return
    const to = (selectedSupplier?.email || lastPoDoc?.vendorEmail || '').trim().toLowerCase()
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setError('Vendor email is required to send — add email on the vendor first')
      return
    }
    setEmailing(true)
    setError('')
    const result = await procurementApi.emailPo({
      order_id: generatedOrderId,
      to_email: to,
      po_document: lastPoDoc ? (lastPoDoc as unknown as Record<string, unknown>) : undefined,
    })
    setEmailing(false)
    if (result.error) {
      setEmailResult({ email_error: result.error, emailed_to: to })
      return
    }
    setEmailResult({
      emailed_to: result.emailed_to || to,
      email_sent: result.email_sent,
      email_dev_logged: result.email_dev_logged,
      email_error: result.email_error,
    })
  }

  const inDrawer = Boolean(onClose)
  const accentBtn = accent === 'accountant' ? 'btn-pmc' : 'btn-owner'
  const accentSolid =
    accent === 'accountant'
      ? 'border border-pmc bg-pmc text-white'
      : 'border border-owner bg-owner text-white'
  const accentIcon = accent === 'accountant' ? 'text-pmc' : 'text-owner'

  function goBackToList() {
    if (onClose) onClose()
    else router.push(listHref)
  }

  const formShell = (children: ReactNode) =>
    inDrawer ? <>{children}</> : <AppLayout>{children}</AppLayout>

  if (success) {
    return formShell(
        <div className={inDrawer ? 'flex min-h-[60vh] items-center justify-center p-6' : 'flex min-h-screen items-center justify-center p-4'}>
          <div className="animate-fade-up w-full max-w-md text-center space-y-4">
            <CheckCircle size={56} className={`mx-auto ${accentIcon}`} />
            <h2 className="font-display text-2xl font-bold text-primary">PO generated</h2>
            <p className="text-muted">
              Status <span className="text-primary">issued</span>
              {pdfDownloaded
                ? ' · PDF purchase order downloaded.'
                : ' · PDF not downloaded yet — use Download PDF below.'}{' '}
              Email is separate — send only when you are ready.
            </p>
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            {emailResult?.email_sent || emailResult?.email_dev_logged ? (
              <p className="text-sm text-primary">
                {emailResult.email_sent
                  ? `Emailed to ${emailResult.emailed_to}`
                  : `Dev: email logged for ${emailResult.emailed_to}`}
              </p>
            ) : emailResult?.email_error ? (
              <p className="text-sm text-red-600">{emailResult.email_error}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {lastPoDoc ? (
                <button
                  type="button"
                  onClick={() => void downloadProcurementPo(lastPoDoc)}
                  className="btn btn-ghost h-11 justify-center gap-2"
                >
                  <Download size={15} />
                  Download PDF
                </button>
              ) : null}
              <button
                type="button"
                disabled={emailing || Boolean(emailResult?.email_sent || emailResult?.email_dev_logged)}
                onClick={() => void handleEmailVendor()}
                className={`btn ${accentBtn} h-11 justify-center`}
              >
                {emailing
                  ? 'Sending…'
                  : emailResult?.email_sent || emailResult?.email_dev_logged
                    ? 'Emailed'
                    : 'Email vendor'}
              </button>
              <button
                type="button"
                onClick={goBackToList}
                className={`btn h-11 justify-center ${accentSolid}`}
              >
                Back to purchase orders
              </button>
            </div>
          </div>
        </div>
    )
  }

  const poDoc = buildPoDocument()

  return formShell(
    <>
      <div className={inDrawer ? 'flex h-full min-h-0 flex-1 flex-col' : 'mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col'}>
        <div className={inDrawer ? 'min-h-0 flex-1 overflow-y-auto p-4 sm:p-6' : 'min-h-0 flex-1 overflow-y-auto p-4 md:p-8'}>
        {inDrawer ? (
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wider text-muted">
              {isDirect ? 'Direct PO' : 'From chemist request'}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-primary">
              {isDirect ? 'Create purchase order' : 'Generate purchase order'}
            </h2>
          </div>
        ) : (
          <PageHeader
            title={isDirect ? 'Create purchase order' : 'Generate purchase order'}
            subtitle={
              isDirect
                ? `${accent === 'accountant' ? 'Accounts' : 'Owner'} · create PO — generate saves & downloads PDF; email vendor separately`
                : `${accent === 'accountant' ? 'Accounts' : 'Owner'} · vendor, terms — generate saves & downloads PDF; email vendor separately`
            }
            accent={accent}
            actions={
              <button type="button" onClick={goBackToList} className="text-sm text-muted hover:text-foreground">
                ← Procurement
              </button>
            }
          />
        )}

        {loading ? (
          <SkeletonPanel rows={6} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              openReview()
            }}
            className="space-y-6"
          >
            {isDirect ? (
              <p className="text-xs text-muted">
                Direct PO — no chemist request. Add one or more materials below.
              </p>
            ) : (
              req && (
                <div className="rounded-lg border border-border bg-layer-sm px-4 py-3 text-sm space-y-1">
                  <p>
                    <span className="text-muted">Chemist requested:</span>{' '}
                    <strong className="text-primary">
                      {req.material_type}
                      {req.qty != null ? ` · ${req.qty} ${req.unit}` : ''}
                    </strong>
                  </p>
                  <p>
                    <span className="text-muted">Needed by:</span>{' '}
                    <strong className="text-primary">{req.needed_by_date}</strong>
                  </p>
                  {req.notes && (
                    <p>
                      <span className="text-muted">Request notes:</span> {req.notes}
                    </p>
                  )}
                </div>
              )
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="block font-mono text-xs uppercase tracking-widest text-muted">
                  Materials *
                </label>
                <button
                  type="button"
                  onClick={() => setPoLines((rows) => [...rows, newPoLine()])}
                  className={`inline-flex items-center gap-1 text-xs font-medium ${accentIcon} hover:underline`}
                >
                  <Plus size={14} /> Add material
                </button>
              </div>
              {poLines.map((line, index) => {
                const lockMaterial = !isDirect && index === 0
                const lineHsn = resolveMaterialHsn(resolveLineMaterial(line), factory?.materials)
                return (
                  <div key={line.key} className="space-y-3 rounded-lg border border-border bg-layer-sm px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-muted">Line {index + 1}</p>
                      {poLines.length > 1 && !lockMaterial ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPoLines((rows) => rows.filter((r) => r.key !== line.key))
                          }
                          className="text-xs text-muted hover:text-primary"
                          aria-label={`Remove line ${index + 1}`}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted">
                        Material *
                      </label>
                      {lockMaterial ? (
                        <p className="text-sm font-medium text-primary">{line.materialType}</p>
                      ) : (
                        <>
                          <select
                            className="input-field"
                            required
                            value={line.materialType}
                            onChange={(e) => {
                              const value = e.target.value
                              setPoLines((rows) =>
                                rows.map((r) =>
                                  r.key === line.key
                                    ? {
                                        ...r,
                                        materialType: value,
                                        customMaterial: value === 'Other' ? r.customMaterial : '',
                                      }
                                    : r,
                                ),
                              )
                            }}
                          >
                            <option value="">Select material</option>
                            {materialOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          {line.materialType === 'Other' && (
                            <input
                              className="input-field mt-2"
                              required
                              placeholder="Material name"
                              value={line.customMaterial}
                              onChange={(e) =>
                                setPoLines((rows) =>
                                  rows.map((r) =>
                                    r.key === line.key ? { ...r, customMaterial: e.target.value } : r,
                                  ),
                                )
                              }
                            />
                          )}
                        </>
                      )}
                      {lineHsn ? (
                        <p className="mt-1.5 text-xs text-muted">
                          HSN <span className="font-mono text-primary">{lineHsn}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted">
                          Quantity *
                        </label>
                        <div className="flex gap-2">
                          <div className="min-w-0 flex-1">
                            <input
                              className="input-field"
                              type="number"
                              min="0.001"
                              step="any"
                              required
                              value={line.qty}
                              onChange={(e) =>
                                setPoLines((rows) =>
                                  rows.map((r) =>
                                    r.key === line.key ? { ...r, qty: e.target.value } : r,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="w-[5.75rem] shrink-0">
                            <select
                              className="input-field px-2 pr-8"
                              style={{ backgroundPosition: 'right 8px center' }}
                              value={line.unit}
                              onChange={(e) =>
                                setPoLines((rows) =>
                                  rows.map((r) =>
                                    r.key === line.key ? { ...r, unit: e.target.value } : r,
                                  ),
                                )
                              }
                              aria-label="Unit"
                            >
                              <option value="Kg">Kg</option>
                              <option value="MT">MT</option>
                              <option value="Nos">Nos</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-muted">
                          Price per unit *
                        </label>
                        <input
                          className="input-field"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          placeholder="0.00"
                          value={line.price}
                          onChange={(e) =>
                            setPoLines((rows) =>
                              rows.map((r) =>
                                r.key === line.key ? { ...r, price: e.target.value } : r,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block font-mono text-xs uppercase tracking-widest text-muted">
                  Vendor *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setVendorFactoryId(activeFactoryId)
                    setVendorError('')
                    setVendorFieldErrors({})
                    setVendorForm(emptyVendorForm)
                    setShowAddVendor(true)
                  }}
                  className={`inline-flex items-center gap-1 text-xs font-medium ${accentIcon} hover:underline`}
                >
                  <Plus size={14} /> Add Supplier
                </button>
              </div>

              {suppliers.length > 0 ? (
                <select
                  className="input-field"
                  required
                  value={form.supplier_id || form.supplier_name}
                  onChange={(e) => {
                    const s = suppliers.find((x) => x.id === e.target.value)
                    if (s) {
                      setVendor(s.id, s.name)
                    } else {
                      setVendor('', e.target.value)
                    }
                  }}
                >
                  <option value="">Select vendor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted">
                    No suppliers yet. Click <strong>Add Supplier</strong> to create one.
                  </p>
              )}
              {selectedSupplier?.email ? (
                <p className="mt-2 text-xs text-muted">
                  Vendor email on file:{' '}
                  <span className="font-mono text-primary">{selectedSupplier.email}</span>
                  {' '}(used when you click Email vendor)
                </p>
              ) : form.supplier_id ? (
                <p className="mt-2 text-xs text-amber-700">
                  No vendor email — you can still generate; add email before Email vendor
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bill-to" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                  Bill to *
                </label>
                <select id="bill-to"
                  className="input-field"
                  required
                  value={form.bill_to_key}
                  onChange={(e) => {
                    setBillShipTouched((t) => ({ ...t, bill_to: true }))
                    update('bill_to_key', e.target.value)
                  }}
                >
                  <option value="">Select factory</option>
                  {parties.map((p) => (
                    <option key={`bill-${p.key}`} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ship-to" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                  Ship to *
                </label>
                <select id="ship-to"
                  className="input-field"
                  required
                  value={form.ship_to_key}
                  onChange={(e) => {
                    setBillShipTouched((t) => ({ ...t, ship_to: true }))
                    update('ship_to_key', e.target.value)
                  }}
                >
                  <option value="">Select factory</option>
                  {parties.map((p) => (
                    <option key={`ship-${p.key}`} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="line-remarks" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                Line remarks
              </label>
              <input id="line-remarks"
                className="input-field"
                placeholder="e.g. Prices are including Freight"
                value={form.line_remarks}
                onChange={(e) => update('line_remarks', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="delivery-date" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                Delivery date *{' '}
                {!isDirect && (
                  <span className="normal-case">(on or before needed-by)</span>
                )}
              </label>
              <input id="delivery-date"
                className="input-field"
                type="date"
                required
                max={req?.needed_by_date ?? undefined}
                value={form.delivery_date}
                onChange={(e) => update('delivery_date', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="terms-of-payment" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                Terms of payment *
              </label>
              <select id="terms-of-payment"
                className="input-field"
                required
                value={form.payment_terms}
                onChange={(e) => update('payment_terms', e.target.value)}
              >
                <option value="">Select payment terms</option>
                {PAYMENT_TERMS.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="transporter" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                Transporter
              </label>
              <input id="transporter"
                className="input-field"
                placeholder="Optional"
                value={form.transporter}
                onChange={(e) => update('transporter', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="quality-ref" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                Quality / ref
              </label>
              <input id="quality-ref"
                className="input-field"
                placeholder="e.g. HPLC above 95%"
                value={form.quality_ref}
                onChange={(e) => update('quality_ref', e.target.value)}
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-primary">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.coa_required}
                onChange={(e) => update('coa_required', e.target.checked)}
              />
              <span>
                <strong>Analytical report (COA)</strong> must accompany material supply
              </span>
            </label>

            <div>
              <label htmlFor="special-instructions" className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
                Special instructions
              </label>
              <textarea id="special-instructions"
                className="input-field min-h-[80px]"
                placeholder="Free text for vendor"
                value={form.special_instructions}
                onChange={(e) => update('special_instructions', e.target.value)}
              />
            </div>
          </form>
        )}
        </div>
        {!loading ? (
          <div className="shrink-0 border-t border-border bg-panel px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBackToList}
                className="btn h-11 min-w-0 flex-1 justify-center border border-text bg-panel text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={openReview}
                className={`btn h-11 min-w-0 flex-1 justify-center ${accentSolid}`}
              >
                Confirm
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showAddVendor && (
        <MgmtDrawer
          layer="nested"
          eyebrow="Trade"
          title="New supplier"
          onClose={closeAddVendor}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeAddVendor}>
                Cancel
              </button>
              <button
                type="submit"
                form="po-supplier-form"
                disabled={vendorSaving}
                className={`btn ${accentBtn}`}
              >
                {vendorSaving ? 'Adding…' : 'Add supplier'}
              </button>
            </>
          }
        >
          <form
            id="po-supplier-form"
            onSubmit={(e) => {
              e.preventDefault()
              void handleAddVendor()
            }}
            className="space-y-4"
          >
            {vendorError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600">
                {vendorError}
              </div>
            )}
            <VendorRegistrationForm
              form={vendorForm}
              setForm={setVendorForm}
              fieldErrors={vendorFieldErrors}
              setFieldErrors={setVendorFieldErrors}
              factorySlot={
                <div>
                  <label htmlFor="po-supplier-factory" className="mb-1 block text-xs text-muted">
                    Factory *
                  </label>
                  <select
                    id="po-supplier-factory"
                    className="input-field"
                    value={vendorFactoryId}
                    onChange={(e) => setVendorFactoryId(e.target.value)}
                    required
                  >
                    <option value="">Select factory</option>
                    {(managementFactories.length > 0
                      ? managementFactories
                      : factory
                        ? [factory]
                        : []
                    ).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              }
            />
          </form>
        </MgmtDrawer>
      )}

      {showReview && poDoc && (
        <MgmtDrawer
          layer="nested"
          title="Review purchase order"
          onClose={() => setShowReview(false)}
          size="lg"
          padded={false}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="btn h-11 justify-center border border-border bg-panel text-primary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void downloadProcurementPo(poDoc)}
                className="btn h-11 justify-center border border-border bg-panel text-primary"
              >
                Download PDF
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowReview(false)
                  void handleGenerate()
                }}
                className={`btn h-11 justify-center ${accentSolid}`}
              >
                {saving ? 'Generating…' : 'Confirm'}
              </button>
            </>
          }
        >
          <div className="p-3 md:p-4">
            <ScaledPoPreview data={poDoc} />
          </div>
        </MgmtDrawer>
      )}
    </>
  )
}

function ScaledPoPreview({ data }: { data: PoDocumentData }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, height: 0 })

  useEffect(() => {
    const host = hostRef.current
    const page = pageRef.current
    if (!host || !page) return

    const update = () => {
      const natural = 720
      const scale = Math.min(1, host.clientWidth / natural)
      setFit({ scale, height: page.scrollHeight * scale })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    ro.observe(page)
    return () => ro.disconnect()
  }, [data])

  return (
    <div ref={hostRef} className="w-full overflow-x-hidden">
      <div className="relative" style={{ height: fit.height || undefined }}>
        <div
          ref={pageRef}
          className="w-[720px] origin-top-left"
          style={{ transform: `scale(${fit.scale})` }}
        >
          <ProcurementPoDocument data={data} />
        </div>
      </div>
    </div>
  )
}

export default function GeneratePoFromRequestPage() {
  const { id } = useParams<{ id: string }>()
  return <GeneratePoForm requestId={id || 'new'} />
}
