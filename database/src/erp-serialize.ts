import { decryptMoney } from './field-crypto'
import { effectiveUsageReason, parseStockKind, resolveStockKind } from './inventory-views'

function dec(v: { toString(): string } | string | number | null | undefined): number | null {
  return decryptMoney(v)
}

function dateStr(v: Date | null | undefined): string | null {
  if (v == null) return null
  return v.toISOString().slice(0, 10)
}

function ts(v: Date | null | undefined): string | null {
  if (v == null) return null
  return v.toISOString()
}

export function serializeProfile(p: {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  role: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: p.id,
    full_name: p.fullName,
    email: p.email,
    phone: p.phone,
    role: p.role,
    is_active: p.isActive,
    created_at: ts(p.createdAt),
    updated_at: ts(p.updatedAt),
  }
}

export function serializeFactory(f: {
  id: string
  name: string
  location: string | null
  materials: unknown
  companyAddress?: string | null
  panNumber?: string | null
  gstNumber?: string | null
  gstRange?: string | null
  gstDivision?: string | null
  commissionerate?: string | null
  email?: string | null
  isActive: boolean
  createdAt: Date
}) {
  return {
    id: f.id,
    name: f.name,
    location: f.location,
    materials: f.materials,
    company_address: f.companyAddress ?? null,
    pan_number: f.panNumber ?? null,
    gst_number: f.gstNumber ?? null,
    gst_range: f.gstRange ?? null,
    gst_division: f.gstDivision ?? null,
    commissionerate: f.commissionerate ?? null,
    email: f.email ?? null,
    is_active: f.isActive,
    created_at: ts(f.createdAt),
  }
}

export function serializeStockEntry(e: {
  id: string
  factoryId: string
  invoiceNumber: string
  supplierName: string
  materialType: string
  tonsLoaded: Decimal
  ratePerTon: string
  vehicleNumber: string | null
  driverName: string | null
  entryDate: Date
  notes: string | null
  stockKind?: string
  stockGrade?: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    invoice_number: e.invoiceNumber,
    supplier_name: e.supplierName,
    material_type: e.materialType,
    tons_loaded: dec(e.tonsLoaded),
    rate_per_ton: dec(e.ratePerTon),
    total_value: dec(e.tonsLoaded) != null && dec(e.ratePerTon) != null
      ? (dec(e.tonsLoaded)! * dec(e.ratePerTon)!)
      : null,
    vehicle_number: e.vehicleNumber,
    driver_name: e.driverName,
    entry_date: dateStr(e.entryDate),
    notes: e.notes,
    stock_kind: resolveStockKind(e.stockKind, e.invoiceNumber),
    stock_grade: e.stockGrade || 'approved',
    created_by: e.createdBy,
    created_at: ts(e.createdAt),
    updated_at: ts(e.updatedAt),
  }
}

export function serializeProcurementMaterialRequest(e: {
  id: string
  factoryId: string
  materialType: string
  qty: Decimal
  unit: string
  neededByDate: Date
  notes: string | null
  status: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    material_type: e.materialType,
    qty: dec(e.qty),
    unit: e.unit,
    needed_by_date: dateStr(e.neededByDate),
    notes: e.notes,
    status: e.status,
    created_by: e.createdBy,
    created_at: ts(e.createdAt),
    updated_at: ts(e.updatedAt),
  }
}

export function serializeWarehouseIssueRequest(e: {
  id: string
  factoryId: string
  materialType: string
  qty: Decimal
  unit: string
  neededByDate: Date | null
  notes: string | null
  stockKind?: string
  stockGrade?: string
  status: string
  qtyReleased: Decimal
  createdBy: string | null
  releasedBy: string | null
  releasedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    material_type: e.materialType,
    qty: dec(e.qty),
    unit: e.unit,
    needed_by_date: e.neededByDate ? dateStr(e.neededByDate) : null,
    notes: e.notes,
    stock_kind: e.stockKind || 'rm',
    stock_grade: e.stockGrade || 'approved',
    status: e.status,
    qty_released: dec(e.qtyReleased),
    created_by: e.createdBy,
    released_by: e.releasedBy,
    released_at: e.releasedAt ? ts(e.releasedAt) : null,
    created_at: ts(e.createdAt),
    updated_at: ts(e.updatedAt),
  }
}

export function serializeWarehouseIssueRelease(e: {
  id: string
  requestId: string
  invoiceNumber: string
  qty: Decimal
  usageEntryId: string | null
  releasedBy: string | null
  releasedAt: Date
}) {
  return {
    id: e.id,
    request_id: e.requestId,
    invoice_number: e.invoiceNumber,
    qty: dec(e.qty),
    usage_entry_id: e.usageEntryId,
    released_by: e.releasedBy,
    released_at: ts(e.releasedAt),
  }
}

