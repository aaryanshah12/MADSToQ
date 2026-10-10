'use client'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { factoriesApi, usersApi, numberingApi, customersApi } from '@/lib/api'
import { inventoryApi } from '@/lib/client/inventory-api'
import { Factory, Profile, PermissionOverride } from '@/types'
import clsx from 'clsx'
import {
  Plus, Pencil, ToggleLeft, ToggleRight,
  Factory as FactoryIcon, MapPin, CheckCircle, Users,
  UserCheck, UserX, Trash2, Package, Building2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/providers/ToastProvider'
import { EmptyState, SpinnerBlock, useConfirm, useSmartFilter } from '@/components/ui'
import { MobileCard, MobileListToolbar, MobileTabs } from '@/components/inventory/MobileList'
import { isValidGstin, normalizeGstin, isValidPan, normalizePan } from '@madstoq/shared-utils'
import ProductionTemplatesPanel from '@/components/inventory/ProductionTemplatesPanel'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import RawMaterialsPanel from '@/components/inventory/RawMaterialsPanel'
import EmployeesPanel from '@/components/inventory/EmployeesPanel'
import VendorRegistrationForm from '@/components/inventory/VendorRegistrationForm'
import {
  emptyVendorForm,
  toCreateSupplierInput,
  validateVendorForm,
  type VendorFieldErrors,
  type VendorFormValues,
} from '@/lib/vendor-registration'

// ─── Constants ──────────────────────────────────────────────────────────────
const FEATURES = [
  { key: 'view_stock_balance',   label: 'View Stock Balance',   roles: ['inputer', 'chemist'] },
  { key: 'edit_past_entries',    label: 'Edit Past Entries',    roles: ['inputer'] },
  { key: 'view_invoice_details', label: 'View Invoice Details', roles: ['inputer'] },
  { key: 'export_data',          label: 'Export Data',          roles: ['inputer', 'chemist'] },
  { key: 'view_all_factories',   label: 'View All Factories',   roles: ['inputer', 'chemist'] },
]

const EMPTY_NEW_USER = {
  full_name: '', email: '', phone: '', role: 'inputer', password: '', factory_ids: [] as string[],
}

type Tab = 'factories' | 'users' | 'employees' | 'suppliers' | 'customers' | 'numbering' | 'production' | 'raw_materials'
type Group = 'plant' | 'people' | 'trade' | 'recipes'

const GROUPS: Array<{ key: Group; label: string }> = [
  { key: 'plant', label: 'Plant' },
  { key: 'people', label: 'People' },
  { key: 'trade', label: 'Trade' },
  { key: 'recipes', label: 'Recipes' },
]

const GROUP_TABS: Record<Group, Array<{ key: Tab; label: string }>> = {
  plant: [
    { key: 'factories', label: 'Factories' },
    { key: 'raw_materials', label: 'Raw materials' },
    { key: 'numbering', label: 'Numbering' },
  ],
  people: [
    { key: 'users', label: 'Users' },
    { key: 'employees', label: 'Employees' },
  ],
  trade: [
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'customers', label: 'Customers' },
  ],
  recipes: [{ key: 'production', label: 'Production' }],
}

function locationCity(location: string | null | undefined) {
  if (!location?.trim()) return 'No location set'
  return location.split(',')[0]!.trim()
}

type NumberingFormRow = {
  prefix: string
  pad_width: number
  example: string
}

