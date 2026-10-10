'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, Trash2, Pencil, ChevronRight } from 'lucide-react'
import { productionApi } from '@/lib/api'
import { useToast } from '@/components/providers/ToastProvider'
import type { Factory } from '@/types'
import { materialNamesFromFactory } from '@/components/inventory/RawMaterialsPanel'
import { validateSingleComputedOutputs } from '@/lib/production-output-totals'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import { MobileCard } from '@/components/inventory/MobileList'

type RmDraft = {
  material_name: string
  unit: string
  allow_multi_lot: boolean
  lot_required: boolean
  max_lots: number
  stock_kind: 'rm' | 'sfg'
}

type StageDraft = {
  name: string
  capture_start_date: boolean
  capture_end_date: boolean
  capture_start_time: boolean
  capture_end_time: boolean
  capture_start_temp: boolean
  capture_end_temp: boolean
  capture_integrity: boolean
  lot_rm_material_name: string
}

type OutputDraft = {
  name: string
  is_computed: boolean
  sum_of: string[]
  requires_qc: boolean
  is_byproduct: boolean
}

type ProductRow = {
  id: string
  code: string
  name: string
  cas_number?: string | null
  coa_description_spec?: string | null
  coa_identification_spec?: string | null
  coa_specific_gravity_spec?: string | null
  coa_water_spec?: string | null
  coa_boiling_point_spec?: string | null
  coa_gc_purity_spec?: string | null
  coa_conclusion?: string | null
  coa_storage_condition?: string | null
  kind?: string
  is_active: boolean
  rms: Array<{ material_name: string; process?: string }>
  stages: Array<{ name: string; process?: string }>
  outputs: Array<{
    name: string
    is_computed?: boolean
    sum_of?: string[]
    requires_qc?: boolean
    is_byproduct?: boolean
    process?: string
  }>
}

const emptyRm = (): RmDraft => ({
  material_name: '',
  unit: 'Kg',
  allow_multi_lot: false,
  lot_required: true,
  max_lots: 2,
  stock_kind: 'rm',
})

const emptyStage = (): StageDraft => ({
  name: '',
  capture_start_date: true,
  capture_end_date: true,
  capture_start_time: true,
  capture_end_time: true,
  capture_start_temp: true,
  capture_end_temp: true,
  capture_integrity: false,
  lot_rm_material_name: '',
})

const emptyOutput = (): OutputDraft => ({
  name: '',
  is_computed: false,
  sum_of: [],
  requires_qc: true,
  is_byproduct: false,
})

/** Value typed after the fixed NMT / NLT prefix. */
function limitValue(raw: string, prefix: 'NMT' | 'NLT') {
  return raw.trim().replace(new RegExp(`^${prefix}\\s*`, 'i'), '').trim()
}

/** Stored specification: NMT 0.5% or NLT 99.0%. Empty stays empty. */
function limitSpec(raw: string, prefix: 'NMT' | 'NLT') {
  const value = limitValue(raw, prefix)
  return value ? `${prefix} ${value}` : null
}

function rangeParts(raw: string) {
  const text = raw.replace(/°C/gi, '').trim()
  const [min = '', max = ''] = text.split(/\s*[–—-]\s*/, 2)
  return { min: min.trim(), max: max.trim() }
}

/** Stored range: 1.82 – 1.83, or 196 – 200°C. */
function rangeSpec(min: string, max: string, suffix = '') {
  const from = min.trim()
  const to = max.trim()
  if (!from && !to) return ''
  if (from && to) return `${from} – ${to}${suffix}`
  return `${from || to}${suffix}`
}

function RangeSpecInput({
  min,
  max,
  onMin,
  onMax,
  minPlaceholder,
  maxPlaceholder,
  suffix,
}: {
  min: string
  max: string
  onMin: (value: string) => void
  onMax: (value: string) => void
  minPlaceholder: string
  maxPlaceholder: string
  suffix?: string
}) {
  return (
    <span className="flex overflow-hidden rounded-lg border border-border bg-panel focus-within:border-owner">
      <input
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
        inputMode="decimal"
        value={min}
        onChange={(e) => onMin(e.target.value)}
        placeholder={minPlaceholder}
        aria-label="From"
      />
      <span className="flex items-center text-muted">–</span>
      <input
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
        inputMode="decimal"
        value={max}
        onChange={(e) => onMax(e.target.value)}
        placeholder={maxPlaceholder}
        aria-label="To"
      />
      {suffix ? (
        <span className="flex items-center border-l border-border px-3 text-sm font-medium text-muted">
          {suffix}
        </span>
      ) : null}
    </span>
  )
}

function pickMasterName(master: string[], needles: string[], fallback: string): string {
  for (const needle of needles) {
    const hit = master.find((m) => m.toLowerCase().includes(needle.toLowerCase()))
    if (hit) return hit
  }
  return fallback
}

function timedStage(name: string, captureIntegrity = false): StageDraft {
  return {
    name,
    capture_start_date: !captureIntegrity,
    capture_end_date: !captureIntegrity,
    capture_start_time: !captureIntegrity,
    capture_end_time: !captureIntegrity,
    capture_start_temp: false,
    capture_end_temp: false,
    capture_integrity: captureIntegrity,
    lot_rm_material_name: '',
  }
}

function fgStarterRms(master: string[]): RmDraft[] {
  return [
    {
      material_name: 'Crude / semi-finished',
      unit: 'Kg',
      allow_multi_lot: true,
      lot_required: true,
      max_lots: 3,
      stock_kind: 'sfg',
    },
    {
      material_name: pickMasterName(master, ['sulphuric', 'sulfuric'], 'Sulphuric acid'),
      unit: 'Kg',
      allow_multi_lot: false,
      lot_required: true,
      max_lots: 2,
      stock_kind: 'rm',
    },
    {
      material_name: pickMasterName(master, ['caustic'], 'Caustic soda solution'),
      unit: 'Kg',
      allow_multi_lot: false,
      lot_required: true,
      max_lots: 2,
      stock_kind: 'rm',
    },
    {
      material_name: pickMasterName(master, ['soda ash'], 'Soda ash'),
      unit: 'Kg',
      allow_multi_lot: false,
      lot_required: true,
      max_lots: 2,
      stock_kind: 'rm',
    },
  ]
}

function emptyFgRm(): RmDraft {
  return { ...emptyRm(), stock_kind: 'rm' }
}

const STAGE_I_SULPHURIC_CODES = new Set(['2BB', 'IPBR', 'ALLYLBR', 'DBP'])

function isSulphuricLabel(label: string) {
  const n = label.trim().toLowerCase()
  return n.includes('sulphuric') || n.includes('sulfuric') || n === 's.acid' || n === 's. acid'
}