export function serializeProcurementPo(e: {
  id: string
  factoryId: string
  requestId?: string | null
  poNumber: string
  supplierId: string | null
  supplierName: string
  materialType: string
  qty: Decimal
  unit: string
  pricePerUnit?: Decimal | null
  hsnCode?: string | null
  lineRemarks?: string | null
  status: string
  poDate: Date
  deliveryDate?: Date | null
  paymentTerms?: string | null
  qualityRef?: string | null
  coaRequired?: boolean
  specialInstructions?: string | null
  billTo?: string | null
  shipTo?: string | null
  vendorEmail?: string | null
  cgstRate?: Decimal | null
  sgstRate?: Decimal | null
  sharedWith?: string[] | null
  sharedAt?: Date | null
  notes: string | null
  lines?: unknown
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    request_id: e.requestId ?? null,
    po_number: e.poNumber,
    supplier_id: e.supplierId,
    supplier_name: e.supplierName,
    material_type: e.materialType,
    qty: dec(e.qty),
    unit: e.unit,
    price_per_unit: e.pricePerUnit != null ? dec(e.pricePerUnit) : null,
    hsn_code: e.hsnCode ?? null,
    line_remarks: e.lineRemarks ?? null,
    status: e.status,
    po_date: dateStr(e.poDate),
    delivery_date: dateStr(e.deliveryDate ?? null),
    payment_terms: e.paymentTerms ?? null,
    quality_ref: e.qualityRef ?? null,
    coa_required: e.coaRequired ?? true,
    special_instructions: e.specialInstructions ?? null,
    bill_to: e.billTo ?? null,
    ship_to: e.shipTo ?? null,
    vendor_email: e.vendorEmail ?? null,
    cgst_rate: e.cgstRate != null ? dec(e.cgstRate) : 9,
    sgst_rate: e.sgstRate != null ? dec(e.sgstRate) : 9,
    shared_with: e.sharedWith ?? [],
    shared_at: ts(e.sharedAt ?? null),
    notes: e.notes,
    lines: Array.isArray(e.lines) ? e.lines : [],
    created_by: e.createdBy,
    created_at: ts(e.createdAt),
    updated_at: ts(e.updatedAt),
  }
}

export function serializeProcurementReceipt(e: {
  id: string
  factoryId: string
  poId: string
  receiptNumber: string
  materialType: string
  unit: string
  orderedQty: Decimal
  poPricePerUnit?: Decimal | null
  receivedQty: Decimal
  receivedPricePerUnit: Decimal
  vendorName: string
  supplierInvoiceNo?: string | null
  vehicleNumber?: string | null
  receivedDate: Date
  notes?: string | null
  status: string
  qcNotes?: string | null
  qcBy?: string | null
  qcAt?: Date | null
  acceptedPricePerUnit?: Decimal | null
  debitNoteRef?: string | null
  returnDate?: Date | null
  returnVehicleNumber?: string | null
  returnNotes?: string | null
  returnedBy?: string | null
  returnedAt?: Date | null
  stockEntryId?: string | null
  stickerPrintedAt?: Date | null
  stickerPrintedBy?: string | null
  stickerData?: unknown
  createdBy?: string | null
  createdAt: Date
  updatedAt: Date
  po?: { poNumber?: string } | null
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    po_id: e.poId,
    po_number: e.po?.poNumber ?? null,
    receipt_number: e.receiptNumber,
    material_type: e.materialType,
    unit: e.unit,
    ordered_qty: dec(e.orderedQty),
    po_price_per_unit: e.poPricePerUnit != null ? dec(e.poPricePerUnit) : null,
    received_qty: dec(e.receivedQty),
    received_price_per_unit: dec(e.receivedPricePerUnit),
    vendor_name: e.vendorName,
    supplier_invoice_no: e.supplierInvoiceNo ?? null,
    vehicle_number: e.vehicleNumber ?? null,
    received_date: dateStr(e.receivedDate),
    notes: e.notes ?? null,
    status: e.status,
    qc_notes: e.qcNotes ?? null,
    qc_by: e.qcBy ?? null,
    qc_at: ts(e.qcAt ?? null),
    accepted_price_per_unit:
      e.acceptedPricePerUnit != null ? dec(e.acceptedPricePerUnit) : null,
    debit_note_ref: e.debitNoteRef ?? null,
    return_date: dateStr(e.returnDate ?? null),
    return_vehicle_number: e.returnVehicleNumber ?? null,
    return_notes: e.returnNotes ?? null,
    returned_by: e.returnedBy ?? null,
    returned_at: ts(e.returnedAt ?? null),
    stock_entry_id: e.stockEntryId ?? null,
    sticker_printed_at: ts(e.stickerPrintedAt ?? null),
    sticker_printed_by: e.stickerPrintedBy ?? null,
    sticker_data: e.stickerData ?? null,
    created_by: e.createdBy ?? null,
    created_at: ts(e.createdAt),
    updated_at: ts(e.updatedAt),
  }
}