export default function ManagementPage() {
  const { loading: authLoading } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [activeGroup, setActiveGroup] = useState<Group>('plant')
  const [activeTab, setActiveTab] = useState<Tab>('factories')

  // ─── Shared data ─────────────────────────────────────────────────────────
  const [factories, setFactories]               = useState<Factory[]>([])
  const [profiles, setProfiles]                 = useState<Profile[]>([])
  const [factoryUsersMap, setFactoryUsersMap]   = useState<Record<string, string[]>>({})
  const [pfMap, setPfMap]                       = useState<Record<string, string[]>>({})
  const [assignedFactoryIds, setAssignedFactoryIds] = useState<string[]>([])
  const [overrides, setOverrides]               = useState<PermissionOverride[]>([])
  const [loading, setLoading]                   = useState(true)
  const [loadError, setLoadError]               = useState('')

  // ─── Factories tab state ─────────────────────────────────────────────────
  const [showFactoryForm, setShowFactoryForm]     = useState(false)
  const [editingFactoryId, setEditingFactoryId]   = useState<string | null>(null)
  const [factoryForm, setFactoryForm]             = useState({
    name: '',
    location: '',
    materials: [] as string[],
    company_address: '',
    pan_number: '',
    gst_number: '',
    gst_range: '',
    gst_division: '',
    commissionerate: '',
    email: '',
  })
  const [expandedFactory, setExpandedFactory]     = useState<string | null>(null)
  const [factorySaving, setFactorySaving]         = useState(false)
  const [assignSaving, setAssignSaving]           = useState(false)
  const [factoryError, setFactoryError]           = useState('')
  const [factoryFieldErrors, setFactoryFieldErrors] = useState<{
    pan_number?: string
    gst_number?: string
    email?: string
  }>({})

  // ─── Users tab state ─────────────────────────────────────────────────────
  const [showUserForm, setShowUserForm]   = useState(false)
  const [newUser, setNewUser]             = useState(EMPTY_NEW_USER)
  const [userSaving, setUserSaving]       = useState(false)
  const [userError, setUserError]         = useState('')
  const [editUser, setEditUser]           = useState<Profile | null>(null)
  const [editForm, setEditForm]           = useState({ full_name: '', phone: '', role: '', factory_ids: [] as string[] })
  const [editError, setEditError]         = useState('')
  const [editSaving, setEditSaving]       = useState(false)

  // ─── Permissions tab state ────────────────────────────────────────────────
  const [permSaving, setPermSaving]         = useState(false)

  // ─── Suppliers tab state ──────────────────────────────────────────────────
  const [suppliers, setSuppliers]               = useState<any[]>([])
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [supplierFactoryId, setSupplierFactoryId] = useState('')
  const [supplierForm, setSupplierForm]         = useState<VendorFormValues>(emptyVendorForm)
  const [supplierFieldErrors, setSupplierFieldErrors] = useState<VendorFieldErrors>({})
  const [supplierSaving, setSupplierSaving]     = useState(false)
  const [supplierError, setSupplierError]       = useState('')

  const [customers, setCustomers] = useState<any[]>([])
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [customerFactoryId, setCustomerFactoryId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerTitle, setCustomerTitle] = useState('')
  const [customerContactName, setCustomerContactName] = useState('')
  const [customerGst, setCustomerGst] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerError, setCustomerError] = useState('')

  // ─── Numbering tab state ──────────────────────────────────────────────────
  const [numberingFactoryId, setNumberingFactoryId] = useState('')
  const [numberingPo, setNumberingPo] = useState<NumberingFormRow>({
    prefix: 'PO',
    pad_width: 0,
    example: '',
  })
  const [numberingLot, setNumberingLot] = useState<NumberingFormRow>({
    prefix: 'RM',
    pad_width: 0,
    example: '',
  })
  const [numberingBatch, setNumberingBatch] = useState<NumberingFormRow>({
    prefix: 'BAT',
    pad_width: 0,
    example: '',
  })
  const [numberingSale, setNumberingSale] = useState<NumberingFormRow>({
    prefix: 'SL',
    pad_width: 0,
    example: '',
  })
  const [numberingCoa, setNumberingCoa] = useState<NumberingFormRow>({
    prefix: 'COA',
    pad_width: 0,
    example: '',
  })
  const [numberingLoading, setNumberingLoading] = useState(false)
  const [numberingSaving, setNumberingSaving] = useState(false)

  useEffect(() => {
    if (!authLoading) loadAll()
  }, [authLoading])

  async function loadAll() {
    setLoading(true); setLoadError('')

    const [factData, userData] = await Promise.all([
      factoriesApi.getAll(),
      usersApi.getAll(),
    ])

    if (factData.error || userData.error) {
      const msg = factData.error || userData.error
      setLoadError(msg)
      toast.error(msg)
      setLoading(false)
      return
    }

    const allFactories  = factData.factories      ?? []
    const allProfiles   = factData.profiles        ?? []
    const factUsersMap  = factData.factoryUsersMap ?? {}
    const assignedIds   = factData.assignedFactories ?? []
    const profileMap    = userData.pfMap           ?? {}

    setFactories(allFactories)
    setProfiles(allProfiles)
    setFactoryUsersMap(factUsersMap)
    setAssignedFactoryIds(assignedIds)
    setPfMap(profileMap)

    const userIds = allProfiles.filter((p: Profile) => p.role !== 'owner').map((p: Profile) => p.id)
    setNumberingFactoryId((prev) => {
      if (prev && assignedIds.includes(prev)) return prev
      return assignedIds[0] ?? allFactories[0]?.id ?? ''
    })
    setLoading(false)

    void loadExtras(userIds, assignedIds, allFactories)
  }

  async function loadExtras(userIds: string[], assignedIds: string[], allFactories: Factory[]) {
    let overrideRows: PermissionOverride[] = []
    if (userIds.length > 0) {
      const extras = await inventoryApi.getManagementExtras(userIds, assignedIds)
      overrideRows = (extras.overrides as PermissionOverride[]) ?? []
      setSuppliers(extras.suppliers ?? [])
    } else {
      setSuppliers([])
    }

    const factoryIdsForCustomers =
      assignedIds.length > 0 ? assignedIds : allFactories.map((f: Factory) => f.id)
    if (factoryIdsForCustomers.length > 0) {
      const customerLists = await Promise.all(
        factoryIdsForCustomers.map((fid: string) => customersApi.list(fid)),
      )
      setCustomers(customerLists.flatMap((r) => r.customers ?? []))
    } else {
      setCustomers([])
    }
    setOverrides(overrideRows)
  }

  function localNumberPreview(
    prefix: string,
    padWidth: number,
    format: 'slash_seq_fy' | 'seq_slash_prefix_fy' = 'slash_seq_fy',
    exampleSeq = 92,
  ) {
    const d = new Date()
    const y = d.getFullYear()
    const month = d.getMonth()
    const startYear = month >= 3 ? y : y - 1
    const fy = `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`
    const clean = prefix.replace(/\/+$/, '') || 'PO'
    const seq = padWidth > 0 ? String(exampleSeq).padStart(padWidth, '0') : String(exampleSeq)
    return format === 'seq_slash_prefix_fy'
      ? `${seq}/${clean}/${fy}`
      : `${clean}/${seq}/${fy}`
  }

  async function loadNumbering(factoryId: string) {
    if (!factoryId) return
    setNumberingLoading(true)
    const data = await numberingApi.get(factoryId)
    if (data.error) {
      toast.error(data.error)
      setNumberingLoading(false)
      return
    }
    const po = data.config?.po
    const lot = data.config?.lot
    const batch = data.config?.batch
    setNumberingPo({
      prefix: po?.prefix ?? 'PO',
      pad_width: Number(po?.pad_width ?? 0) || 0,
      example: po?.example ?? '',
    })
    setNumberingLot({
      prefix: lot?.prefix ?? 'RM',
      pad_width: Number(lot?.pad_width ?? 0) || 0,
      example: lot?.example ?? '',
    })
    setNumberingBatch({
      prefix: batch?.prefix ?? 'BAT',
      pad_width: Number(batch?.pad_width ?? 0) || 0,
      example: batch?.example ?? '',
    })
    const sale = data.config?.sale
    const coa = data.config?.coa
    setNumberingSale({
      prefix: sale?.prefix ?? 'SL',
      pad_width: Number(sale?.pad_width ?? 0) || 0,
      example: sale?.example ?? '',
    })
    setNumberingCoa({
      prefix: coa?.prefix ?? 'COA',
      pad_width: Number(coa?.pad_width ?? 0) || 0,
      example: coa?.example ?? '',
    })
    setNumberingLoading(false)
  }

  async function saveNumbering(e: React.FormEvent) {
    e.preventDefault()
    if (!numberingFactoryId) {
      toast.error('Select a factory')
      return
    }
    setNumberingSaving(true)
    const data = await numberingApi.save({
      factory_id: numberingFactoryId,
      po: { prefix: numberingPo.prefix, pad_width: numberingPo.pad_width, number_format: 'slash_seq_fy' },
      lot: { prefix: numberingLot.prefix, pad_width: numberingLot.pad_width, number_format: 'slash_seq_fy' },
      batch: {
        prefix: numberingBatch.prefix,
        pad_width: numberingBatch.pad_width,
        number_format: 'seq_slash_prefix_fy',
      },
      sale: { prefix: numberingSale.prefix, pad_width: numberingSale.pad_width, number_format: 'slash_seq_fy' },
      coa: { prefix: numberingCoa.prefix, pad_width: numberingCoa.pad_width, number_format: 'slash_seq_fy' },
    })
    setNumberingSaving(false)
    if (data.error) {
      toast.error(data.error)
      return
    }
    setNumberingPo((prev) => ({
      ...prev,
      example: data.config?.po?.example ?? prev.example,
    }))
    setNumberingLot((prev) => ({
      ...prev,
      example: data.config?.lot?.example ?? prev.example,
    }))
    setNumberingBatch((prev) => ({
      ...prev,
      example: data.config?.batch?.example ?? prev.example,
    }))
    setNumberingSale((prev) => ({
      ...prev,
      example: data.config?.sale?.example ?? prev.example,
    }))
    setNumberingCoa((prev) => ({
      ...prev,
      example: data.config?.coa?.example ?? prev.example,
    }))
    toast.success('Numbering settings saved')
  }

  useEffect(() => {
    if (activeTab === 'numbering' && numberingFactoryId) {
      void loadNumbering(numberingFactoryId)
    }
  }, [activeTab, numberingFactoryId])

  // ─── Factory helpers ──────────────────────────────────────────────────────
  function resetFactoryForm() {
    setShowFactoryForm(false); setEditingFactoryId(null)
    setFactoryForm({
      name: '',
      location: '',
      materials: [],
      company_address: '',
      pan_number: '',
      gst_number: '',
      gst_range: '',
      gst_division: '',
      commissionerate: '',
      email: '',
    })
    setFactoryError(''); setFactoryFieldErrors({})
  }

  function startEditFactory(factory: Factory) {
    setEditingFactoryId(factory.id)
    const materials = (factory.materials ?? []).map((m) =>
      typeof m === 'string' ? m : String((m as { name?: string }).name ?? ''),
    ).filter(Boolean)
    setFactoryForm({
      name: factory.name,
      location: factory.location ?? '',
      materials,
      company_address: factory.company_address ?? '',
      pan_number: factory.pan_number ?? '',
      gst_number: factory.gst_number ?? '',
      gst_range: factory.gst_range ?? '',
      gst_division: factory.gst_division ?? '',
      commissionerate: factory.commissionerate ?? '',
      email: factory.email ?? '',
    })
    setShowFactoryForm(true)
    setFactoryError('')
    setFactoryFieldErrors({})
  }

  async function handleFactorySubmit(e: React.FormEvent) {
    e.preventDefault()
    const pan = normalizePan(factoryForm.pan_number)
    const gst = normalizeGstin(factoryForm.gst_number)
    const email = factoryForm.email.trim().toLowerCase()
    const nextErrors: { pan_number?: string; gst_number?: string; email?: string } = {}

    if (!factoryForm.name.trim() ||
      !factoryForm.location.trim() ||
      !factoryForm.company_address.trim() ||
      !factoryForm.gst_range.trim() ||
      !factoryForm.gst_division.trim() ||
      !factoryForm.commissionerate.trim()
    ) {
      setFactoryError('All factory fields are required')
      return
    }

    if (!pan) {
      nextErrors.pan_number = 'PAN number is required'
    } else if (!isValidPan(pan)) {
      nextErrors.pan_number = 'Invalid PAN — format AAAAA9999A (e.g. AACFA7569G)'
    }
    if (!gst) {
      nextErrors.gst_number = 'GST number is required'
    } else if (!isValidGstin(gst)) {
      nextErrors.gst_number =
        gst.length < 15
          ? 'GSTIN must be 15 characters'
          : 'Invalid GSTIN format (e.g. 24AACFA7569G1ZG)'
    }
    if (!email) {
      nextErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address'
    }
    setFactoryFieldErrors(nextErrors)
    if (nextErrors.pan_number || nextErrors.gst_number || nextErrors.email) {
      setFactoryError('')
      return
    }

    setFactorySaving(true); setFactoryError('')
    const payload = {
      ...factoryForm,
      pan_number: pan,
      gst_number: gst,
      email,
    }
    const result = editingFactoryId
      ? await factoriesApi.update({ id: editingFactoryId, ...payload })
      : await factoriesApi.create(payload)
    if (result.error) { toast.error(result.error); setFactorySaving(false); return }
    toast.success(`Factory "${factoryForm.name}" ${editingFactoryId ? 'updated' : 'created'} successfully!`)
    await loadAll()
    resetFactoryForm()
    setFactorySaving(false)
  }

  async function toggleFactoryActive(factory: Factory) {
    await factoriesApi.update({ id: factory.id, is_active: !factory.is_active })
    setFactories(prev => prev.map(f => f.id === factory.id ? { ...f, is_active: !f.is_active } : f))
  }

  async function toggleUserAssignment(factoryId: string, profileId: string) {
    setAssignSaving(true)
    const isAssigned = (factoryUsersMap[factoryId] ?? []).includes(profileId)
    if (isAssigned) {
      await inventoryApi.toggleProfileFactory(profileId, factoryId, false)
    } else {
      await inventoryApi.toggleProfileFactory(profileId, factoryId, true)
    }
    await loadAll()
    setAssignSaving(false)
  }

  // ─── Users helpers ────────────────────────────────────────────────────────
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setUserError(''); setUserSaving(true)
    const result = await usersApi.create(newUser)
    if (result.error) { toast.error(result.error); setUserSaving(false); return }
    toast.success(`User "${newUser.full_name}" created successfully!`)
    setNewUser(EMPTY_NEW_USER); setShowUserForm(false)
    await loadAll()
    setUserSaving(false)
  }

  function openEditUser(user: Profile) {
    setEditUser(user)
    setEditForm({ full_name: user.full_name, phone: user.phone ?? '', role: user.role, factory_ids: pfMap[user.id] ?? [] })
    setEditError('')
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditError(''); setEditSaving(true)
    const result = await usersApi.update({ id: editUser.id, ...editForm })
    if (result.error) { toast.error(result.error); setEditSaving(false); return }
    toast.success(`User "${editForm.full_name}" updated successfully!`)
    setEditUser(null)
    await loadAll()
    setEditSaving(false)
  }

  async function toggleUserActive(user: Profile) {
    await usersApi.update({ id: user.id, is_active: !user.is_active })
    setProfiles(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
  }

  // ─── Permissions helpers ──────────────────────────────────────────────────
  function getOverride(userId: string, feature: string) {
    return overrides.find(o => o.profile_id === userId && o.feature === feature)
  }

  async function toggleFeature(userId: string, feature: string, currentAllowed: boolean) {
    setPermSaving(true)
    const existing = getOverride(userId, feature)
    if (existing) {
      await inventoryApi.upsertPermissionOverride({ userId, feature, existingId: existing.id, currentAllowed })
    } else {
      await inventoryApi.upsertPermissionOverride({ userId, feature })
    }
    await loadAll()
    setPermSaving(false)
  }

  // ─── Suppliers helpers ────────────────────────────────────────────────────
  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierFactoryId) {
      setSupplierError('Select a factory')
      return
    }
    const { error: vError, fieldErrors } = validateVendorForm(supplierForm)
    setSupplierFieldErrors(fieldErrors)
    if (vError) {
      setSupplierError(vError)
      return
    }
    if (fieldErrors.gst_number || fieldErrors.email || fieldErrors.contact_phone) {
      setSupplierError('')
      return
    }
    setSupplierSaving(true)
    setSupplierError('')
    try {
      await inventoryApi.createSupplier(supplierFactoryId, toCreateSupplierInput(supplierForm))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create supplier')
      setSupplierSaving(false)
      return
    }
    toast.success('Supplier added successfully!')
    setSupplierForm(emptyVendorForm)
    setSupplierFieldErrors({})
    setShowSupplierForm(false)
    setSupplierFactoryId('')
    await loadAll()
    setSupplierSaving(false)
  }

  async function handleDeleteSupplier(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete supplier?',
      body: `"${name}" will no longer be selectable on new purchase orders or receipts.`,
      confirmLabel: 'Delete supplier',
      destructive: true,
    })
    if (!ok) return
    await inventoryApi.deleteSupplier(id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
    toast.success(`Supplier "${name}" deleted.`)
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault()
    setCustomerSaving(true)
    setCustomerError('')
    const data = await customersApi.create({
      factory_id: customerFactoryId,
      name: customerName.trim(),
      company_address: customerAddress.trim(),
      email: customerEmail.trim(),
      contact_title: customerTitle.trim(),
      contact_name: customerContactName.trim(),
      gst_number: customerGst.trim() || undefined,
      contact_phone: customerPhone.trim() || undefined,
    })
    if (data.error) {
      setCustomerError(data.error)
      setCustomerSaving(false)
      return
    }
    toast.success('Customer added')
    setCustomerName('')
    setCustomerAddress('')
    setCustomerEmail('')
    setCustomerTitle('')
    setCustomerContactName('')
    setCustomerGst('')
    setCustomerPhone('')
    setShowCustomerForm(false)
    setCustomerFactoryId('')
    await loadAll()
    setCustomerSaving(false)
  }

  async function handleDeleteCustomer(id: string, name: string) {
    const ok = await confirm({
      title: 'Delete customer?',
      body: `"${name}" will no longer be selectable on new sales or dispatch records.`,
      confirmLabel: 'Delete customer',
      destructive: true,
    })
    if (!ok) return
    const data = await customersApi.remove(id)
    if (data.error) {
      toast.error(data.error)
      return
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id))
    toast.success(`Customer "${name}" deleted.`)
  }

  // ─── Shared factory checkbox component ───────────────────────────────────
  function FactoryCheckboxes({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
    if (factories.length === 0) return <p className="text-xs text-muted italic">No active factories found.</p>
    return (
      <div className="flex flex-wrap gap-2">
        {factories.map(f => {
          const checked = selected.includes(f.id)
          return (
            <button key={f.id} type="button" onClick={() => onToggle(f.id)}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
                checked ? 'bg-owner/15 text-owner border-owner/40' : 'bg-transparent text-muted border-border hover:border-white/30'
              )}
            >
              <span className={clsx('w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0', checked ? 'bg-owner border-owner' : 'border-muted')}>
                {checked && <span className="text-[8px] text-black font-bold">✓</span>}
              </span>
              {f.name}
            </button>
          )
        })}
      </div>
    )
  }

  const assignableUsers = profiles.filter(p => p.role !== 'owner' && p.is_active)

  const userFilter = useSmartFilter(profiles, {
    getSearchText: (u) => [u.full_name, u.email, u.phone, u.role],
    facets: [
      { key: 'role', label: 'Role', getValue: (u) => u.role },
      {
        key: 'status',
        label: 'Status',
        getValue: (u) => (u.is_active ? 'active' : 'inactive'),
        options: [
          { id: 'active', label: 'Active' },
          { id: 'inactive', label: 'Inactive' },
        ],
      },
    ],
  })
  const [userSortCol, setUserSortCol] = useState<'name' | 'role' | 'status'>('name')
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc')
  const visibleUsers = useMemo(() => {
    const dir = userSortDir === 'asc' ? 1 : -1
    return [...userFilter.filtered].sort((a, b) => {
      let cmp = 0
      if (userSortCol === 'role') cmp = a.role.localeCompare(b.role)
      else if (userSortCol === 'status') cmp = Number(b.is_active) - Number(a.is_active)
      else cmp = a.full_name.localeCompare(b.full_name)
      return cmp * dir || a.full_name.localeCompare(b.full_name)
    })
  }, [userFilter.filtered, userSortCol, userSortDir])

  const supplierFilter = useSmartFilter(suppliers, {
    getSearchText: (s) => [
      s.name,
      s.product_supplied,
      s.gst_number,
      s.contact_name,
      s.email,
      s.factories?.name,
    ],
    facets: [
      { key: 'factory', label: 'Factory', getValue: (s) => s.factories?.name || '—' },
      { key: 'product', label: 'Product', getValue: (s) => s.product_supplied || '—' },
    ],
  })
  const [supplierSortCol, setSupplierSortCol] = useState<'name' | 'product' | 'factory'>('name')
  const [supplierSortDir, setSupplierSortDir] = useState<'asc' | 'desc'>('asc')
  const visibleSuppliers = useMemo(() => {
    const dir = supplierSortDir === 'asc' ? 1 : -1
    return [...supplierFilter.filtered].sort((a, b) => {
      let cmp = 0
      if (supplierSortCol === 'product')
        cmp = String(a.product_supplied || '').localeCompare(String(b.product_supplied || ''))
      else if (supplierSortCol === 'factory')
        cmp = String(a.factories?.name || '').localeCompare(String(b.factories?.name || ''))
      else cmp = String(a.name || '').localeCompare(String(b.name || ''))
      return cmp * dir
    })
  }, [supplierFilter.filtered, supplierSortCol, supplierSortDir])

  const customerFilter = useSmartFilter(customers, {
    getSearchText: (c) => [
      c.name,
      c.email,
      c.gst_number,
      c.contact_name,
      c.contact_phone,
      c.factories?.name,
    ],
    facets: [{ key: 'factory', label: 'Factory', getValue: (c) => c.factories?.name || '—' }],
  })
  const [customerSortCol, setCustomerSortCol] = useState<'name' | 'factory'>('name')
  const [customerSortDir, setCustomerSortDir] = useState<'asc' | 'desc'>('asc')
  const visibleCustomers = useMemo(() => {
    const dir = customerSortDir === 'asc' ? 1 : -1
    return [...customerFilter.filtered].sort((a, b) => {
      const cmp =
        customerSortCol === 'factory'
          ? String(a.factories?.name || '').localeCompare(String(b.factories?.name || ''))
          : String(a.name || '').localeCompare(String(b.name || ''))
      return cmp * dir
    })
  }, [customerFilter.filtered, customerSortCol, customerSortDir])

  const innerTabs = GROUP_TABS[activeGroup]
  const showInnerNav = innerTabs.length > 1
  const panelAction =
    activeTab === 'factories' ? (
      <button type="button" onClick={() => { resetFactoryForm(); setShowFactoryForm(true) }} className="btn btn-owner gap-2">
        <Plus size={16} /> Add Factory
      </button>
    ) : activeTab === 'users' ? (
      <button type="button" onClick={() => { setShowUserForm(true); setUserError('') }} className="btn btn-owner gap-2">
        <Plus size={16} /> Add User
      </button>
    ) : activeTab === 'suppliers' ? (
      <button
        type="button"
        onClick={() => {
          setShowSupplierForm(true)
          setSupplierError('')
          setSupplierFieldErrors({})
          setSupplierForm(emptyVendorForm)
        }}
        className="btn btn-owner gap-2"
      >
        <Plus size={16} /> Add Supplier
      </button>
    ) : activeTab === 'customers' ? (
      <button
        type="button"
        onClick={() => {
          setShowCustomerForm(true)
          setCustomerError('')
        }}
        className="btn btn-owner gap-2"
      >
        <Plus size={16} /> Add Customer
      </button>
    ) : null

  return (
    <AppLayout>
      <div className="w-full p-4 md:p-8">
        <div className="mb-8 hidden lg:block">
        <PageHeader
          title="Management"
          subtitle="Owner · settings"
          accent="owner"
        />
        </div>

        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">
            {loadError}
          </div>
        )}

        <div className="sticky top-12 z-10 -mx-4 -mt-4 bg-[var(--color-surface)] md:static md:mx-0 md:mt-0 md:bg-transparent">
        <MobileTabs
          ariaLabel="Management"
          className="-mx-0 mt-0 mb-0 bg-panel"
          active={activeGroup}
          onChange={(g) => {
            setActiveGroup(g)
            setActiveTab(GROUP_TABS[g][0]!.key)
            setShowFactoryForm(false)
            setShowUserForm(false)
            setShowSupplierForm(false)
            setShowCustomerForm(false)
          }}
          tabs={GROUPS.map((g) => ({ key: g.key, label: g.label }))}
        />
        {showInnerNav && (
          <MobileTabs
            ariaLabel={`${activeGroup} sections`}
            className="-mx-0 mt-0 mb-0 bg-transparent"
            active={activeTab}
            onChange={(key) => {
              setActiveTab(key)
              setShowFactoryForm(false)
              setShowUserForm(false)
              setShowSupplierForm(false)
              setShowCustomerForm(false)
            }}
            tabs={innerTabs}
          />
        )}
        {panelAction &&
        (loading ||
          !(showFactoryForm || showUserForm || showSupplierForm || showCustomerForm)) ? (
          <div className="px-4 py-3 md:hidden [&_button]:w-full">{panelAction}</div>
        ) : null}
        </div>

        <div className="hidden md:block">
        <div className="folder-tabs" role="tablist" aria-label="Management">
          {GROUPS.map((g) => {
            const on = activeGroup === g.key
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={on}
                className={on ? 'folder-tab is-active' : 'folder-tab'}
                onClick={() => {
                  setActiveGroup(g.key)
                  setActiveTab(GROUP_TABS[g.key][0]!.key)
                  setShowFactoryForm(false)
                  setShowUserForm(false)
                  setShowSupplierForm(false)
                  setShowCustomerForm(false)
                }}
              >
                {g.label}
              </button>
            )
          })}
        </div>
        </div>
        <section className="folder-panel overflow-hidden max-md:overflow-visible max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:pb-8">
        {(showInnerNav || panelAction) && (
          <div className="hidden flex-wrap items-end justify-between gap-x-3 gap-y-2 px-4 md:flex">
            {showInnerNav ? (
              <div
                className="flex min-w-0 flex-1 gap-1 border-b border-border"
                role="tablist"
                aria-label={`${activeGroup} sections`}
              >
                {innerTabs.map((t) => {
                  const on = activeTab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      className={clsx(
                        '-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors',
                        on
                          ? 'border-owner font-medium text-primary'
                          : 'border-transparent text-muted hover:text-primary',
                      )}
                      onClick={() => {
                        setActiveTab(t.key)
                        setShowFactoryForm(false)
                        setShowUserForm(false)
                        setShowSupplierForm(false)
                        setShowCustomerForm(false)
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <span />
            )}
            {panelAction &&
            (loading ||
              !(showFactoryForm || showUserForm || showSupplierForm || showCustomerForm)) ? (
              <div className="flex-shrink-0 pb-2">{panelAction}</div>
            ) : null}
          </div>
        )}

        {loading ? (
          <SpinnerBlock accent="owner" label="Loading management data" className="py-20" />
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════
                FACTORIES TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'factories' && (
              <div className="md:p-4">
                {!loadError && assignedFactoryIds.length === 0 && (
                  <div className="mb-4 rounded-lg border border-border px-4 py-3">
                    <p className="text-sm text-muted">No factories are assigned to your owner account yet.</p>
                  </div>
                )}

                {showFactoryForm && (
                  <MgmtDrawer
                    eyebrow="Plant"
                    title={editingFactoryId ? 'Edit factory' : 'New factory'}
                    onClose={resetFactoryForm}
                    footer={
                      <>
                        <button type="button" onClick={resetFactoryForm} className="btn btn-ghost">
                          Cancel
                        </button>
                        <button type="submit" form="factory-form" disabled={factorySaving} className="btn btn-owner">
                          {factorySaving ? 'Saving…' : editingFactoryId ? 'Save' : 'Create factory'}
                        </button>
                      </>
                    }
                  >
                    <form id="factory-form" onSubmit={handleFactorySubmit} className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="factory-name" className="mb-2 block text-xs text-muted">Factory name *</label>
                        <input id="factory-name" className="input-field owner-focus" value={factoryForm.name} onChange={e => setFactoryForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Ananta Fine Chem" />
                      </div>
                      <div>
                        <label htmlFor="location" className="mb-2 block text-xs text-muted">Location *</label>
                        <input id="location" className="input-field owner-focus" value={factoryForm.location} onChange={e => setFactoryForm(f => ({ ...f, location: e.target.value }))} required placeholder="e.g. Ahmedabad, Gujarat" />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="company-address" className="mb-2 block text-xs text-muted">Company address *</label>
                        <textarea id="company-address"
                          className="input-field owner-focus min-h-[72px]"
                          value={factoryForm.company_address}
                          onChange={e => setFactoryForm(f => ({ ...f, company_address: e.target.value }))}
                          required
                          placeholder="Full address shown on Bill To / Ship To"
                        />
                      </div>
                      <div>
                        <label htmlFor="pan-number" className="mb-2 block text-xs text-muted">PAN number *</label>
                        <input id="pan-number"
                          className={`input-field owner-focus font-mono uppercase ${
                            factoryFieldErrors.pan_number ? 'border-red-500 focus:border-red-500' : ''
                          }`}
                          value={factoryForm.pan_number}
                          onChange={e => {
                            const pan = normalizePan(e.target.value).slice(0, 10)
                            setFactoryForm(f => ({ ...f, pan_number: pan }))
                            setFactoryFieldErrors(err => ({
                              ...err,
                              pan_number:
                                !pan
                                  ? 'PAN number is required'
                                  : pan.length < 10
                                    ? 'PAN must be 10 characters'
                                    : isValidPan(pan)
                                      ? undefined
                                      : 'Invalid PAN — format AAAAA9999A (e.g. AACFA7569G)',
                            }))
                          }}
                          placeholder="e.g. AACFA7569G"
                          maxLength={10}
                          required
                          aria-invalid={Boolean(factoryFieldErrors.pan_number)}
                        />
                        {factoryFieldErrors.pan_number && (
                          <p className="mt-1 text-xs text-red-500">{factoryFieldErrors.pan_number}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="gst-number" className="mb-2 block text-xs text-muted">GST number *</label>
                        <input id="gst-number"
                          className={`input-field owner-focus font-mono uppercase ${
                            factoryFieldErrors.gst_number ? 'border-red-500 focus:border-red-500' : ''
                          }`}
                          value={factoryForm.gst_number}
                          onChange={e => {
                            const gst = normalizeGstin(e.target.value).slice(0, 15)
                            setFactoryForm(f => ({ ...f, gst_number: gst }))
                            setFactoryFieldErrors(err => ({
                              ...err,
                              gst_number:
                                !gst
                                  ? 'GST number is required'
                                  : gst.length < 15
                                    ? 'GSTIN must be 15 characters'
                                    : isValidGstin(gst)
                                      ? undefined
                                      : 'Invalid GSTIN format (e.g. 24AACFA7569G1ZG)',
                            }))
                          }}
                          placeholder="e.g. 24AACFA7569G1ZG"
                          maxLength={15}
                          required
                          aria-invalid={Boolean(factoryFieldErrors.gst_number)}
                        />
                        {factoryFieldErrors.gst_number && (
                          <p className="mt-1 text-xs text-red-500">{factoryFieldErrors.gst_number}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="gst-range" className="mb-2 block text-xs text-muted">GST range *</label>
                        <input id="gst-range" className="input-field owner-focus" value={factoryForm.gst_range} onChange={e => setFactoryForm(f => ({ ...f, gst_range: e.target.value }))} required placeholder="e.g. I, Jivabhai Mansion, 2ND Floor…" />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="gst-division" className="mb-2 block text-xs text-muted">GST division *</label>
                        <input id="gst-division" className="input-field owner-focus" value={factoryForm.gst_division} onChange={e => setFactoryForm(f => ({ ...f, gst_division: e.target.value }))} required placeholder="e.g. New Naroda, …" />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="email" className="mb-2 block text-xs text-muted">Email *</label>
                        <input id="email"
                          className={`input-field owner-focus ${
                            factoryFieldErrors.email ? 'border-red-500 focus:border-red-500' : ''
                          }`}
                          type="email"
                          required
                          value={factoryForm.email}
                          onChange={e => {
                            const email = e.target.value
                            setFactoryForm(f => ({ ...f, email }))
                            const trimmed = email.trim()
                            setFactoryFieldErrors(err => ({
                              ...err,
                              email:
                                !trimmed
                                  ? 'Email is required'
                                  : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
                                    ? undefined
                                    : 'Enter a valid email address',
                            }))
                          }}
                          placeholder="e.g. accounts@anantafinechem.com"
                          aria-invalid={Boolean(factoryFieldErrors.email)}
                        />
                        {factoryFieldErrors.email && (
                          <p className="mt-1 text-xs text-red-500">{factoryFieldErrors.email}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="commissionerate" className="mb-2 block text-xs text-muted">Commissionerate *</label>
                        <input id="commissionerate" className="input-field owner-focus" value={factoryForm.commissionerate} onChange={e => setFactoryForm(f => ({ ...f, commissionerate: e.target.value }))} required placeholder="e.g. New North - Ahmedabad" />
                      </div>
                      {factoryError && (
                        <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{factoryError}</div>
                      )}
                    </form>
                  </MgmtDrawer>
                )}

                {factories.length === 0 ? (
                  <div className="card flex flex-col items-center justify-center py-20 gap-4">
                    <FactoryIcon size={40} className="text-muted" />
                    <p className="text-muted">No factories yet.</p>
                    <button onClick={() => setShowFactoryForm(true)} className="btn btn-owner gap-2"><Plus size={15} /> Add your first factory</button>
                  </div>
                ) : (
                  <>
                  <div className="space-y-3 md:hidden">
                    {factories.map((factory) => {
                      const assignedIds = factoryUsersMap[factory.id] ?? []
                      const assignedUsers = profiles.filter((p) => assignedIds.includes(p.id))
                      const isExpanded = expandedFactory === factory.id
                      const city = locationCity(factory.location)
                      const materials = (factory.materials ?? [])
                        .map((m) => (typeof m === 'string' ? m : String((m as { name?: string }).name ?? '')))
                        .filter(Boolean)
                      return (
                        <div key={factory.id}>
                          <MobileCard
                            title={factory.name}
                            subtitle={city}
                            aside={
                              <span className={clsx('badge', factory.is_active ? 'badge-chemist' : 'badge-muted')}>
                                {factory.is_active ? 'Active' : 'Inactive'}
                              </span>
                            }
                            rows={[
                              { label: 'Materials', value: materials.join(', ') || '—' },
                              { label: 'GST', value: factory.gst_number || '—' },
                              { label: 'PAN', value: factory.pan_number || '—' },
                              {
                                label: 'Assigned',
                                value: assignedUsers.map((u) => u.full_name).join(', ') || 'None',
                              },
                              {
                                label: 'Added',
                                value: new Date(factory.created_at).toLocaleDateString('en-IN'),
                              },
                            ]}
                            footer={
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditFactory(factory)}
                                  className="btn flex-1 justify-center gap-1.5 border border-text bg-panel py-2 text-xs text-primary"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedFactory(isExpanded ? null : factory.id)}
                                  className={clsx(
                                    'btn min-w-0 flex-1 justify-center gap-1.5 py-2 text-xs',
                                    isExpanded ? 'btn-owner' : 'border border-text bg-panel text-primary',
                                  )}
                                >
                                  <Users size={13} />
                                  <span className="truncate">{isExpanded ? 'Done' : 'Assign'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFactoryActive(factory)}
                                  className={clsx(
                                    'btn justify-center px-3 py-2 text-xs',
                                    factory.is_active
                                      ? 'border border-red-300 bg-panel text-red-600'
                                      : 'btn-chemist',
                                  )}
                                  title={factory.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  {factory.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                                </button>
                              </div>
                            }
                          />
                          {isExpanded ? (
                            <div className="mobile-card mt-2 rounded-xl p-4">
                              <p className="mb-3 text-xs text-muted">Tap to grant or remove access</p>
                              {assignableUsers.length === 0 ? (
                                <p className="text-xs text-muted italic">No active inputers or chemists found.</p>
                              ) : (
                                <div className="space-y-2">
                                  {assignableUsers.map((user) => {
                                    const isAssigned = assignedIds.includes(user.id)
                                    return (
                                      <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => toggleUserAssignment(factory.id, user.id)}
                                        disabled={assignSaving}
                                        className={clsx(
                                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left disabled:opacity-50',
                                          isAssigned ? 'border-owner/30 bg-owner/10' : 'border-border bg-transparent',
                                        )}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm font-medium text-primary">{user.full_name}</div>
                                          <div className="text-xs text-muted">{user.role}</div>
                                        </div>
                                        <span className="text-xs text-muted">{isAssigned ? 'Assigned' : 'Add'}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
                    {factories.map((factory, i) => {
                      const assignedIds   = factoryUsersMap[factory.id] ?? []
                      const assignedUsers = profiles.filter(p => assignedIds.includes(p.id))
                      const isExpanded    = expandedFactory === factory.id
                      const duplicateName = factories.filter((f) => f.name === factory.name).length > 1
                      const city = locationCity(factory.location)
                      return (
                        <div key={factory.id}
                          className={clsx(
                            'card border transition-all',
                            factory.is_active
                              ? 'border-owner/25 glow-border-owner'
                              : 'border-border bg-muted/10 opacity-70',
                          )}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <div className="p-4 md:p-6">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className={clsx(
                                'w-12 h-12 rounded-xl border flex items-center justify-center text-2xl flex-shrink-0',
                                factory.is_active ? 'bg-owner/10 border-owner/25' : 'bg-muted/20 border-border grayscale',
                              )}>🏭</div>
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-lg font-medium text-primary">{factory.name}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <MapPin size={11} className="text-muted flex-shrink-0" />
                                  <span className="text-xs text-muted truncate">{city}</span>
                                </div>
                                {duplicateName && factory.gst_number ? (
                                  <p className="mt-0.5 truncate font-mono text-xs text-muted">GST {factory.gst_number}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mb-4">
                              <span className={clsx('badge', factory.is_active ? 'badge-chemist' : 'badge-muted')}>{factory.is_active ? '● Active' : '○ Inactive'}</span>
                              <span className="text-xs text-muted">{new Date(factory.created_at).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div className="mb-3">
                              <div className="mb-1.5 text-xs text-muted">Materials</div>
                              {factory.materials && factory.materials.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {factory.materials.map((m) => {
                                    const label = typeof m === 'string' ? m : String((m as { name?: string }).name ?? '')
                                    if (!label) return null
                                    return (
                                    <span key={label} className="whitespace-nowrap rounded bg-owner/15 px-2 py-0.5 text-xs text-owner border border-owner/30">{label}</span>
                                    )
                                  })}
                                </div>
                              ) : <span className="text-xs text-muted italic">No materials listed</span>}
                            </div>
                            {(factory.pan_number || factory.gst_number || factory.email) && (
                              <div className="mb-3 text-xs text-muted space-y-0.5">
                                {factory.email && <p>Email: <span className="text-primary">{factory.email}</span></p>}
                                {factory.pan_number && <p>PAN: <span className="font-mono text-primary">{factory.pan_number}</span></p>}
                                {factory.gst_number && <p>GST: <span className="font-mono text-primary">{factory.gst_number}</span></p>}
                              </div>
                            )}
                            <div className="bg-layer-sm rounded-lg px-3 py-2.5 mb-4">
                              <div className="mb-1.5 text-xs text-muted">Assigned users</div>
                              {assignedUsers.length === 0 ? (
                                <span className="text-xs text-muted italic">No users assigned yet</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {assignedUsers.map(u => (
                                    <span key={u.id} className={clsx(
                                      'text-xs px-2 py-0.5 rounded border whitespace-nowrap',
                                      u.role === 'inputer' ? 'bg-inputer/10 text-inputer border-inputer/25' : 'bg-chemist/10 text-chemist border-chemist/25'
                                    )}>{u.full_name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => startEditFactory(factory)} className="btn btn-ghost flex-1 justify-center gap-1.5 py-2 text-xs whitespace-nowrap"><Pencil size={13} /> Edit</button>
                              <button
                                onClick={() => setExpandedFactory(isExpanded ? null : factory.id)}
                                className={clsx('btn min-w-0 flex-1 justify-center gap-1.5 py-2 text-xs', isExpanded ? 'btn-owner' : 'btn-ghost')}
                              >
                                <Users size={13} /><span className="truncate">{isExpanded ? 'Done' : 'Assign'}</span>
                              </button>
                              <button
                                onClick={() => toggleFactoryActive(factory)}
                                className={clsx('btn justify-center gap-1.5 py-2 px-3 text-xs', factory.is_active ? 'btn-danger' : 'btn-chemist')}
                                title={factory.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {factory.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-owner/20 px-6 py-4 bg-owner/3">
                              <p className="mb-3 text-xs text-muted">Click to grant or remove access</p>
                              {assignableUsers.length === 0 ? (
                                <p className="text-xs text-muted italic">No active inputers or chemists found.</p>
                              ) : (
                                <div className="space-y-2">
                                  {assignableUsers.map(user => {
                                    const isAssigned = assignedIds.includes(user.id)
                                    return (
                                      <button key={user.id} onClick={() => toggleUserAssignment(factory.id, user.id)} disabled={assignSaving}
                                        className={clsx(
                                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all disabled:opacity-50',
                                          isAssigned ? 'bg-owner/10 border-owner/30 hover:bg-owner/15' : 'bg-transparent border-border hover:border-white/20'
                                        )}
                                      >
                                        <div className={clsx('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all', isAssigned ? 'bg-owner border-owner' : 'border-muted')}>
                                          {isAssigned && <span className="text-[9px] text-black font-bold">✓</span>}
                                        </div>
                                        <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0', user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : 'bg-chemist/15 text-chemist')}>
                                          {user.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm text-primary font-medium truncate">{user.full_name}</div>
                                        </div>
                                        <span className={clsx('text-xs px-2 py-0.5 rounded border flex-shrink-0',
                                          user.role === 'inputer' ? 'text-inputer border-inputer/30 bg-inputer/5' : 'text-chemist border-chemist/30 bg-chemist/5'
                                        )}>{user.role}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  </>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                USERS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'users' && (
              <div className="md:p-4">
                <p className="mb-4 text-sm text-muted">
                  Login accounts. HR records live under Employees.
                </p>

                {!loadError && assignedFactoryIds.length === 0 && (
                  <div className="card p-6 mb-4">
                    <p className="text-sm text-muted">No factories assigned to your account yet. Ask the platform admin to assign factories first.</p>
                  </div>
                )}

                {showUserForm && (
                  <MgmtDrawer
                    eyebrow="People"
                    title="New user"
                    onClose={() => { setShowUserForm(false); setUserError(''); setNewUser(EMPTY_NEW_USER) }}
                    footer={
                      <>
                        <button type="button" onClick={() => { setShowUserForm(false); setUserError(''); setNewUser(EMPTY_NEW_USER) }} className="btn btn-ghost">Cancel</button>
                        <button type="submit" form="user-form" disabled={userSaving} className="btn btn-owner">{userSaving ? 'Creating…' : 'Create user'}</button>
                      </>
                    }
                  >
                    <form id="user-form" onSubmit={handleAddUser} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="full-name" className="mb-2 block text-xs text-muted">Full name *</label>
                          <input id="full-name" className="input-field owner-focus" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} required placeholder="e.g. Ramesh Kumar" />
                        </div>
                        <div>
                          <label htmlFor="email-2" className="mb-2 block text-xs text-muted">Email *</label>
                          <input id="email-2" type="email" className="input-field owner-focus" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required placeholder="user@factory.com" />
                        </div>
                        <div>
                          <label htmlFor="phone" className="mb-2 block text-xs text-muted">Phone</label>
                          <input id="phone" className="input-field owner-focus" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} placeholder="+91 99999 00000" />
                        </div>
                        <div>
                          <label htmlFor="role" className="mb-2 block text-xs text-muted">Role *</label>
                          <select id="role" className="input-field owner-focus" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            <option value="owner">Owner</option>
                            <option value="inputer">Inputer</option>
                            <option value="accountant">Accountant</option>
                            <option value="chemist">Chemist</option>
                            <option value="lab_incharge">Lab Incharge</option>
                            <option value="warehouse_manager">Warehouse manager</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="password" className="mb-2 block text-xs text-muted">Password *</label>
                          <input id="password" type="password" className="input-field owner-focus" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required placeholder="Minimum 8 characters" minLength={8} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-3 block text-xs text-muted">
                          Factory access <span className="ml-2 text-xs text-muted/60">(select which factories this user can access)</span>
                        </label>
                        <FactoryCheckboxes
                          selected={newUser.factory_ids}
                          onToggle={id => setNewUser(u => ({ ...u, factory_ids: u.factory_ids.includes(id) ? u.factory_ids.filter(f => f !== id) : [...u.factory_ids, id] }))}
                        />
                      </div>
                      {userError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{userError}</div>}
                    </form>
                  </MgmtDrawer>
                )}

                {profiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <p className="text-muted text-sm">No users yet.</p>
                        <button onClick={() => setShowUserForm(true)} className="btn btn-owner gap-2"><Plus size={15} /> Add your first user</button>
                      </div>
                    ) : (
                      <div>
                        <div className="md:hidden">
                          <MobileListToolbar
                            filter={userFilter}
                            placeholder="Search name, email, role…"
                            resultCount={visibleUsers.length}
                            noun={{ one: 'user', many: 'users' }}
                            sortOptions={[
                              { col: 'name', label: 'Name', kind: 'text' },
                              { col: 'role', label: 'Role', kind: 'text' },
                              { col: 'status', label: 'Status', kind: 'text' },
                            ]}
                            sortCol={userSortCol}
                            sortDir={userSortDir}
                            onSort={(col) => {
                              if (userSortCol === col) setUserSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                              else {
                                setUserSortCol(col)
                                setUserSortDir('asc')
                              }
                            }}
                          />
                        </div>
                        {visibleUsers.length === 0 ? (
                          <EmptyState className="rounded-xl bg-panel" title="No users match your search or filter." />
                        ) : (
                          <div className="space-y-3 md:hidden">
                          {visibleUsers.map(user => (
                            <MobileCard
                              key={user.id}
                              title={user.full_name}
                              subtitle={user.email}
                              aside={
                                <span className={clsx('badge', user.role === 'owner' ? 'badge-owner' : user.role === 'inputer' ? 'badge-inputer' : user.role === 'accountant' ? 'badge-pmc' : 'badge-chemist')}>{user.role}</span>
                              }
                              rows={[
                                { label: 'Phone', value: user.phone ?? '—' },
                                {
                                  label: 'Factories',
                                  value:
                                    (pfMap[user.id] ?? []).length === 0
                                      ? 'None assigned'
                                      : factories
                                          .filter((f) => (pfMap[user.id] ?? []).includes(f.id))
                                          .map((f) => f.name)
                                          .join(', '),
                                },
                                {
                                  label: 'Status',
                                  value: user.is_active ? 'Active' : 'Inactive',
                                },
                              ]}
                              footer={
                                <div className="flex gap-2">
                                  <button onClick={() => openEditUser(user)} className="btn flex-1 justify-center gap-1 border border-text bg-panel py-2 text-xs text-primary">
                                    <Pencil size={14} /> Edit
                                  </button>
                                  <button onClick={() => toggleUserActive(user)} className={clsx('btn flex-1 justify-center gap-1 py-2 text-xs', user.is_active ? 'border border-red-300 bg-panel text-red-600' : 'btn-chemist')}>
                                    {user.is_active ? (
                                      <span className="inline-flex items-center gap-1">
                                        <UserX size={14} /> Deactivate
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1">
                                        <UserCheck size={14} /> Activate
                                      </span>
                                    )}
                                  </button>
                                </div>
                              }
                            />
                          ))}
                        </div>
                        )}
                        {visibleUsers.length > 0 ? (
                        <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                        <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr><th>User</th><th>Role</th><th>Contact</th><th>Assigned Factories</th><th>Status</th><th>Actions</th></tr>
                          </thead>
                          <tbody>
                            {visibleUsers.map(user => (
                              <tr key={user.id}>
                                <td>
                                  <div className="flex items-center gap-3">
                                    <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                                      user.role === 'owner' ? 'bg-owner/15 text-owner' : user.role === 'inputer' ? 'bg-inputer/15 text-inputer' : user.role === 'accountant' ? 'bg-pmc/15 text-pmc' : 'bg-chemist/15 text-chemist'
                                    )}>{user.full_name.charAt(0)}</div>
                                    <div>
                                      <div className="text-sm text-primary font-medium whitespace-nowrap">{user.full_name}</div>
                                      <div className="text-xs text-muted">{user.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td><span className={clsx('badge', user.role === 'owner' ? 'badge-owner' : user.role === 'inputer' ? 'badge-inputer' : user.role === 'accountant' ? 'badge-pmc' : 'badge-chemist')}>{user.role}</span></td>
                                <td className="text-muted text-xs whitespace-nowrap">{user.phone ?? '—'}</td>
                                <td>
                                  <div className="flex flex-wrap gap-1">
                                    {(pfMap[user.id] ?? []).length === 0 ? (
                                      <span className="text-xs text-muted italic">None assigned</span>
                                    ) : factories.filter(f => (pfMap[user.id] ?? []).includes(f.id)).map(f => (
                                      <span key={f.id} className="whitespace-nowrap rounded bg-owner/15 px-2 py-0.5 text-xs text-owner border border-owner/30">{f.name}</span>
                                    ))}
                                  </div>
                                </td>
                                <td><span className={clsx('badge', user.is_active ? 'badge-chemist' : 'badge-muted')}>{user.is_active ? '● Active' : '○ Inactive'}</span></td>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => openEditUser(user)} className="btn btn-ghost text-xs py-1.5 px-3 gap-1 whitespace-nowrap"><Pencil size={12} /> Edit</button>
                                    <button onClick={() => toggleUserActive(user)} className={clsx('btn text-xs py-1.5 px-3 whitespace-nowrap', user.is_active ? 'btn-danger' : 'btn-chemist')}>
                                      {user.is_active ? (
                                      <span className="inline-flex items-center gap-1">
                                        <UserX size={12} /> Deactivate
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1">
                                        <UserCheck size={12} /> Activate
                                      </span>
                                    )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                        </div>
                        ) : null}
                      </div>
                    )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SUPPLIERS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'suppliers' && (
              <div className="md:p-4">
                {showSupplierForm && (
                  <MgmtDrawer
                    eyebrow="Trade"
                    title="New supplier"
                    onClose={() => {
                      setShowSupplierForm(false)
                      setSupplierForm(emptyVendorForm)
                      setSupplierFactoryId('')
                      setSupplierError('')
                      setSupplierFieldErrors({})
                    }}
                    footer={
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setShowSupplierForm(false)
                            setSupplierForm(emptyVendorForm)
                            setSupplierFactoryId('')
                            setSupplierError('')
                            setSupplierFieldErrors({})
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" form="supplier-form" disabled={supplierSaving} className="btn btn-owner">
                          {supplierSaving ? 'Adding…' : 'Add supplier'}
                        </button>
                      </>
                    }
                  >
                    <form id="supplier-form" onSubmit={handleAddSupplier} className="space-y-4">
                      {supplierError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{supplierError}</div>
                      )}
                      <VendorRegistrationForm
                        form={supplierForm}
                        setForm={setSupplierForm}
                        fieldErrors={supplierFieldErrors}
                        setFieldErrors={setSupplierFieldErrors}
                        factorySlot={
                          <div>
                            <label htmlFor="supplier-factory" className="mb-1 block text-xs text-muted">
                              Factory *
                            </label>
                            <select
                              id="supplier-factory"
                              className="input-field owner-focus"
                              value={supplierFactoryId}
                              onChange={e => setSupplierFactoryId(e.target.value)}
                              required
                            >
                              <option value="">Select factory</option>
                              {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                          </div>
                        }
                      />
                    </form>
                  </MgmtDrawer>
                )}

                {suppliers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Package size={36} className="text-muted" />
                      <p className="text-muted text-sm">No suppliers yet. Add your first supplier above.</p>
                      <button onClick={() => setShowSupplierForm(true)} className="btn btn-owner gap-2"><Plus size={15} /> Add Supplier</button>
                    </div>
                  ) : (
                    <div>
                      <div className="md:hidden">
                        <MobileListToolbar
                          filter={supplierFilter}
                          placeholder="Search supplier, product, GST…"
                          resultCount={visibleSuppliers.length}
                          noun={{ one: 'supplier', many: 'suppliers' }}
                          sortOptions={[
                            { col: 'name', label: 'Name', kind: 'text' },
                            { col: 'product', label: 'Product', kind: 'text' },
                            { col: 'factory', label: 'Factory', kind: 'text' },
                          ]}
                          sortCol={supplierSortCol}
                          sortDir={supplierSortDir}
                          onSort={(col) => {
                            if (supplierSortCol === col)
                              setSupplierSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                            else {
                              setSupplierSortCol(col)
                              setSupplierSortDir('asc')
                            }
                          }}
                        />
                        {visibleSuppliers.length === 0 ? (
                          <EmptyState
                            className="rounded-xl bg-panel"
                            title="No suppliers match your search or filter."
                          />
                        ) : (
                          <div className="space-y-3">
                            {visibleSuppliers.map((s) => (
                              <MobileCard
                                key={s.id}
                                title={s.name}
                                subtitle={s.factories?.name ?? '—'}
                                rows={[
                                  { label: 'Product', value: s.product_supplied || '—' },
                                  { label: 'GST', value: s.gst_number || '—' },
                                  { label: 'Contact', value: s.contact_name || s.email || '—' },
                                  {
                                    label: 'Added',
                                    value: s.created_at
                                      ? new Date(s.created_at).toLocaleDateString('en-IN')
                                      : '—',
                                  },
                                ]}
                                footer={
                                  <button
                                    onClick={() => handleDeleteSupplier(s.id, s.name)}
                                    className="btn w-full justify-center gap-1.5 border border-red-300 bg-panel py-2 text-xs text-red-600"
                                    aria-label={`Delete supplier ${s.name}`}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                        <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr><th>Supplier Name</th><th>Product</th><th>GST</th><th>Contact</th><th>Factory</th><th>Added On</th><th>Actions</th></tr>
                          </thead>
                          <tbody>
                            {visibleSuppliers.map(s => (
                              <tr key={s.id}>
                                <td className="font-medium text-primary">{s.name}</td>
                                <td className="text-xs text-muted">{s.product_supplied || '—'}</td>
                                <td className="text-xs font-mono text-muted">{s.gst_number || '—'}</td>
                                <td className="text-xs text-muted">{s.contact_name || s.email || '—'}</td>
                                <td className="text-xs text-muted">{(s as any).factories?.name ?? '—'}</td>
                                <td className="text-xs text-muted">{s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN') : '—'}</td>
                                <td>
                                  <button
                                    onClick={() => handleDeleteSupplier(s.id, s.name)}
                                    className="text-muted hover:text-red-400 transition-colors p-1"
                                    aria-label={`Delete supplier ${s.name}`}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="md:p-4">
                {showCustomerForm && (
                  <MgmtDrawer
                    eyebrow="Trade"
                    title="New customer"
                    onClose={() => {
                      setShowCustomerForm(false)
                      setCustomerName('')
                      setCustomerAddress('')
                      setCustomerEmail('')
                      setCustomerTitle('')
                      setCustomerContactName('')
                      setCustomerGst('')
                      setCustomerPhone('')
                      setCustomerFactoryId('')
                      setCustomerError('')
                    }}
                    footer={
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setShowCustomerForm(false)
                            setCustomerName('')
                            setCustomerAddress('')
                            setCustomerEmail('')
                            setCustomerTitle('')
                            setCustomerContactName('')
                            setCustomerGst('')
                            setCustomerPhone('')
                            setCustomerFactoryId('')
                            setCustomerError('')
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" form="customer-form" disabled={customerSaving} className="btn btn-owner">
                          {customerSaving ? 'Adding…' : 'Add customer'}
                        </button>
                      </>
                    }
                  >
                    <form id="customer-form" onSubmit={handleAddCustomer} className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="factory-2" className="mb-2 block text-xs text-muted">
                          Factory *
                        </label>
                        <select id="factory-2"
                          className="input-field owner-focus"
                          value={customerFactoryId}
                          onChange={(e) => setCustomerFactoryId(e.target.value)}
                          required
                        >
                          <option value="">Select factory</option>
                          {factories.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="company-name" className="mb-2 block text-xs text-muted">
                          Company name *
                        </label>
                        <input id="company-name"
                          className="input-field owner-focus"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                          placeholder="e.g. ABC Traders"
                        />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="company-address-2" className="mb-2 block text-xs text-muted">
                          Company address *
                        </label>
                        <textarea id="company-address-2"
                          className="input-field owner-focus w-full min-h-[4.5rem]"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          required
                          placeholder="Street, city, state, PIN"
                        />
                      </div>
                      <div>
                        <label htmlFor="email-3" className="mb-2 block text-xs text-muted">
                          Email *
                        </label>
                        <input id="email-3"
                          className="input-field owner-focus"
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          required
                          placeholder="accounts@client.com"
                        />
                      </div>
                      <div>
                        <label htmlFor="gstin" className="mb-2 block text-xs text-muted">
                          GSTIN
                        </label>
                        <input id="gstin"
                          className="input-field owner-focus font-mono uppercase"
                          value={customerGst}
                          onChange={(e) => setCustomerGst(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-title" className="mb-2 block text-xs text-muted">
                          Contact title *
                        </label>
                        <select id="contact-title"
                          className="input-field owner-focus"
                          value={customerTitle}
                          onChange={(e) => setCustomerTitle(e.target.value)}
                          required
                        >
                          <option value="">Select title</option>
                          {['Mr', 'Mrs', 'Ms', 'Dr'].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="contact-person" className="mb-2 block text-xs text-muted">
                          Contact person *
                        </label>
                        <input id="contact-person"
                          className="input-field owner-focus"
                          value={customerContactName}
                          onChange={(e) => setCustomerContactName(e.target.value)}
                          required
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-phone" className="mb-2 block text-xs text-muted">
                          Contact phone
                        </label>
                        <input id="contact-phone"
                          className="input-field owner-focus"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="10-digit mobile"
                        />
                      </div>
                      {customerError && (
                        <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                          {customerError}
                        </div>
                      )}
                    </form>
                  </MgmtDrawer>
                )}
                {customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Building2 size={36} className="text-muted" />
                      <p className="text-muted text-sm">No customers yet. Add your first customer above.</p>
                      <button
                        onClick={() => setShowCustomerForm(true)}
                        className="btn btn-owner gap-2"
                      >
                        <Plus size={15} /> Add Customer
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="md:hidden">
                        <MobileListToolbar
                          filter={customerFilter}
                          placeholder="Search customer, GST, contact…"
                          resultCount={visibleCustomers.length}
                          noun={{ one: 'customer', many: 'customers' }}
                          sortOptions={[
                            { col: 'name', label: 'Name', kind: 'text' },
                            { col: 'factory', label: 'Factory', kind: 'text' },
                          ]}
                          sortCol={customerSortCol}
                          sortDir={customerSortDir}
                          onSort={(col) => {
                            if (customerSortCol === col)
                              setCustomerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                            else {
                              setCustomerSortCol(col)
                              setCustomerSortDir('asc')
                            }
                          }}
                        />
                        {visibleCustomers.length === 0 ? (
                          <EmptyState
                            className="rounded-xl bg-panel"
                            title="No customers match your search or filter."
                          />
                        ) : (
                          <div className="space-y-3">
                            {visibleCustomers.map((c) => (
                              <MobileCard
                                key={c.id}
                                title={c.name}
                                subtitle={c.factories?.name ?? '—'}
                                rows={[
                                  {
                                    label: 'Contact',
                                    value:
                                      [c.contact_title, c.contact_name].filter(Boolean).join(' ') ||
                                      '—',
                                  },
                                  { label: 'Phone', value: c.contact_phone || '—' },
                                  { label: 'Email', value: c.email || '—' },
                                  { label: 'GSTIN', value: c.gst_number || '—' },
                                ]}
                                footer={
                                  <button
                                    onClick={() => handleDeleteCustomer(c.id, c.name)}
                                    className="btn w-full justify-center gap-1.5 border border-red-300 bg-panel py-2 text-xs text-red-600"
                                    aria-label={`Delete customer ${c.name}`}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                }
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>GSTIN</th>
                            <th>Factory</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCustomers.map((c) => (
                            <tr key={c.id} className={c.is_active === false ? 'opacity-50' : ''}>
                              <td className="font-medium text-primary">
                                {c.name}
                                {c.company_address ? (
                                  <span className="mt-0.5 block text-[11px] font-normal text-muted/80">
                                    {c.company_address}
                                  </span>
                                ) : null}
                              </td>
                              <td className="text-xs text-muted">
                                {[c.contact_title, c.contact_name].filter(Boolean).join(' ') || '—'}
                                {c.contact_phone ? (
                                  <span className="mt-0.5 block">{c.contact_phone}</span>
                                ) : null}
                              </td>
                              <td className="text-xs text-muted">{c.email || '—'}</td>
                              <td className="text-xs text-muted">{c.gst_number || '—'}</td>
                              <td className="text-xs text-muted">{c.factories?.name ?? '—'}</td>
                              <td>
                                <button
                                  onClick={() => handleDeleteCustomer(c.id, c.name)}
                                  className="text-muted hover:text-red-400 transition-colors p-1"
                                  aria-label={`Delete customer ${c.name}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </div>
                    </div>
                  )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                NUMBERING TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'numbering' && (
              <div className="md:p-4">
                <p className="text-sm text-muted mb-4">
                  Prefix and pad for PO, lot, batch, sale, and COA. Indian FY Apr–Mar.
                  Semi-finished is always month/productCode/SF/seq/FY.
                </p>

                <div className="mb-5">
                  <label htmlFor="factory-3" className="mb-2 block text-xs text-muted">
                    Factory
                  </label>
                  <select id="factory-3"
                    className="input-field owner-focus w-full"
                    value={numberingFactoryId}
                    onChange={(e) => setNumberingFactoryId(e.target.value)}
                  >
                    <option value="">Select factory</option>
                    {factories
                      .filter((f) => assignedFactoryIds.includes(f.id) || assignedFactoryIds.length === 0)
                      .map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                  </select>
                </div>

                {numberingLoading ? (
                  <p className="text-sm text-muted">Loading numbering settings…</p>
                ) : (
                  <form onSubmit={saveNumbering} className="space-y-6">
                    {(
                      [
                        {
                          key: 'po' as const,
                          title: 'Purchase Order',
                          row: numberingPo,
                          set: setNumberingPo,
                          hint: 'Issued when Owner generates a PO',
                          format: 'slash_seq_fy' as const,
                          placeholder: 'PO',
                          exampleSeq: 92,
                        },
                        {
                          key: 'lot' as const,
                          title: 'Lot / GRN',
                          row: numberingLot,
                          set: setNumberingLot,
                          hint: 'Issued when Accountant receives material (one lot per receive)',
                          format: 'slash_seq_fy' as const,
                          placeholder: 'RM',
                          exampleSeq: 92,
                        },
                        {
                          key: 'batch' as const,
                          title: 'Finished goods batch',
                          row: numberingBatch,
                          set: setNumberingBatch,
                          hint: 'Auto-assigned when chemist creates a finished-goods batch. Prefix is the factory short form.',
                          format: 'seq_slash_prefix_fy' as const,
                          placeholder: 'BAT',
                          exampleSeq: 1,
                        },
                        {
                          key: 'sale' as const,
                          title: 'Sale',
                          row: numberingSale,
                          set: setNumberingSale,
                          hint: 'Finished-goods sales, including discounted rejected FG.',
                          format: 'slash_seq_fy' as const,
                          placeholder: 'SL',
                          exampleSeq: 1,
                        },
                        {
                          key: 'coa' as const,
                          title: 'Dispatch COA',
                          row: numberingCoa,
                          set: setNumberingCoa,
                          hint: 'Finished-goods dispatch COA. Not used for SFG.',
                          format: 'slash_seq_fy' as const,
                          placeholder: 'COA',
                          exampleSeq: 1,
                        },
                      ] as const
                    ).map((block) => (
                      <div key={block.key} className="mobile-card space-y-3 rounded-xl p-4">
                        <div>
                          <h3 className="text-base font-medium text-primary">
                            {block.title}
                          </h3>
                          <p className="text-xs text-muted mt-1">{block.hint}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="mb-2 block text-xs text-muted">
                              Prefix
                            </label>
                            <input aria-label="Prefix"
                              className="input-field owner-focus font-mono"
                              value={block.row.prefix}
                              onChange={(e) =>
                                block.set({
                                  ...block.row,
                                  prefix: e.target.value,
                                  example: localNumberPreview(
                                    e.target.value,
                                    block.row.pad_width,
                                    block.format,
                                    block.exampleSeq,
                                  ),
                                })
                              }
                              placeholder={block.placeholder}
                              required
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs text-muted">
                              Seq pad width
                            </label>
                            <input aria-label="Seq pad width"
                              className="input-field owner-focus"
                              type="number"
                              min={0}
                              max={8}
                              value={block.row.pad_width}
                              onChange={(e) => {
                                const pad = Math.max(0, Math.min(8, Number(e.target.value) || 0))
                                block.set({
                                  ...block.row,
                                  pad_width: pad,
                                  example: localNumberPreview(
                                    block.row.prefix,
                                    pad,
                                    block.format,
                                    block.exampleSeq,
                                  ),
                                })
                              }}
                            />
                            <p className="text-[11px] text-muted mt-1">0 = unpadded (92). 3 = 092.</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted">
                          Example:{' '}
                          <span className="font-mono text-primary">
                              {block.row.example ||
                              localNumberPreview(
                                block.row.prefix,
                                block.row.pad_width,
                                block.format,
                                block.exampleSeq,
                              )}
                          </span>
                        </p>
                      </div>
                    ))}

                    <div className="mobile-card space-y-2 rounded-xl p-4">
                      <h3 className="text-base font-medium text-primary">
                        Semi-finished batch
                      </h3>
                      <p className="text-xs text-muted">
                        Assigned automatically from month + product code. Sequence resets each calendar month per product.
                      </p>
                      <p className="text-sm text-muted">
                        Example:{' '}
                        <span className="font-mono text-primary">
                          {(() => {
                            const d = new Date()
                            const months = [
                              'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
                            ]
                            const y = d.getFullYear()
                            const startYear = d.getMonth() >= 3 ? y : y - 1
                            const fy = `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`
                            return `${months[d.getMonth()]}/CODE/SF/1/${fy}`
                          })()}
                        </span>
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={numberingSaving || !numberingFactoryId}
                      className="btn btn-owner px-6 py-3"
                    >
                      {numberingSaving ? 'Saving…' : 'Save numbering'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="md:p-4">
                <p className="mb-4 text-sm text-muted">
                  HR records. Login accounts live under Users.
                </p>
                <EmployeesPanel
                  factories={factories}
                  assignedFactoryIds={assignedFactoryIds}
                />
              </div>
            )}

            {activeTab === 'raw_materials' && (
              <div className="md:p-4">
                <RawMaterialsPanel
                  factories={factories}
                  assignedFactoryIds={assignedFactoryIds}
                  onSaved={loadAll}
                />
              </div>
            )}

            {activeTab === 'production' && (
              <div className="md:p-4">
                <ProductionTemplatesPanel
                  factories={factories}
                  assignedFactoryIds={assignedFactoryIds}
                />
              </div>
            )}

          </>
        )}
        </section>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <MgmtDrawer
          eyebrow="People"
          title="Edit user"
          onClose={() => setEditUser(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditUser(null)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" form="edit-user-form" disabled={editSaving} className="btn btn-owner">
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
            <p className="mb-4 text-sm text-muted">{editUser.email}</p>
            <form id="edit-user-form" onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="full-name-2" className="mb-2 block text-xs text-muted">Full name *</label>
                  <input id="full-name-2" className="input-field owner-focus" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="phone-2" className="mb-2 block text-xs text-muted">Phone</label>
                  <input id="phone-2" className="input-field owner-focus" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+91 99999 00000" />
                </div>
                {editUser.role !== 'owner' && (
                  <div className="md:col-span-2">
                    <label htmlFor="role-2" className="mb-2 block text-xs text-muted">Role *</label>
                    <select id="role-2" className="input-field owner-focus" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                      <option value="inputer">Inputer</option>
                      <option value="accountant">Accountant</option>
                      <option value="chemist">Chemist</option>
                      <option value="lab_incharge">Lab Incharge</option>
                      <option value="warehouse_manager">Warehouse manager</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-3 block text-xs text-muted">
                  Factory access <span className="ml-2 text-xs text-muted/60">(toggle to grant or remove access)</span>
                </label>
                <FactoryCheckboxes
                  selected={editForm.factory_ids}
                  onToggle={id => setEditForm(f => ({ ...f, factory_ids: f.factory_ids.includes(id) ? f.factory_ids.filter(x => x !== id) : [...f.factory_ids, id] }))}
                />
              </div>
              {editError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{editError}</div>}
              {FEATURES.some((f) => f.roles.includes(editForm.role)) ? (
                <div className="border-t border-border pt-4">
                  <p className="mb-1 text-xs text-muted">Permissions</p>
                  <p className="mb-3 text-xs text-muted">Override default rights for this login.</p>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {FEATURES.filter((f) => f.roles.includes(editForm.role)).map((feature) => {
                      const override = getOverride(editUser.id, feature.key)
                      const isAllowed = override ? override.is_allowed : true
                      return (
                        <div key={feature.key} className="flex items-center justify-between px-3 py-3">
                          <div>
                            <div className="text-sm text-primary">{feature.label}</div>
                            {override ? (
                              <div className="text-[11px] text-muted">Override active</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleFeature(editUser.id, feature.key, isAllowed)}
                            disabled={permSaving}
                            className={clsx('transition-all', isAllowed ? 'text-chemist' : 'text-muted')}
                            role="switch"
                            aria-checked={isAllowed}
                            aria-label={feature.label}
                          >
                            {isAllowed ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </form>
        </MgmtDrawer>
      )}
    </AppLayout>
  )
}