function templateProcess(
  row: {
    process?: string
    recipe_process?: string
    stock_kind?: string
    material_name?: string
    name?: string
  },
  productCode?: string,
): 'sfg' | 'fg' {
  if (row.recipe_process === 'fg' || row.process === 'fg') return 'fg'
  if (row.stock_kind === 'sfg') return 'fg'
  const label = String(row.material_name || row.name || '')
    .trim()
    .toLowerCase()
  if (
    label.includes('semi-finished') ||
    label.includes('caustic soda') ||
    label === 'soda ash' ||
    label.startsWith('washing of crude') ||
    label === 'by-product collection' ||
    label === 'filter integrity' ||
    label === 'collect in vessel' ||
    label === 'filtration' ||
    label === 'finish received' ||
    label === 'finished goods' ||
    label === 'by-product' ||
    label === 'high cut' ||
    label.includes('nabr')
  ) {
    return 'fg'
  }
  if (isSulphuricLabel(label)) {
    const code = (productCode || '').trim().toUpperCase()
    if (code && !STAGE_I_SULPHURIC_CODES.has(code)) return 'fg'
  }
  return 'sfg'
}

function isFilterIntegrityStage(name: string) {
  return /filter\s*integrity/i.test(name.trim())
}

function countByProcess(
  rows: Array<{
    process?: string
    recipe_process?: string
    stock_kind?: string
    material_name?: string
    name?: string
  }> | undefined,
  proc: 'sfg' | 'fg',
  productCode?: string,
) {
  return (rows || []).filter((r) => templateProcess(r, productCode) === proc).length
}

function applyFgStarter(master: string[]): {
  rms: RmDraft[]
  stages: StageDraft[]
  outputs: OutputDraft[]
} {
  return {
    rms: fgStarterRms(master),
    stages: [
      timedStage('Washing of crude'),
      timedStage('Filter integrity', true),
      timedStage('Filtration'),
    ],
    outputs: [
      { name: 'Finished goods', is_computed: false, sum_of: [], requires_qc: true, is_byproduct: false },
      { name: 'By-product', is_computed: false, sum_of: [], requires_qc: false, is_byproduct: true },
      { name: 'SD', is_computed: false, sum_of: [], requires_qc: false, is_byproduct: true },
      { name: 'HBr', is_computed: false, sum_of: [], requires_qc: false, is_byproduct: true },
      { name: 'HC', is_computed: false, sum_of: [], requires_qc: false, is_byproduct: true },
    ],
  }
}