export function serializeUsageEntry(e: {
  id: string
  factoryId: string
  invoiceNumber: string
  tonsUsed: Decimal
  processId: string | null
  batchNotes: string | null
  shift: string | null
  usageDate: Date
  batchMonth: string | null
  batchId: string | null
  stockKind?: string | null
  usageReason?: string | null
  createdBy: string | null
  createdAt: Date
}) {
  const stock_kind = parseStockKind(e.stockKind)
  return {
    id: e.id,
    factory_id: e.factoryId,
    invoice_number: e.invoiceNumber,
    tons_used: dec(e.tonsUsed),
    process_id: e.processId,
    batch_notes: e.batchNotes,
    shift: e.shift,
    usage_date: dateStr(e.usageDate),
    batch_month: e.batchMonth,
    batch_id: e.batchId,
    stock_kind,
    usage_reason: effectiveUsageReason({
      usageReason: e.usageReason,
      processId: e.processId,
      batchNotes: e.batchNotes,
      stockKind: stock_kind,
      invoiceNumber: e.invoiceNumber,
    }),
    created_by: e.createdBy,
    created_at: ts(e.createdAt),
  }
}

export function serializeSupplier(s: {
  id: string
  factoryId: string
  name: string
  companyAddress?: string | null
  gstNumber?: string | null
  zipcode?: string | null
  email?: string | null
  contactTitle?: string | null
  contactName?: string | null
  contactPhone?: string | null
  productSupplied?: string | null
  telFaxNo?: string | null
  residenceNo?: string | null
  bankName?: string | null
  bankBranch?: string | null
  accountType?: string | null
  accountNo?: string | null
  ifscCode?: string | null
  micrCode?: string | null
  sisterConcerns?: string | null
  referenceNote?: string | null
  capabilityNotes?: string | null
  employeeStrength?: string | null
  siteBranchCount?: string | null
  associatedWithFirm?: boolean | null
  associatedYears?: string | null
  speciality?: string | null
  inspectionObjection?: boolean | null
  inspectionObjectionDetails?: string | null
  recommended?: boolean | null
  approvalReason?: string | null
  approverName?: string | null
  approverDesignation?: string | null
  approvedAt?: Date | null
  isActive: boolean
  createdAt?: Date | null
}) {
  return {
    id: s.id,
    factory_id: s.factoryId,
    name: s.name,
    company_address: s.companyAddress ?? null,
    gst_number: s.gstNumber ?? null,
    zipcode: s.zipcode ?? null,
    email: s.email ?? null,
    contact_title: s.contactTitle ?? null,
    contact_name: s.contactName ?? null,
    contact_phone: s.contactPhone ?? null,
    product_supplied: s.productSupplied ?? null,
    tel_fax_no: s.telFaxNo ?? null,
    residence_no: s.residenceNo ?? null,
    bank_name: s.bankName ?? null,
    bank_branch: s.bankBranch ?? null,
    account_type: s.accountType ?? null,
    account_no: s.accountNo ?? null,
    ifsc_code: s.ifscCode ?? null,
    micr_code: s.micrCode ?? null,
    sister_concerns: s.sisterConcerns ?? null,
    reference_note: s.referenceNote ?? null,
    capability_notes: s.capabilityNotes ?? null,
    employee_strength: s.employeeStrength ?? null,
    site_branch_count: s.siteBranchCount ?? null,
    associated_with_firm: s.associatedWithFirm ?? null,
    associated_years: s.associatedYears ?? null,
    speciality: s.speciality ?? null,
    inspection_objection: s.inspectionObjection ?? null,
    inspection_objection_details: s.inspectionObjectionDetails ?? null,
    recommended: s.recommended ?? null,
    approval_reason: s.approvalReason ?? null,
    approver_name: s.approverName ?? null,
    approver_designation: s.approverDesignation ?? null,
    approved_at: s.approvedAt ? dateStr(s.approvedAt) : null,
    is_active: s.isActive,
    created_at: s.createdAt ? ts(s.createdAt) : null,
  }
}

export function serializePermissionOverride(o: {
  id: string
  profileId: string
  feature: string
  isAllowed: boolean
  expiresAt: Date | null
  createdBy: string | null
  createdAt: Date
}) {
  return {
    id: o.id,
    profile_id: o.profileId,
    feature: o.feature,
    is_allowed: o.isAllowed,
    expires_at: o.expiresAt ? ts(o.expiresAt) : null,
    created_by: o.createdBy,
    created_at: ts(o.createdAt),
  }
}

export function serializeInoutProduct(p: {
  id: string
  factoryId: string
  kind: string
  name: string
  isActive: boolean
  createdBy: string | null
}) {
  return {
    id: p.id,
    factory_id: p.factoryId,
    kind: p.kind,
    name: p.name,
    is_active: p.isActive,
    created_by: p.createdBy,
  }
}

export function serializeInwardEntry(e: {
  id: string
  factoryId: string
  productId: string
  productName: string | null
  entryDate: Date
  tons: Decimal
  createdBy: string
  updatedAt: Date
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    product_id: e.productId,
    product_name: e.productName,
    entry_date: dateStr(e.entryDate),
    tons: dec(e.tons),
    created_by: e.createdBy,
    updated_at: ts(e.updatedAt),
  }
}

export function serializeOutwardEntry(e: {
  id: string
  factoryId: string
  productId: string
  productName: string | null
  entryDate: Date
  batchNo: string
  noOfBags: number
  asIs: Decimal
  purity: Decimal
  real: Decimal
  createdBy: string
  updatedAt: Date
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    product_id: e.productId,
    product_name: e.productName,
    entry_date: dateStr(e.entryDate),
    batch_no: e.batchNo,
    no_of_bags: e.noOfBags,
    as_is: dec(e.asIs),
    purity: dec(e.purity),
    real: dec(e.real),
    created_by: e.createdBy,
    updated_at: ts(e.updatedAt),
  }
}

export function serializeMonthlyMaterial(e: {
  id: string
  factoryId: string
  batchId: string
  month: number
  fiscalYear: string
  oleum23: Decimal | null
  asIsKg: Decimal | null
  purityNv: Decimal | null
  freeAcidity: Decimal | null
  actualRealKg: Decimal | null
  usedPnt: Decimal | null
  yieldPct: Decimal | null
  createdBy: string
  updatedAt: Date
}) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    batch_id: e.batchId,
    month: e.month,
    fiscal_year: e.fiscalYear,
    oleum_23: dec(e.oleum23),
    as_is_kg: dec(e.asIsKg),
    purity_nv: dec(e.purityNv),
    free_acidity: dec(e.freeAcidity),
    actual_real_kg: dec(e.actualRealKg),
    used_pnt: dec(e.usedPnt),
    yield_pct: dec(e.yieldPct),
    created_by: e.createdBy,
    updated_at: ts(e.updatedAt),
  }
}

export function serializeSalesEntry(e: {
  id: string
  fiscalYear: string
  month: number
  factoryId: string
  turnover: string | null
  pntosa: string | null
  hydrazone: string | null
  notes: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  lines?: Array<{
    id: string
    salesEntryId: string
    productName: string
    priceRupees: string | null
    quantityKg: Decimal | null
  }>
}) {
  return {
    id: e.id,
    fiscal_year: e.fiscalYear,
    month: e.month,
    factory_id: e.factoryId,
    turnover: dec(e.turnover),
    pntosa: dec(e.pntosa),
    hydrazone: dec(e.hydrazone),
    notes: e.notes,
    created_by: e.createdBy,
    created_at: ts(e.createdAt),
    updated_at: ts(e.updatedAt),
    sales_entry_lines: (e.lines ?? []).map((l) => ({
      id: l.id,
      sales_entry_id: l.salesEntryId,
      product_name: l.productName,
      price_rupees: dec(l.priceRupees),
      quantity_kg: dec(l.quantityKg),
    })),
  }
}

function dateOnly(d: Date | null | undefined): string | null {
  if (!d) return null
  return new Date(d).toISOString().slice(0, 10)
}

export function serializeProductionProductRm(r: {
  id: string
  productId: string
  materialName: string
  unit: string
  sortOrder: number
  allowMultiLot: boolean
  lotRequired: boolean
  maxLots: number
  stockKind?: string | null
  process?: string | null
}) {
  return {
    id: r.id,
    product_id: r.productId,
    material_name: r.materialName,
    unit: r.unit,
    sort_order: r.sortOrder,
    allow_multi_lot: r.allowMultiLot,
    lot_required: r.lotRequired,
    max_lots: r.maxLots,
    stock_kind: r.stockKind === 'sfg' ? 'sfg' : 'rm',
    process: r.process === 'fg' ? 'fg' : 'sfg',
    recipe_process: r.process === 'fg' ? 'fg' : 'sfg',
  }
}