function PipeStep({
  title,
  detail,
  ready,
}: {
  title: ReactNode
  detail: string
  ready: boolean
}) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 ${
        ready ? 'border-owner/30 bg-owner/10' : 'border-dashed border-border bg-muted/10'
      }`}
    >
      <p className="text-[11px] leading-tight text-muted">{title}</p>
      <p className={`mt-0.5 truncate text-xs ${ready ? 'text-primary' : 'text-muted'}`}>{detail}</p>
    </div>
  )
}

export default function ProductionTemplatesPanel({
  factories,
  assignedFactoryIds,
}: {
  factories: Factory[]
  assignedFactoryIds: string[]
}) {
  const toast = useToast()
  const [factoryId, setFactoryId] = useState('')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [casNumber, setCasNumber] = useState('')
  const [coaDescriptionSpec, setCoaDescriptionSpec] = useState('')
  const [coaIdentificationSpec, setCoaIdentificationSpec] = useState('')
  const [coaSpecificGravitySpec, setCoaSpecificGravitySpec] = useState('')
  const [coaWaterSpec, setCoaWaterSpec] = useState('')
  const [coaBoilingPointSpec, setCoaBoilingPointSpec] = useState('')
  const [coaGcPuritySpec, setCoaGcPuritySpec] = useState('')
  const [coaConclusion, setCoaConclusion] = useState('')
  const [coaStorageCondition, setCoaStorageCondition] = useState('')
  const [processTab, setProcessTab] = useState<'sfg' | 'fg'>('sfg')
  const [isActive, setIsActive] = useState(true)
  const [sfgRms, setSfgRms] = useState<RmDraft[]>([emptyRm()])
  const [fgRms, setFgRms] = useState<RmDraft[]>([])
  const [sfgStages, setSfgStages] = useState<StageDraft[]>([emptyStage()])
  const [fgStages, setFgStages] = useState<StageDraft[]>([])
  const [sfgOutputs, setSfgOutputs] = useState<OutputDraft[]>([emptyOutput()])
  const [fgOutputs, setFgOutputs] = useState<OutputDraft[]>([])
  const [sfgLocked, setSfgLocked] = useState(false)
  const [fgLocked, setFgLocked] = useState(false)

  const rms = processTab === 'fg' ? fgRms : sfgRms
  const setRms = processTab === 'fg' ? setFgRms : setSfgRms
  const stages = processTab === 'fg' ? fgStages : sfgStages
  const setStages = processTab === 'fg' ? setFgStages : setSfgStages
  const outputs = processTab === 'fg' ? fgOutputs : sfgOutputs
  const setOutputs = processTab === 'fg' ? setFgOutputs : setSfgOutputs
  const processLocked = processTab === 'fg' ? fgLocked : sfgLocked
  const hasBatches = processLocked

  const visibleFactories = factories.filter(
    (f) => assignedFactoryIds.includes(f.id) || assignedFactoryIds.length === 0,
  )

  const selectedFactory = useMemo(
    () => factories.find((f) => f.id === factoryId) ?? null,
    [factories, factoryId],
  )
  const masterMaterials = useMemo(
    () => materialNamesFromFactory(selectedFactory),
    [selectedFactory],
  )

  const shownProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.cas_number || '').toLowerCase().includes(q),
    )
  }, [products, query])

  /** Multi-lot RMs available for in-process lot addition (e.g. Bromine). */
  const multiLotMaterials = useMemo(
    () =>
      rms
        .filter((r) => r.allow_multi_lot && r.material_name.trim())
        .map((r) => r.material_name.trim()),
    [rms],
  )

  function resolveInProcessLotMaterial(stageName: string): string {
    if (multiLotMaterials.length === 0) return ''
    const bromine = multiLotMaterials.find((m) =>
      m.toLowerCase().includes('bromine'),
    )
    if (bromine) return bromine
    const stageLower = stageName.toLowerCase()
    const named = multiLotMaterials.find((m) =>
      stageLower.includes(m.toLowerCase()),
    )
    if (named) return named
    return multiLotMaterials[0]
  }

  const reload = useCallback(async () => {
    if (!factoryId) {
      setProducts([])
      return
    }
    setLoading(true)
    const data = await productionApi.listProducts(factoryId, false)
    if (data.error) toast.error(data.error)
    setProducts((data.products ?? []) as ProductRow[])
    setLoading(false)
  }, [factoryId])

  useEffect(() => {
    if (!factoryId && visibleFactories.length === 1) {
      setFactoryId(visibleFactories[0].id)
    }
  }, [factoryId, visibleFactories])

  useEffect(() => {
    void reload()
  }, [reload])

  function resetForm() {
    setEditingId(null)
    setShowForm(false)
    setCode('')
    setName('')
    setCasNumber('')
    setCoaDescriptionSpec('')
    setCoaIdentificationSpec('')
    setCoaSpecificGravitySpec('')
    setCoaWaterSpec('')
    setCoaBoilingPointSpec('')
    setCoaGcPuritySpec('')
    setCoaConclusion('')
    setCoaStorageCondition('')
    setProcessTab('sfg')
    setIsActive(true)
    setSfgRms([emptyRm()])
    setFgRms([])
    setSfgStages([emptyStage()])
    setFgStages([])
    setSfgOutputs([emptyOutput()])
    setFgOutputs([])
    setSfgLocked(false)
    setFgLocked(false)
  }

  async function startEdit(id: string) {
    const data = await productionApi.getProduct(id)
    if (data.error || !data.product) {
      toast.error(data.error || 'Product not found')
      return
    }
    const p = data.product
    setEditingId(p.id)
    setShowForm(true)
    setCode(p.code)
    setName(p.name)
    setCasNumber(String(p.cas_number || ''))
    setCoaDescriptionSpec(String(p.coa_description_spec || ''))
    setCoaIdentificationSpec(String(p.coa_identification_spec || ''))
    setCoaSpecificGravitySpec(String(p.coa_specific_gravity_spec || ''))
    setCoaWaterSpec(limitValue(String(p.coa_water_spec || ''), 'NMT'))
    setCoaBoilingPointSpec(String(p.coa_boiling_point_spec || ''))
    setCoaGcPuritySpec(limitValue(String(p.coa_gc_purity_spec || ''), 'NLT'))
    setCoaConclusion(String(p.coa_conclusion || ''))
    setCoaStorageCondition(String(p.coa_storage_condition || ''))
    setProcessTab('sfg')
    setIsActive(p.is_active !== false)
    const mapRm = (
      r: RmDraft & { id?: string; max_lots?: number; material_name?: string; process?: string },
    ): RmDraft => {
      let materialName = String(r.material_name || '').trim()
      if (!materialName) {
        const linkedStage = (p.stages || []).find(
          (s: { lot_rm_def_id?: string | null; name?: string }) =>
            Boolean(r.id) && s.lot_rm_def_id === r.id,
        )
        if (linkedStage?.name) {
          materialName =
            String(linkedStage.name).replace(/\s+addition$/i, '').trim() ||
            String(linkedStage.name)
        }
      }
      return {
        material_name: materialName,
        unit: r.unit || 'Kg',
        allow_multi_lot: Boolean(r.allow_multi_lot),
        lot_required: r.lot_required !== false,
        max_lots: Number(r.max_lots ?? 2) || 2,
        stock_kind: r.stock_kind === 'sfg' ? 'sfg' : 'rm',
      }
    }
    const mapStage = (
      s: StageDraft & {
        lot_rm_def_id?: string | null
        lot_rm_material_name?: string
        process?: string
      },
      processRms: Array<RmDraft & { id?: string; material_name?: string }>,
    ): StageDraft => {
      const linked = processRms.find(
        (r) => Boolean(s.lot_rm_def_id) && r.id === s.lot_rm_def_id,
      )
      return {
        name: s.name,
        capture_start_date: s.capture_start_date !== false,
        capture_end_date: s.capture_end_date !== false,
        capture_start_time: s.capture_start_time !== false,
        capture_end_time: s.capture_end_time !== false,
        capture_start_temp: s.capture_start_temp !== false,
        capture_end_temp: s.capture_end_temp !== false,
        capture_integrity: Boolean(s.capture_integrity),
        lot_rm_material_name: s.lot_rm_material_name || linked?.material_name || '',
      }
    }
    const mapOut = (
      o: OutputDraft & {
        sum_of?: string[]
        is_computed?: boolean
        requires_qc?: boolean
        is_byproduct?: boolean
        process?: string
      },
    ): OutputDraft => {
      const isByproduct =
        Boolean(o.is_byproduct) ||
        (o.is_byproduct == null && o.requires_qc === false)
      return {
        name: o.name,
        is_computed: Boolean(o.is_computed) || (o.sum_of?.length ?? 0) > 0,
        sum_of: Array.isArray(o.sum_of) ? o.sum_of.map(String) : [],
        requires_qc: isByproduct ? false : o.requires_qc !== false,
        is_byproduct: isByproduct,
      }
    }
    const productCode = String(p.code || '')
    const sfgR = (p.sfg_rms || p.rms || []).filter(
      (r: Parameters<typeof templateProcess>[0]) => templateProcess(r, productCode) !== 'fg',
    )
    const fgR = (p.fg_rms || p.rms || []).filter(
      (r: Parameters<typeof templateProcess>[0]) => templateProcess(r, productCode) === 'fg',
    )
    setSfgRms(sfgR.length ? sfgR.map(mapRm) : [emptyRm()])
    setFgRms(fgR.length ? fgR.map(mapRm) : [])
    const sfgS = (p.sfg_stages || p.stages || []).filter(
      (s: Parameters<typeof templateProcess>[0]) => templateProcess(s, productCode) !== 'fg',
    )
    const fgS = (p.fg_stages || p.stages || []).filter(
      (s: Parameters<typeof templateProcess>[0]) => templateProcess(s, productCode) === 'fg',
    )
    setSfgStages(sfgS.length ? sfgS.map((s) => mapStage(s, sfgR)) : [emptyStage()])
    setFgStages(fgS.length ? fgS.map((s) => mapStage(s, fgR)) : [])
    const sfgO = (p.sfg_outputs || p.outputs || []).filter(
      (o: Parameters<typeof templateProcess>[0]) => templateProcess(o, productCode) !== 'fg',
    )
    const fgO = (p.fg_outputs || p.outputs || []).filter(
      (o: Parameters<typeof templateProcess>[0]) => templateProcess(o, productCode) === 'fg',
    )
    setSfgOutputs(sfgO.length ? sfgO.map(mapOut) : [emptyOutput()])
    setFgOutputs(fgO.length ? fgO.map(mapOut) : [])

    const batches = await productionApi.listBatches(factoryId, { product_id: id })
    const rows = batches.batches ?? []
    setSfgLocked(rows.some((b: { kind?: string }) => b.kind !== 'fg'))
    setFgLocked(rows.some((b: { kind?: string }) => b.kind === 'fg'))
  }

  async function save() {
    if (!factoryId) {
      toast.error('Select a factory')
      return
    }
    if (!code.trim() || !name.trim()) {
      toast.error('Code and name are required')
      return
    }
    const pack = (
      proc: 'sfg' | 'fg',
      srcRms: RmDraft[],
      srcStages: StageDraft[],
      srcOutputs: OutputDraft[],
    ) => {
      const cleanRms = srcRms
        .map((r) => ({
          ...r,
          material_name: r.material_name.trim(),
          process: proc,
          stock_kind: proc === 'sfg' ? 'rm' : r.stock_kind === 'sfg' ? 'sfg' : 'rm',
        }))
        .filter((r) => r.material_name)
      const cleanStages = srcStages
        .map((s) => ({
          ...s,
          name: s.name.trim(),
          process: proc,
          lot_rm_material_name: proc === 'sfg' ? s.lot_rm_material_name : '',
          capture_integrity: isFilterIntegrityStage(s.name),
          ...(isFilterIntegrityStage(s.name)
            ? {
                capture_start_date: false,
                capture_end_date: false,
                capture_start_time: false,
                capture_end_time: false,
                capture_start_temp: false,
                capture_end_temp: false,
              }
            : {}),
        }))
        .filter((s) => s.name)
      const cleanOutputs = srcOutputs
        .map((o) => ({
          name: o.name.trim(),
          is_computed: Boolean(o.is_computed) || o.sum_of.length > 0,
          sum_of: o.sum_of
            .map((n) => n.trim())
            .filter((n) => n && n.toLowerCase() !== o.name.trim().toLowerCase()),
          requires_qc: o.is_byproduct ? false : o.requires_qc !== false,
          is_byproduct: Boolean(o.is_byproduct),
          process: proc,
        }))
        .filter((o) => o.name)
      return { cleanRms, cleanStages, cleanOutputs }
    }
    const sfgPack = pack('sfg', sfgRms, sfgStages, sfgOutputs)
    const fgPack = pack('fg', fgRms, fgStages, fgOutputs)
    if (!sfgLocked && sfgPack.cleanRms.length === 0) {
      toast.error('Add at least one raw material on Raw → semi-finished')
      return
    }
    for (const r of [...sfgPack.cleanRms, ...fgPack.cleanRms]) {
      if (
        r.stock_kind !== 'sfg' &&
        masterMaterials.length > 0 &&
        !masterMaterials.some((m) => m.toLowerCase() === r.material_name.toLowerCase())
      ) {
        toast.error(
          `"${r.material_name}" is not in Raw materials master. Add it under Management → Raw materials first.`,
        )
        return
      }
    }
    const outputErr =
      validateSingleComputedOutputs(sfgPack.cleanOutputs) ||
      validateSingleComputedOutputs(fgPack.cleanOutputs)
    if (outputErr) {
      toast.error(outputErr)
      return
    }

    const allRms = [...sfgPack.cleanRms, ...fgPack.cleanRms]
    const allStages = [...sfgPack.cleanStages, ...fgPack.cleanStages]
    const allOutputs = [...sfgPack.cleanOutputs, ...fgPack.cleanOutputs]
    const bothLocked = sfgLocked && fgLocked

    setSaving(true)
    if (editingId) {
      const payload: Parameters<typeof productionApi.updateProduct>[1] = {
        code: code.trim(),
        name: name.trim(),
        is_active: isActive,
        cas_number: casNumber.trim() || null,
        coa_description_spec: coaDescriptionSpec.trim() || null,
        coa_identification_spec: coaIdentificationSpec.trim() || null,
        coa_specific_gravity_spec: coaSpecificGravitySpec.trim() || null,
        coa_water_spec: limitSpec(coaWaterSpec, 'NMT'),
        coa_boiling_point_spec: coaBoilingPointSpec.trim() || null,
        coa_gc_purity_spec: limitSpec(coaGcPuritySpec, 'NLT'),
        coa_conclusion: coaConclusion.trim() || null,
        coa_storage_condition: coaStorageCondition.trim() || null,
      }
      if (!bothLocked) {
        payload.rms = allRms
        payload.stages = allStages
        payload.outputs = allOutputs
      } else {
        payload.output_formulas = allOutputs.map((o) => ({
          name: o.name,
          is_computed: o.is_computed,
          sum_of: o.sum_of,
          requires_qc: o.requires_qc,
          is_byproduct: o.is_byproduct,
        }))
      }
      const data = await productionApi.updateProduct(editingId, payload)
      setSaving(false)
      if (data.error) {
        toast.error(data.error)
        return
      }
      toast.success(
        bothLocked
          ? 'Product updated (RMs/stages locked — finish totals & QC flags saved)'
          : 'Product updated',
      )
    } else {
      const data = await productionApi.createProduct({
        factory_id: factoryId,
        code: code.trim(),
        name: name.trim(),
        is_active: isActive,
        cas_number: casNumber.trim() || null,
        coa_description_spec: coaDescriptionSpec.trim() || null,
        coa_identification_spec: coaIdentificationSpec.trim() || null,
        coa_specific_gravity_spec: coaSpecificGravitySpec.trim() || null,
        coa_water_spec: limitSpec(coaWaterSpec, 'NMT'),
        coa_boiling_point_spec: coaBoilingPointSpec.trim() || null,
        coa_gc_purity_spec: limitSpec(coaGcPuritySpec, 'NLT'),
        coa_conclusion: coaConclusion.trim() || null,
        coa_storage_condition: coaStorageCondition.trim() || null,
        rms: allRms,
        stages: allStages,
        outputs: allOutputs,
      })
      setSaving(false)
      if (data.error) {
        toast.error(data.error)
        return
      }
      toast.success('Product template created')
    }
    resetForm()
    await reload()
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          id="factory"
          aria-label="Factory"
          className="input-field owner-focus w-full py-2 sm:max-w-xs"
          value={factoryId}
          onChange={(e) => {
            setFactoryId(e.target.value)
            resetForm()
          }}
        >
          <option value="">Select factory</option>
          {visibleFactories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {factoryId ? (
          <input
            className="input-field owner-focus w-full min-w-0 flex-1 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or name"
          />
        ) : null}
        <button
          type="button"
          className="btn btn-owner inline-flex w-full items-center justify-center gap-2 sm:ml-auto sm:w-auto"
          disabled={!factoryId}
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
        >
          <Plus size={16} />
          Add product
        </button>
      </div>

      <p className="mb-4 text-xs text-muted">
        Each product has two recipes: raw material to semi-finished, then semi-finished to finished. They stay separate.
      </p>

      {!factoryId ? (
        <p className="text-sm text-muted">Choose a factory to see recipes.</p>
      ) : loading ? (
        <p className="text-sm text-muted">Loading products…</p>
      ) : (
        <>
          {masterMaterials.length === 0 && (
            <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              No raw materials for this factory yet. Add them under{' '}
              <strong>Plant → Raw materials</strong> before creating products.
            </p>
          )}

          {shownProducts.length === 0 ? (
            <p className="px-1 py-8 text-sm text-muted">
              {products.length === 0 ? 'No products yet.' : 'No products match that search.'}
            </p>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {shownProducts.map((p) => {
                const sfgRm = countByProcess(p.rms, 'sfg', p.code)
                const sfgSt = countByProcess(p.stages, 'sfg', p.code)
                const fgRm = countByProcess(p.rms, 'fg', p.code)
                const fgSt = countByProcess(p.stages, 'fg', p.code)
                const sfgReady = sfgRm > 0 && sfgSt > 0
                const fgReady = fgRm > 0 && fgSt > 0
                const status = !p.is_active
                  ? 'Inactive'
                  : sfgReady && fgReady
                    ? 'Ready'
                    : 'Incomplete'
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void startEdit(p.id)}
                    className="w-full text-left"
                  >
                    <MobileCard
                      id={p.code}
                      title={p.name}
                      aside={
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            status === 'Ready'
                              ? 'bg-owner/15 text-owner'
                              : status === 'Inactive'
                                ? 'bg-muted/30 text-muted'
                                : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                          }`}
                        >
                          {status}
                        </span>
                      }
                      rows={[
                        {
                          label: 'Raw → Semi-finished',
                          value: sfgReady ? `${sfgRm} RM · ${sfgSt} stages` : 'Not set',
                        },
                        {
                          label: 'Semi-finished → Finished',
                          value: fgReady ? `${fgRm} in · ${fgSt} stages` : 'Not set',
                        },
                      ]}
                    />
                  </button>
                )
              })}
            </div>
            <div className="hidden space-y-2 md:block">
              {shownProducts.map((p) => {
                const sfgRm = countByProcess(p.rms, 'sfg', p.code)
                const sfgSt = countByProcess(p.stages, 'sfg', p.code)
                const fgRm = countByProcess(p.rms, 'fg', p.code)
                const fgSt = countByProcess(p.stages, 'fg', p.code)
                const sfgReady = sfgRm > 0 && sfgSt > 0
                const fgReady = fgRm > 0 && fgSt > 0
                const status = !p.is_active
                  ? 'Inactive'
                  : sfgReady && fgReady
                    ? 'Ready'
                    : 'Incomplete'
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void startEdit(p.id)}
                    className="w-full rounded-xl border border-border p-4 text-left transition-colors hover:border-owner/40 hover:bg-owner/[0.03]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-primary">
                          <span className="font-mono">{p.code}</span>
                          <span className="font-normal text-muted"> · {p.name}</span>
                        </p>
                        {p.cas_number ? (
                          <p className="mt-0.5 truncate text-xs text-muted">CAS {p.cas_number}</p>
                        ) : null}
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                          status === 'Ready'
                            ? 'bg-owner/15 text-owner'
                            : status === 'Inactive'
                              ? 'bg-muted/30 text-muted'
                              : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PipeStep
                        title={
                          <>
                            Raw
                            <span className="block">→ Semi-finished</span>
                          </>
                        }
                        detail={sfgReady ? `${sfgRm} RM · ${sfgSt} stages` : 'Not set'}
                        ready={sfgReady}
                      />
                      <ChevronRight size={16} className="flex-shrink-0 text-muted" />
                      <PipeStep
                        title={
                          <>
                            Semi-finished
                            <span className="block">→ Finished</span>
                          </>
                        }
                        detail={fgReady ? `${fgRm} in · ${fgSt} stages` : 'Not set'}
                        ready={fgReady}
                      />
                      <span className="hidden items-center gap-1 text-sm text-owner sm:inline-flex">
                        <Pencil size={14} />
                        Edit
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            </>
          )}

          {showForm && (
            <MgmtDrawer
              size="lg"
              eyebrow="Recipes"
              title={editingId ? 'Edit product' : 'New product'}
              onClose={resetForm}
              footer={
                <>
                  <button type="button" className="btn btn-ghost" onClick={resetForm}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save()}
                    className="btn btn-owner"
                  >
                    {saving ? 'Saving…' : editingId ? 'Save product' : 'Create product'}
                  </button>
                </>
              }
            >
              <div className="space-y-5">

              {hasBatches && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  This process already has batches — its materials and stages are read-only.
                  The other process is still editable. COA details and output formulas can still be saved.
                </p>
              )}

              <div>
                <span className="mb-1 block text-sm text-muted">Recipe to edit</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      {
                        key: 'sfg' as const,
                        label: 'Raw → semi-finished',
                        hint: `${sfgRms.filter((r) => r.material_name.trim()).length} RMs · ${sfgStages.filter((s) => s.name.trim()).length} stages`,
                      },
                      {
                        key: 'fg' as const,
                        label: 'Semi-finished → finished',
                        hint: `${fgRms.filter((r) => r.material_name.trim()).length} inputs · ${fgStages.filter((s) => s.name.trim()).length} stages`,
                      },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`rounded-lg px-3 py-2 text-left text-sm ${
                        processTab === t.key
                          ? 'bg-owner text-white'
                          : 'border border-border text-muted'
                      }`}
                      onClick={() => {
                        setProcessTab(t.key)
                        if (
                          t.key === 'fg' &&
                          fgRms.every((r) => !r.material_name.trim()) &&
                          fgStages.every((s) => !s.name.trim())
                        ) {
                          const starter = applyFgStarter(masterMaterials)
                          setFgRms(starter.rms)
                          setFgStages(starter.stages)
                          setFgOutputs(starter.outputs)
                        }
                      }}
                    >
                      <span className="block">{t.label}</span>
                      <span
                        className={`block text-[11px] ${
                          processTab === t.key ? 'text-white/80' : 'text-muted'
                        }`}
                      >
                        {t.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {processTab === 'fg'
                    ? 'Editing Stage II only. Stage I raw materials and stages are unchanged.'
                    : 'Editing Stage I only. Stage II crude, wash chemicals, and stages are unchanged.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Code</span>
                  <input
                    className="input-field owner-focus font-mono"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="NPBR"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Name</span>
                  <input
                    className="input-field owner-focus"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="AFC NPBR"
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active (shown to chemists)
              </label>

              <section className="space-y-3 rounded-xl border border-border p-4">
                <div>
                  <h4 className="text-sm font-medium">COA</h4>
                  <p className="mt-0.5 text-xs text-muted">
                    Specification limits for this product’s certificate, entered while configuring the recipe.
                  </p>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">CAS</span>
                  <input
                    className="input-field owner-focus font-mono"
                    value={casNumber}
                    onChange={(e) => setCasNumber(e.target.value)}
                    placeholder="110-52-1"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Description specification</span>
                  <textarea
                    className="input-field owner-focus min-h-20"
                    value={coaDescriptionSpec}
                    onChange={(e) => setCoaDescriptionSpec(e.target.value)}
                    placeholder="Colourless to pale yellow liquid"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Identification specification</span>
                  <textarea
                    className="input-field owner-focus min-h-20"
                    value={coaIdentificationSpec}
                    onChange={(e) => setCoaIdentificationSpec(e.target.value)}
                    placeholder="The retention time of the major peak in the sample chromatogram should match with that of the standard chromatogram."
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Specific gravity specification</span>
                    <RangeSpecInput
                      min={rangeParts(coaSpecificGravitySpec).min}
                      max={rangeParts(coaSpecificGravitySpec).max}
                      onMin={(value) =>
                        setCoaSpecificGravitySpec(
                          rangeSpec(value, rangeParts(coaSpecificGravitySpec).max),
                        )
                      }
                      onMax={(value) =>
                        setCoaSpecificGravitySpec(
                          rangeSpec(rangeParts(coaSpecificGravitySpec).min, value),
                        )
                      }
                      minPlaceholder="1.82"
                      maxPlaceholder="1.83"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Water content specification</span>
                    <span className="flex overflow-hidden rounded-lg border border-border bg-panel focus-within:border-owner">
                      <span className="flex items-center border-r border-border px-3 text-sm font-medium text-muted">
                        NMT
                      </span>
                      <input
                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                        value={limitValue(coaWaterSpec, 'NMT')}
                        onChange={(e) => setCoaWaterSpec(limitValue(e.target.value, 'NMT'))}
                        placeholder="0.5%"
                      />
                    </span>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">Boiling point specification</span>
                    <RangeSpecInput
                      min={rangeParts(coaBoilingPointSpec).min}
                      max={rangeParts(coaBoilingPointSpec).max}
                      onMin={(value) =>
                        setCoaBoilingPointSpec(
                          rangeSpec(value, rangeParts(coaBoilingPointSpec).max, '°C'),
                        )
                      }
                      onMax={(value) =>
                        setCoaBoilingPointSpec(
                          rangeSpec(rangeParts(coaBoilingPointSpec).min, value, '°C'),
                        )
                      }
                      minPlaceholder="196"
                      maxPlaceholder="200"
                      suffix="°C"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted">GC purity specification</span>
                    <span className="flex overflow-hidden rounded-lg border border-border bg-panel focus-within:border-owner">
                      <span className="flex items-center border-r border-border px-3 text-sm font-medium text-muted">
                        NLT
                      </span>
                      <input
                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                        value={limitValue(coaGcPuritySpec, 'NLT')}
                        onChange={(e) => setCoaGcPuritySpec(limitValue(e.target.value, 'NLT'))}
                        placeholder="99.0%"
                      />
                    </span>
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Conclusion</span>
                  <textarea
                    className="input-field owner-focus min-h-20"
                    value={coaConclusion}
                    onChange={(e) => setCoaConclusion(e.target.value)}
                    placeholder="The above product conforms to the specification."
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Storage condition</span>
                  <textarea
                    className="input-field owner-focus min-h-20"
                    value={coaStorageCondition}
                    onChange={(e) => setCoaStorageCondition(e.target.value)}
                    placeholder="Store in a cool and dry place."
                  />
                </label>
              </section>

              <div key={processTab} className="space-y-5">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">
                      {processTab === 'fg' ? 'Stage II inputs' : 'Stage I raw materials'}
                    </h4>
                    <p className="mt-0.5 text-xs text-muted">
                      {hasBatches
                        ? 'Locked because batches exist — view only.'
                        : processTab === 'fg'
                          ? 'Only this recipe: crude lots from warehouse SFG plus wash chemicals from warehouse RM.'
                          : 'Only this recipe: factory RM master. Multi-lot adds Lot 1…N on the chemist form.'}
                    </p>
                  </div>
                  {!hasBatches && (
                    <button
                      type="button"
                      className="text-xs font-medium text-owner hover:underline"
                      onClick={() =>
                        setRms((r) => [
                          ...r,
                          processTab === 'fg' ? emptyFgRm() : emptyRm(),
                        ])
                      }
                    >
                      {processTab === 'fg' ? '+ Add input' : '+ Add RM'}
                    </button>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <div
                    className={`hidden gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted sm:grid ${
                      hasBatches
                        ? 'grid-cols-[minmax(0,1.4fr)_4.5rem_5.5rem_5.5rem_5.5rem]'
                        : 'grid-cols-[minmax(0,1.4fr)_4.5rem_5.5rem_5.5rem_5.5rem_2.25rem]'
                    }`}
                  >
                    <span>Material</span>
                    <span>Unit</span>
                    <span className="text-center">Lot required</span>
                    <span className="text-center">Multi-lot</span>
                    <span className="text-center">Max lots</span>
                    {!hasBatches && <span />}
                  </div>

                  <div className="divide-y divide-border">
                    {rms.length === 0 ? (
                      <p className="px-4 py-5 text-sm text-muted">No raw materials added.</p>
                    ) : (
                      rms.map((r, i) => {
                        const options = [...masterMaterials]
                        if (r.material_name && !options.includes(r.material_name)) {
                          options.unshift(r.material_name)
                        }
                        return (
                          <div
                            key={i}
                            className={`grid grid-cols-1 gap-3 px-3 py-3 sm:items-center sm:gap-2 ${
                              hasBatches
                                ? 'sm:grid-cols-[minmax(0,1.4fr)_4.5rem_5.5rem_5.5rem_5.5rem]'
                                : 'sm:grid-cols-[minmax(0,1.4fr)_4.5rem_5.5rem_5.5rem_5.5rem_2.25rem]'
                            }`}
                          >
                            <div className="min-w-0 space-y-2">
                              {processTab === 'fg' && (
                                <label className="block">
                                  <span className="mb-1 block text-[11px] text-muted">
                                    Warehouse source
                                  </span>
                                  <select
                                    className="input-field owner-focus w-full"
                                    value={r.stock_kind}
                                    disabled={hasBatches}
                                    onChange={(e) =>
                                      setRms((rows) =>
                                        rows.map((x, j) =>
                                          j === i
                                            ? {
                                                ...x,
                                                stock_kind:
                                                  e.target.value === 'sfg' ? 'sfg' : 'rm',
                                                allow_multi_lot:
                                                  e.target.value === 'sfg'
                                                    ? true
                                                    : x.allow_multi_lot,
                                                max_lots:
                                                  e.target.value === 'sfg'
                                                    ? Math.max(x.max_lots, 3)
                                                    : x.max_lots,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  >
                                    <option value="sfg">Semi-finished (crude lots)</option>
                                    <option value="rm">Raw material</option>
                                  </select>
                                </label>
                              )}
                              <label className="block min-w-0">
                              <span className="mb-1 block text-[11px] text-muted sm:sr-only">
                                Material
                              </span>
                              {processTab === 'fg' && r.stock_kind === 'sfg' ? (
                                <input
                                  className="input-field owner-focus w-full"
                                  value={r.material_name}
                                  disabled={hasBatches}
                                  placeholder="Crude / semi-finished"
                                  onChange={(e) =>
                                    setRms((rows) =>
                                      rows.map((x, j) =>
                                        j === i ? { ...x, material_name: e.target.value } : x,
                                      ),
                                    )
                                  }
                                />
                              ) : (
                              <select
                                className="input-field owner-focus w-full"
                                value={r.material_name}
                                disabled={hasBatches}
                                onChange={(e) =>
                                  setRms((rows) =>
                                    rows.map((x, j) =>
                                      j === i ? { ...x, material_name: e.target.value } : x,
                                    ),
                                  )
                                }
                              >
                                <option value="">Select…</option>
                                {options.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              )}
                              </label>
                            </div>

                            <label className="block">
                              <span className="mb-1 block text-[11px] text-muted sm:sr-only">
                                Unit
                              </span>
                              <input
                                className="input-field owner-focus w-full"
                                value={r.unit}
                                disabled={hasBatches}
                                onChange={(e) =>
                                  setRms((rows) =>
                                    rows.map((x, j) =>
                                      j === i ? { ...x, unit: e.target.value } : x,
                                    ),
                                  )
                                }
                              />
                            </label>

                            <label className="flex items-center gap-2 text-sm sm:justify-center">
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--owner,#c45c26)]"
                                checked={r.lot_required}
                                disabled={hasBatches}
                                onChange={(e) =>
                                  setRms((rows) =>
                                    rows.map((x, j) =>
                                      j === i ? { ...x, lot_required: e.target.checked } : x,
                                    ),
                                  )
                                }
                              />
                              <span className="sm:sr-only">Lot required</span>
                            </label>

                            <label className="flex items-center gap-2 text-sm sm:justify-center">
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--owner,#c45c26)]"
                                checked={r.allow_multi_lot}
                                disabled={hasBatches}
                                onChange={(e) =>
                                  setRms((rows) =>
                                    rows.map((x, j) =>
                                      j === i ? { ...x, allow_multi_lot: e.target.checked } : x,
                                    ),
                                  )
                                }
                              />
                              <span className="sm:sr-only">Multi-lot</span>
                            </label>

                            <div className="flex items-center sm:justify-center">
                              {r.allow_multi_lot ? (
                                <label className="flex w-full items-center gap-2 sm:w-auto sm:block">
                                  <span className="text-[11px] text-muted sm:sr-only">
                                    Max lots
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    className="input-field owner-focus w-16 text-center"
                                    value={r.max_lots}
                                    disabled={hasBatches}
                                    onChange={(e) =>
                                      setRms((rows) =>
                                        rows.map((x, j) =>
                                          j === i
                                            ? {
                                                ...x,
                                                max_lots: Number(e.target.value) || 2,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                              ) : (
                                <span className="text-sm text-muted/50">—</span>
                              )}
                            </div>

                            {!hasBatches && (
                              <div className="flex justify-end sm:justify-center">
                                <button
                                  type="button"
                                  className="rounded-md p-1.5 text-muted hover:bg-red-500/10 hover:text-red-500"
                                  onClick={() =>
                                    setRms((rows) => rows.filter((_, j) => j !== i))
                                  }
                                  aria-label="Remove raw material"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">
                      {processTab === 'fg'
                        ? 'Stage II process stages'
                        : 'Stage I process stages'}
                    </h4>
                    <p className="mt-0.5 text-xs text-muted">
                      {hasBatches
                        ? 'Locked because batches exist — view only.'
                        : processTab === 'fg'
                          ? 'Only Stage II steps. Ok / Not Ok is recorded on the Filter integrity step only.'
                          : 'Only Stage I steps. Check “In-process lot addition” for Bromine (multi-lot) additions.'}
                    </p>
                  </div>
                  {!hasBatches && (
                    <button
                      type="button"
                      className="text-xs text-owner hover:underline"
                      onClick={() => setStages((s) => [...s, emptyStage()])}
                    >
                      + Add stage
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {stages.length === 0 ? (
                    <p className="rounded-xl border border-border px-4 py-5 text-sm text-muted">
                      No process stages.
                    </p>
                  ) : (
                    stages.map((s, i) => {
                      const lotOn = Boolean(s.lot_rm_material_name.trim())
                      const lotMaterial =
                        s.lot_rm_material_name.trim() ||
                        resolveInProcessLotMaterial(s.name)
                      const canLotAdd = multiLotMaterials.length > 0
                      return (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-surface/40 px-3 py-3"
                        >
                          <div className="flex gap-2">
                            <input
                              className="input-field owner-focus flex-1 min-w-[10rem]"
                              placeholder="Stage name"
                              value={s.name}
                              disabled={hasBatches}
                              onChange={(e) =>
                                setStages((rows) =>
                                  rows.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          name: e.target.value,
                                          capture_integrity: isFilterIntegrityStage(
                                            e.target.value,
                                          ),
                                          lot_rm_material_name: x.lot_rm_material_name
                                            ? resolveInProcessLotMaterial(e.target.value) ||
                                              x.lot_rm_material_name
                                            : '',
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                            {!hasBatches && (
                              <button
                                type="button"
                                className="text-muted hover:text-red-500"
                                onClick={() =>
                                  setStages((rows) => rows.filter((_, j) => j !== i))
                                }
                                aria-label={`Remove stage ${i + 1}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          {processTab === 'sfg' && (
                          <label
                            className={`mt-2 inline-flex items-center gap-2 text-xs ${
                              hasBatches || !canLotAdd ? 'opacity-50' : ''
                            }`}
                            title={
                              hasBatches
                                ? 'Locked because batches exist'
                                : canLotAdd
                                  ? 'Repeat this stage once per lot of the multi-lot material (usually Bromine)'
                                  : 'Enable multi-lot on a raw material (e.g. Bromine) first'
                            }
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--owner,#c45c26)]"
                              disabled={hasBatches || !canLotAdd}
                              checked={lotOn}
                              onChange={(e) =>
                                setStages((rows) =>
                                  rows.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          lot_rm_material_name: e.target.checked
                                            ? resolveInProcessLotMaterial(x.name)
                                            : '',
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                            In-process lot addition
                            {lotOn && lotMaterial ? (
                              <span className="text-muted">· {lotMaterial}</span>
                            ) : null}
                          </label>
                          )}
                          {processTab === 'fg' && isFilterIntegrityStage(s.name) && (
                            <p className="mt-2 text-xs text-muted">
                              Chemist records Ok / Not Ok on this step only.
                            </p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">
                      {processTab === 'fg'
                        ? 'Stage II finished outputs'
                        : 'Stage I semi-finished outputs'}
                    </h4>
                    <p className="mt-0.5 text-xs text-muted">
                      At most one finish / total can be computed = sum of the other outputs.
                      Chemist enters components; the total stays read-only.
                    </p>
                  </div>
                  {!hasBatches && (
                    <button
                      type="button"
                      className="text-xs text-owner hover:underline"
                      onClick={() => setOutputs((o) => [...o, emptyOutput()])}
                    >
                      + Add output
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {outputs.map((o, i) => {
                    const thisComputed = o.is_computed || o.sum_of.length > 0
                    const otherComputedIdx = outputs.findIndex(
                      (x, j) =>
                        j !== i && (x.is_computed || x.sum_of.length > 0),
                    )
                    const hasOtherComputed = otherComputedIdx >= 0
                    // Sources: other named outputs that are not computed (avoids cycles)
                    const siblings = outputs
                      .map((x, j) => ({ ...x, j }))
                      .filter(
                        (x) =>
                          x.j !== i &&
                          x.name.trim() &&
                          x.name.trim().toLowerCase() !==
                            o.name.trim().toLowerCase() &&
                          !(x.is_computed || x.sum_of.length > 0),
                      )
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-surface/40 px-3 py-3"
                      >
                        <div className="flex gap-2">
                          <input
                            className="input-field owner-focus flex-1"
                            placeholder="Output name"
                            value={o.name}
                            disabled={hasBatches}
                            onChange={(e) =>
                              setOutputs((rows) =>
                                rows.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          {!hasBatches && (
                            <button
                              type="button"
                              className="text-muted hover:text-red-500"
                              onClick={() =>
                                setOutputs((rows) => rows.filter((_, j) => j !== i))
                              }
                              aria-label={`Remove output ${i + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <label
                          className={`mt-2 inline-flex items-center gap-2 text-xs ${
                            hasOtherComputed && !thisComputed ? 'opacity-50' : ''
                          }`}
                          title={
                            hasOtherComputed && !thisComputed
                              ? 'Only one computed total is allowed — uncheck the other first, or check this to move it'
                              : undefined
                          }
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[var(--owner,#c45c26)]"
                            checked={thisComputed}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setOutputs((rows) => {
                                // Default sum sources = all other named non-computed outputs
                                const defaultSumOf = checked
                                  ? rows
                                      .filter(
                                        (x, j) =>
                                          j !== i &&
                                          x.name.trim() &&
                                          !(x.is_computed || x.sum_of.length > 0),
                                      )
                                      .map((x) => x.name.trim())
                                  : []
                                return rows.map((x, j) => {
                                  if (j === i) {
                                    return {
                                      ...x,
                                      is_computed: checked,
                                      sum_of: checked
                                        ? x.sum_of.length > 0
                                          ? x.sum_of
                                          : defaultSumOf
                                        : [],
                                    }
                                  }
                                  // Only one computed total — clear others when enabling this one
                                  if (checked) {
                                    return { ...x, is_computed: false, sum_of: [] }
                                  }
                                  return x
                                })
                              })
                            }}
                          />
                          Computed total (sum of other outputs)
                          {hasOtherComputed && !thisComputed ? (
                            <span className="text-muted">· only one allowed</span>
                          ) : null}
                        </label>
                        <label className="mt-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[var(--owner,#c45c26)]"
                            checked={o.requires_qc}
                            disabled={o.is_byproduct}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setOutputs((rows) =>
                                rows.map((x, j) =>
                                  j === i ? { ...x, requires_qc: checked } : x,
                                ),
                              )
                            }}
                          />
                          Requires QC (send this finish to lab)
                          {o.is_byproduct ? (
                            <span className="text-muted">· off for byproduct</span>
                          ) : null}
                        </label>
                        <label className="mt-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[var(--owner,#c45c26)]"
                            checked={o.is_byproduct}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setOutputs((rows) =>
                                rows.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        is_byproduct: checked,
                                        requires_qc: checked ? false : x.requires_qc,
                                        is_computed: checked ? false : x.is_computed,
                                        sum_of: checked ? [] : x.sum_of,
                                      }
                                    : x,
                                ),
                              )
                            }}
                          />
                          Byproduct (separate warehouse lot)
                        </label>
                        {thisComputed && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {siblings.length === 0 ? (
                              <p className="text-xs text-muted">
                                Add other outputs first (e.g. Crude, H-C).
                              </p>
                            ) : (
                              siblings.map((s) => {
                                const on = o.sum_of.some(
                                  (n) => n.toLowerCase() === s.name.trim().toLowerCase(),
                                )
                                return (
                                  <button
                                    key={s.j}
                                    type="button"
                                    onClick={() =>
                                      setOutputs((rows) =>
                                        rows.map((x, j) => {
                                          if (j !== i) return x
                                          const name = s.name.trim()
                                          const next = on
                                            ? x.sum_of.filter(
                                                (n) =>
                                                  n.toLowerCase() !== name.toLowerCase(),
                                              )
                                            : [...x.sum_of, name]
                                          return {
                                            ...x,
                                            is_computed: true,
                                            sum_of: next,
                                          }
                                        }),
                                      )
                                    }
                                    className={`rounded-md px-2 py-1 text-[11px] ${
                                      on
                                        ? 'bg-owner/15 text-owner'
                                        : 'bg-layer-sm text-muted hover:text-primary'
                                    }`}
                                  >
                                    {s.name.trim()}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}
                        {thisComputed && o.sum_of.length > 0 && (
                          <p className="mt-2 text-[11px] text-muted">
                            {o.sum_of.join(' + ')} = {o.name || 'total'}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
              </div>

              </div>
            </MgmtDrawer>
          )}
        </>
      )}
    </div>
  )
}