export function serializeProductionProcessStage(s: {
  id: string
  productId: string
  name: string
  sortOrder: number
  captureStartDate: boolean
  captureEndDate: boolean
  captureStartTime: boolean
  captureEndTime: boolean
  captureStartTemp: boolean
  captureEndTemp: boolean
  captureIntegrity?: boolean
  process?: string | null
  lotRmDefId?: string | null
}) {
  return {
    id: s.id,
    product_id: s.productId,
    name: s.name,
    sort_order: s.sortOrder,
    capture_start_date: s.captureStartDate,
    capture_end_date: s.captureEndDate,
    capture_start_time: s.captureStartTime,
    capture_end_time: s.captureEndTime,
    capture_start_temp: s.captureStartTemp,
    capture_end_temp: s.captureEndTemp,
    capture_integrity: Boolean(s.captureIntegrity),
    process: s.process === 'fg' ? 'fg' : 'sfg',
    recipe_process: s.process === 'fg' ? 'fg' : 'sfg',
    lot_rm_def_id: s.lotRmDefId ?? null,
  }
}

export function serializeProductionOutputField(o: {
  id: string
  productId: string
  name: string
  sortOrder: number
  isComputed: boolean
  sumOf?: unknown
  requiresQc?: boolean
  isByproduct?: boolean
  process?: string | null
}) {
  const sumOf = Array.isArray(o.sumOf)
    ? o.sumOf.map((n) => String(n).trim()).filter(Boolean)
    : []
  return {
    id: o.id,
    product_id: o.productId,
    name: o.name,
    sort_order: o.sortOrder,
    is_computed: o.isComputed,
    sum_of: sumOf,
    requires_qc: o.requiresQc !== false,
    is_byproduct: Boolean(o.isByproduct),
    process: o.process === 'fg' ? 'fg' : 'sfg',
    recipe_process: o.process === 'fg' ? 'fg' : 'sfg',
  }
}

export function serializeProductionProduct(p: {
  id: string
  factoryId: string
  code: string
  name: string
  casNumber?: string | null
  coaDescriptionSpec?: string | null
  coaIdentificationSpec?: string | null
  coaSpecificGravitySpec?: string | null
  coaWaterSpec?: string | null
  coaBoilingPointSpec?: string | null
  coaGcPuritySpec?: string | null
  coaConclusion?: string | null
  coaStorageCondition?: string | null
  kind?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  rms?: Array<Parameters<typeof serializeProductionProductRm>[0]>
  stages?: Array<Parameters<typeof serializeProductionProcessStage>[0]>
  outputs?: Array<Parameters<typeof serializeProductionOutputField>[0]>
}) {
  const rms = (p.rms ?? []).map(serializeProductionProductRm)
  const stages = (p.stages ?? []).map(serializeProductionProcessStage)
  const outputs = (p.outputs ?? []).map(serializeProductionOutputField)
  return {
    id: p.id,
    factory_id: p.factoryId,
    code: p.code,
    name: p.name,
    cas_number: p.casNumber?.trim() || null,
    coa_description_spec: p.coaDescriptionSpec?.trim() || null,
    coa_identification_spec: p.coaIdentificationSpec?.trim() || null,
    coa_specific_gravity_spec: p.coaSpecificGravitySpec?.trim() || null,
    coa_water_spec: p.coaWaterSpec?.trim() || null,
    coa_boiling_point_spec: p.coaBoilingPointSpec?.trim() || null,
    coa_gc_purity_spec: p.coaGcPuritySpec?.trim() || null,
    coa_conclusion: p.coaConclusion?.trim() || null,
    coa_storage_condition: p.coaStorageCondition?.trim() || null,
    kind: p.kind === 'fg' ? 'fg' : 'sfg',
    is_active: p.isActive,
    created_at: ts(p.createdAt),
    updated_at: ts(p.updatedAt),
    rms,
    stages,
    outputs,
    sfg_rms: rms.filter((r) => r.process !== 'fg'),
    fg_rms: rms.filter((r) => r.process === 'fg'),
    sfg_stages: stages.filter((s) => s.process !== 'fg'),
    fg_stages: stages.filter((s) => s.process === 'fg'),
    sfg_outputs: outputs.filter((o) => o.process !== 'fg'),
    fg_outputs: outputs.filter((o) => o.process === 'fg'),
  }
}

export function serializeProductionBatchRmLine(l: {
  id: string
  batchId: string
  rmDefId: string
  qty: { toString(): string } | number | string
  lotInvoice: string | null
  lotSlot: number | null
  notes: string | null
  usageEntryId: string | null
}) {
  return {
    id: l.id,
    batch_id: l.batchId,
    rm_def_id: l.rmDefId,
    qty: Number(l.qty),
    lot_invoice: l.lotInvoice,
    lot_slot: l.lotSlot,
    notes: l.notes,
    usage_entry_id: l.usageEntryId,
  }
}

function serializeWashSteps(value: unknown) {
  if (!Array.isArray(value)) return null
  const steps = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const material_name = String(row.material_name || '').trim()
    if (!material_name) return []
    const date = (v: unknown) => {
      if (v == null || v === '') return null
      if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
      const s = String(v).slice(0, 10)
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
    }
    const time = (v: unknown) => {
      if (v == null || v === '') return null
      const s = String(v)
      return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null
    }
    return [
      {
        material_name,
        start_date: date(row.start_date),
        start_time: time(row.start_time),
        end_date: date(row.end_date),
        end_time: time(row.end_time),
      },
    ]
  })
  return steps.length ? steps : null
}

export function serializeProductionBatchStageLog(l: {
  id: string
  batchId: string
  stageId: string
  lotSlot?: number | null
  startDate: Date | null
  endDate: Date | null
  startTime: string | null
  endTime: string | null
  startTemp: { toString(): string } | number | string | null
  endTemp: { toString(): string } | number | string | null
  integrityOk?: boolean | null
  washSteps?: unknown
}) {
  return {
    id: l.id,
    batch_id: l.batchId,
    stage_id: l.stageId,
    lot_slot: l.lotSlot ?? 1,
    start_date: dateOnly(l.startDate),
    end_date: dateOnly(l.endDate),
    start_time: l.startTime,
    end_time: l.endTime,
    start_temp: l.startTemp == null ? null : Number(l.startTemp),
    end_temp: l.endTemp == null ? null : Number(l.endTemp),
    integrity_ok: l.integrityOk == null ? null : Boolean(l.integrityOk),
    wash_steps: serializeWashSteps(l.washSteps),
  }
}

export function serializeProductionBatchOutput(o: {
  id: string
  batchId: string
  outputFieldId: string
  qty: { toString(): string } | number | string
}) {
  return {
    id: o.id,
    batch_id: o.batchId,
    output_field_id: o.outputFieldId,
    qty: Number(o.qty),
  }
}

export function serializeProductionBatch(b: {
  id: string
  factoryId: string
  productId: string
  batchNo: string
  kind?: string
  vessel: string | null
  mfgDate?: Date | null
  purity?: { toString(): string } | number | string | null
  status: string
  qcStatus?: string
  qcSentAt?: Date | null
  qcSentBy?: string | null
  qcSnapshot?: unknown
  stickerPrintedAt?: Date | null
  stickerPrintedBy?: string | null
  stickerData?: unknown
  createdBy: string | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  product?: { code: string; name: string }
  creator?: { fullName: string } | null
  rmLines?: Array<Parameters<typeof serializeProductionBatchRmLine>[0]>
  stageLogs?: Array<Parameters<typeof serializeProductionBatchStageLog>[0]>
  outputs?: Array<Parameters<typeof serializeProductionBatchOutput>[0]>
}) {
  return {
    id: b.id,
    factory_id: b.factoryId,
    product_id: b.productId,
    batch_no: b.batchNo,
    kind: b.kind === 'fg' ? 'fg' : 'sfg',
    vessel: b.vessel,
    mfg_date: dateOnly(b.mfgDate ?? null),
    purity: b.purity == null || b.purity === '' ? null : Number(b.purity),
    status: b.status,
    qc_status: b.qcStatus ?? 'none',
    qc_sent_at: b.qcSentAt ? ts(b.qcSentAt) : null,
    qc_sent_by: b.qcSentBy ?? null,
    qc_snapshot: b.qcSnapshot ?? null,
    sticker_printed_at: b.stickerPrintedAt ? ts(b.stickerPrintedAt) : null,
    sticker_printed_by: b.stickerPrintedBy ?? null,
    sticker_data: b.stickerData ?? null,
    created_by: b.createdBy,
    completed_at: b.completedAt ? ts(b.completedAt) : null,
    created_at: ts(b.createdAt),
    updated_at: ts(b.updatedAt),
    product_code: b.product?.code ?? null,
    product_name: b.product?.name ?? null,
    created_by_name: b.creator?.fullName ?? null,
    rm_lines: (b.rmLines ?? []).map(serializeProductionBatchRmLine),
    stage_logs: (b.stageLogs ?? []).map(serializeProductionBatchStageLog),
    outputs: (b.outputs ?? []).map(serializeProductionBatchOutput),
  }
}

export function serializeCustomer(c: {
  id: string
  factoryId: string
  name: string
  companyAddress?: string | null
  gstNumber?: string | null
  email?: string | null
  contactTitle?: string | null
  contactName?: string | null
  contactPhone?: string | null
  isActive: boolean
  createdAt?: Date
  factory?: { name: string }
}) {
  return {
    id: c.id,
    factory_id: c.factoryId,
    name: c.name,
    company_address: c.companyAddress ?? null,
    gst_number: c.gstNumber ?? null,
    email: c.email ?? null,
    contact_title: c.contactTitle ?? null,
    contact_name: c.contactName ?? null,
    contact_phone: c.contactPhone ?? null,
    is_active: c.isActive,
    created_at: c.createdAt ? ts(c.createdAt) : null,
    factories: c.factory ? { name: c.factory.name } : undefined,
  }
}

function preferredBatches(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v).trim()).filter(Boolean)
}

export function serializeDispatchScheduleLot(l: {
  id: string
  saleId: string
  invoiceNumber: string
  qty: { toString(): string } | number | string
  usageEntryId?: string | null
  coaNo?: string | null
  coaIssuedAt?: Date | null
  coaIssuedBy?: string | null
  coaIssuer?: { fullName: string } | null
  signedCoa?: {
    fileName: string
    uploadedAt: Date
    uploader?: { fullName: string } | null
  } | null
}) {
  return {
    id: l.id,
    sale_id: l.saleId,
    invoice_number: l.invoiceNumber,
    qty: Number(l.qty),
    usage_entry_id: l.usageEntryId ?? null,
    coa_no: l.coaNo ?? null,
    coa_issued_at: l.coaIssuedAt ? ts(l.coaIssuedAt) : null,
    coa_issued_by: l.coaIssuedBy ?? null,
    coa_issued_by_name: l.coaIssuer?.fullName ?? null,
    signed_coa_file_name: l.signedCoa?.fileName ?? null,
    signed_coa_uploaded_at: l.signedCoa?.uploadedAt ? ts(l.signedCoa.uploadedAt) : null,
    signed_coa_uploaded_by_name: l.signedCoa?.uploader?.fullName ?? null,
  }
}

export function serializeDispatchSchedule(s: {
  id: string
  factoryId: string
  saleNo: string
  customerId: string
  productId?: string | null
  productCode: string
  productName: string
  qty: { toString(): string } | number | string
  unit: string
  rate: { toString(): string } | number | string
  isDiscounted?: boolean
  puritySpec?: { toString(): string } | number | string | null
  clientPoNo?: string | null
  preferredBatchNos?: unknown
  scheduleKind?: string | null
  status: string
  tallyInvoiceNo?: string | null
  vehicleNo?: string | null
  drumCount?: number | null
  coaNo?: string | null
  coaIssuedAt?: Date | null
  coaIssuedBy?: string | null
  createdBy?: string | null
  invoicedBy?: string | null
  invoicedAt?: Date | null
  pickedBy?: string | null
  pickedAt?: Date | null
  dispatchedBy?: string | null
  dispatchedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  customer?: { name: string; gstNumber?: string | null; companyAddress?: string | null }
  creator?: { fullName: string } | null
  invoicer?: { fullName: string } | null
  picker?: { fullName: string } | null
  coaIssuer?: { fullName: string } | null
  dispatcher?: { fullName: string } | null
  lots?: Array<Parameters<typeof serializeDispatchScheduleLot>[0]>
}) {
  return {
    id: s.id,
    factory_id: s.factoryId,
    sale_no: s.saleNo,
    customer_id: s.customerId,
    customer_name: s.customer?.name ?? null,
    customer_gst: s.customer?.gstNumber ?? null,
    customer_address: s.customer?.companyAddress ?? null,
    product_id: s.productId ?? null,
    product_code: s.productCode,
    product_name: s.productName,
    qty: Number(s.qty),
    unit: s.unit,
    rate: Number(s.rate),
    is_discounted: Boolean(s.isDiscounted),
    purity_spec: s.puritySpec == null || s.puritySpec === '' ? null : Number(s.puritySpec),
    client_po_no: s.clientPoNo ?? null,
    preferred_batch_nos: preferredBatches(s.preferredBatchNos),
    schedule_kind: s.scheduleKind === 'byproduct' ? 'byproduct' : 'fg',
    status: s.status,
    tally_invoice_no: s.tallyInvoiceNo ?? null,
    vehicle_no: s.vehicleNo ?? null,
    drum_count: s.drumCount ?? null,
    coa_no: s.coaNo ?? null,
    coa_issued_at: s.coaIssuedAt ? ts(s.coaIssuedAt) : null,
    coa_issued_by: s.coaIssuedBy ?? null,
    created_by: s.createdBy ?? null,
    created_by_name: s.creator?.fullName ?? null,
    invoiced_by: s.invoicedBy ?? null,
    invoiced_by_name: s.invoicer?.fullName ?? null,
    invoiced_at: s.invoicedAt ? ts(s.invoicedAt) : null,
    picked_by: s.pickedBy ?? null,
    picked_by_name: s.picker?.fullName ?? null,
    picked_at: s.pickedAt ? ts(s.pickedAt) : null,
    dispatched_by: s.dispatchedBy ?? null,
    dispatched_by_name: s.dispatcher?.fullName ?? null,
    dispatched_at: s.dispatchedAt ? ts(s.dispatchedAt) : null,
    coa_issued_by_name: s.coaIssuer?.fullName ?? null,
    created_at: ts(s.createdAt),
    updated_at: ts(s.updatedAt),
    lots: (s.lots ?? []).map(serializeDispatchScheduleLot),
  }
}

export type EmployeeRow = {
  id: string
  factoryId: string
  profileId: string | null
  employeeCode: string
  fullName: string
  fatherName: string | null
  gender: string | null
  dateOfBirth: Date | null
  department: string
  designation: string
  employmentType: string
  employmentStatus: string
  joiningDate: Date
  leavingDate: Date | null
  phone: string | null
  email: string | null
  currentAddress: string | null
  permanentAddress: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
  bloodGroup: string | null
  pan: string | null
  aadhaar: string | null
  uan: string | null
  pfNumber: string | null
  esiNumber: string | null
  bankName: string | null
  accountHolderName: string | null
  accountNumber: string | null
  ifsc: string | null
  monthlyGross: string | null
  annualCtc: string | null
  basicPay: string | null
  pfEligible: boolean
  esiEligible: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  factory?: { name: string }
  profile?: { id: string; fullName: string; email: string | null; role: string } | null
  _count?: { documents: number }
}

function employeeBase(e: EmployeeRow) {
  return {
    id: e.id,
    factory_id: e.factoryId,
    factory_name: e.factory?.name ?? null,
    profile_id: e.profileId,
    profile_name: e.profile?.fullName ?? null,
    employee_code: e.employeeCode,
    full_name: e.fullName,
    father_name: e.fatherName,
    gender: e.gender,
    date_of_birth: dateStr(e.dateOfBirth),
    department: e.department,
    designation: e.designation,
    employment_type: e.employmentType,
    employment_status: e.employmentStatus,
    joining_date: dateStr(e.joiningDate),
    leaving_date: dateStr(e.leavingDate),
    phone: e.phone,
    email: e.email,
    current_address: e.currentAddress,
    permanent_address: e.permanentAddress,
    emergency_contact_name: e.emergencyContactName,
    emergency_contact_phone: e.emergencyContactPhone,
    emergency_contact_relation: e.emergencyContactRelation,
    blood_group: e.bloodGroup,
    pan: e.pan,
    uan: e.uan,
    pf_number: e.pfNumber,
    esi_number: e.esiNumber,
    bank_name: e.bankName,
    account_holder_name: e.accountHolderName,
    pf_eligible: e.pfEligible,
    esi_eligible: e.esiEligible,
    is_active: e.isActive,
    document_count: e._count?.documents ?? null,
    created_at: ts(e.createdAt),
    updated_at: ts(e.updatedAt),
  }
}

/** List payload: omit Aadhaar, account number, IFSC, and salary. */
export function serializeEmployeeList(e: EmployeeRow) {
  return employeeBase(e)
}

export function serializeEmployeeDetail(e: EmployeeRow) {
  return {
    ...employeeBase(e),
    aadhaar: e.aadhaar,
    account_number: e.accountNumber,
    ifsc: e.ifsc,
    monthly_gross: dec(e.monthlyGross),
    annual_ctc: dec(e.annualCtc),
    basic_pay: dec(e.basicPay),
  }
}

export function serializeEmployeeDocument(d: {
  id: string
  employeeId: string
  docType: string
  title: string | null
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string | null
  createdAt: Date
}) {
  return {
    id: d.id,
    employee_id: d.employeeId,
    doc_type: d.docType,
    title: d.title,
    file_name: d.fileName,
    mime_type: d.mimeType,
    size_bytes: d.sizeBytes,
    uploaded_by: d.uploadedBy,
    created_at: ts(d.createdAt),
  }
}
