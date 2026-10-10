'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, FlaskConical, Plus, Trash2 } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@madstoq/ui/erp-page-header'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryFactory } from '@/contexts/InventoryFactoryContext'
import { useToast } from '@/components/providers/ToastProvider'
import { SkeletonPanel } from '@/components/ui'
import { productionApi, warehouseApi } from '@/lib/api'
import { applyComputedOutputQtys } from '@/lib/production-output-totals'
import {
  alignCrudeWashSteps,
  crudeWashKey,
  crudeWashMaterials,
  isCrudeWashStage,
  rollupCrudeWash,
  washEndFilled,
  washStartFilled,
  type CrudeWashStep,
} from '@/lib/crude-wash'
import { ProductionRecordExportButton } from '@/components/inventory/ProductionRecordExportButton'
import { MgmtDrawer } from '@/components/inventory/MgmtDrawer'
import {
  ChemistRequestMaterialFooter,
  ChemistRequestMaterialForm,
} from '@/components/inventory/ChemistRequestMaterialForm'

type WizardStep = 1 | 2 | 3 | 4 | 5

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Header',
  2: 'Raw materials',
  3: 'Process',
  4: 'Semi-finished product',
  5: 'Review',
}

function stepLabel(step: WizardStep, kind: 'sfg' | 'fg') {
  if (step === 2) return kind === 'fg' ? 'Inputs' : 'Raw materials'
  if (step === 4) return kind === 'fg' ? 'Finished product' : 'Semi-finished product'
  return STEP_LABELS[step]
}

/** Every template material with lines must have qty (and a GRN when required). */
function areRmInputsComplete(rms: ProductRm[], rmLines: RmLine[]): boolean {
  if (rms.length === 0) return false
  let sawMaterial = false
  for (const def of rms) {
    const lines = rmLines.filter((l) => l.rm_def_id === def.id)
    if (lines.length === 0) continue
    sawMaterial = true
    const allocated = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
    if (!(allocated > 0)) return false
    if (def.lot_required) {
      for (const line of lines) {
        if (Number(line.qty) > 0 && !line.lot_invoice) return false
      }
    }
  }
  return sawMaterial
}

function stepHint(step: WizardStep, kind: 'sfg' | 'fg') {
  if (step === 1) return 'Confirm vessel and manufacturing date.'
  if (step === 2)
    return kind === 'fg'
      ? 'Crude uses released SFG lots. Wash chemicals use released RM lots.'
      : 'Set needed qty, pick a released GRN, then take from that lot.'
  if (step === 3) {
    return 'Finish stages in order. The next start copies the previous end. Washing of crude records a start and end for each wash chemical on the finished-goods recipe.'
  }
  if (step === 4)
    return kind === 'fg'
      ? 'Enter finished quantities. Computed totals fill in and stay locked.'
      : 'Enter semi-finished quantities. Computed totals fill in and stay locked.'
  return 'Check the summary, then mark completed.'
}

function lotOptionLabel(
  lot: { invoice_number: string; stock_grade?: string; purity: number | null },
  left: number,
) {
  return `${lot.invoice_number} · ${left.toFixed(3)} left${
    lot.stock_grade === 'rejected' ? ' · rejected' : ''
  }${lot.purity != null ? ` · ${lot.purity}%` : ''}`
}

type ProductRm = {
  id: string
  material_name: string
  unit: string
  allow_multi_lot: boolean
  lot_required: boolean
  max_lots: number
  sort_order: number
  stock_kind?: 'rm' | 'sfg'
  process?: 'sfg' | 'fg'
}

type ProductStage = {
  id: string
  name: string
  sort_order: number
  capture_start_date: boolean
  capture_end_date: boolean
  capture_start_time: boolean
  capture_end_time: boolean
  capture_start_temp: boolean
  capture_end_temp: boolean
  capture_integrity?: boolean
  process?: 'sfg' | 'fg'
  lot_rm_def_id: string | null
}

type ProductOutput = {
  id: string
  name: string
  sort_order: number
  is_computed: boolean
  sum_of: string[]
  requires_qc?: boolean
  process?: 'sfg' | 'fg'
}

type RmLine = {
  id: string
  rm_def_id: string
  qty: number
  lot_invoice: string | null
  lot_slot: number | null
  notes: string | null
  usage_entry_id: string | null
}

type StageLog = {
  id: string
  stage_id: string
  lot_slot: number
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  start_temp: number | null
  end_temp: number | null
  integrity_ok: boolean | null
  wash_steps?: CrudeWashStep[] | null
}

type OutputRow = {
  id: string
  output_field_id: string
  qty: number
}

type StockLot = {
  invoice_number: string
  material_type: string
  tons_remaining: number
  supplier_name: string | null
  purity: number | null
  stock_grade?: string
}

const SFG_ALL_LOTS = '__sfg_all__'

function defStockKind(
  def: ProductRm,
  batchKind: 'sfg' | 'fg',
  rms: ProductRm[],
): 'rm' | 'sfg' {
  const mixed = rms.some((r) => r.stock_kind === 'sfg')
  if (mixed) return def.stock_kind === 'sfg' ? 'sfg' : 'rm'
  if (batchKind === 'fg') return 'sfg'
  return 'rm'
}

function lotsForDef(
  def: ProductRm,
  lotsByMaterial: Record<string, StockLot[]>,
  batchKind: 'sfg' | 'fg',
  rms: ProductRm[],
): StockLot[] {
  if (defStockKind(def, batchKind, rms) === 'sfg') {
    const named = lotsByMaterial[(def.material_name || '').toLowerCase()]
    if (named?.length) return named
    return lotsByMaterial[SFG_ALL_LOTS] ?? []
  }
  return lotsByMaterial[(def.material_name || '').toLowerCase()] ?? []
}

function stepStorageKey(batchId: string) {
  return `chemist-batch-step:${batchId}`
}

async function loadReleasedLots(
  factoryId: string,
  rms: ProductRm[],
  batchKind: 'sfg' | 'fg',
): Promise<Record<string, StockLot[]>> {
  const kinds = new Set(rms.map((r) => defStockKind(r, batchKind, rms)))
  const next: Record<string, StockLot[]> = {}

  const takeLots = (data: { lots?: StockLot[]; stock?: StockLot[] }) =>
    ((data.lots ?? data.stock ?? []) as StockLot[]).filter(
      (l) => Number(l.tons_remaining) > 0,
    )

  if (kinds.has('rm')) {
    const data = await warehouseApi.listReleasedStock(factoryId, undefined, {
      stock_kind: 'rm',
    })
    const lots = takeLots(data)
    for (const r of rms) {
      if (defStockKind(r, batchKind, rms) !== 'rm') continue
      const key = (r.material_name || '').toLowerCase()
      next[key] = lots.filter((l) => l.material_type.toLowerCase() === key)
    }
  }
  if (kinds.has('sfg')) {
    const data = await warehouseApi.listReleasedStock(factoryId, undefined, {
      stock_kind: 'sfg',
    })
    const lots = takeLots(data)
    next[SFG_ALL_LOTS] = lots
    for (const r of rms) {
      if (defStockKind(r, batchKind, rms) !== 'sfg') continue
      const key = (r.material_name || '').toLowerCase()
      const named = lots.filter((l) => l.material_type.toLowerCase() === key)
      next[key] = named.length ? named : lots
    }
  }
  return next
}

function stageRunStorageKey(batchId: string) {
  return `chemist-batch-stage-run:${batchId}`
}

type StageRunMarks = { started: string[]; ended: string[] }

function loadStageRunMarks(batchId: string): StageRunMarks {
  try {
    const raw = localStorage.getItem(stageRunStorageKey(batchId))
    if (!raw) return { started: [], ended: [] }
    const parsed = JSON.parse(raw) as StageRunMarks
    return {
      started: Array.isArray(parsed.started) ? parsed.started : [],
      ended: Array.isArray(parsed.ended) ? parsed.ended : [],
    }
  } catch {
    return { started: [], ended: [] }
  }
}

function saveStageRunMarks(batchId: string, marks: StageRunMarks) {
  try {
    localStorage.setItem(stageRunStorageKey(batchId), JSON.stringify(marks))
  } catch {
    /* ignore */
  }
}

function washRunStorageKey(batchId: string) {
  return `chemist-batch-wash-run:${batchId}`
}

function loadWashRunMarks(batchId: string): StageRunMarks {
  try {
    const raw = localStorage.getItem(washRunStorageKey(batchId))
    if (!raw) return { started: [], ended: [] }
    const parsed = JSON.parse(raw) as StageRunMarks
    return {
      started: Array.isArray(parsed.started) ? parsed.started : [],
      ended: Array.isArray(parsed.ended) ? parsed.ended : [],
    }
  } catch {
    return { started: [], ended: [] }
  }
}

function saveWashRunMarks(batchId: string, marks: StageRunMarks) {
  try {
    localStorage.setItem(washRunStorageKey(batchId), JSON.stringify(marks))
  } catch {
    /* ignore */
  }
}

function nowDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function clampTodayOrLater(value: string) {
  const today = nowDate()
  if (!value) return value
  return value < today ? today : value
}

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isIntegrityOnlyStage(stage: ProductStage | undefined): boolean {
  if (!stage?.capture_integrity) return false
  return (
    stage.capture_start_date === false &&
    stage.capture_end_date === false &&
    stage.capture_start_time === false &&
    stage.capture_end_time === false &&
    stage.capture_start_temp === false &&
    stage.capture_end_temp === false
  )
}

function isStageStartComplete(
  log: {
    start_date: string | null
    start_time: string | null
    start_temp: number | null
  },
  stage: ProductStage | undefined,
): boolean {
  if (stage?.capture_start_date !== false && !log.start_date) return false
  if (stage?.capture_start_time !== false && !log.start_time) return false
  if (stage?.capture_start_temp !== false && log.start_temp == null) return false
  return true
}

function isStageEndComplete(
  log: {
    end_date: string | null
    end_time: string | null
    end_temp: number | null
    integrity_ok?: boolean | null
  },
  stage: ProductStage | undefined,
): boolean {
  if (stage?.capture_end_date !== false && !log.end_date) return false
  if (stage?.capture_end_time !== false && !log.end_time) return false
  if (stage?.capture_end_temp !== false && log.end_temp == null) return false
  if (stage?.capture_integrity && log.integrity_ok !== true && log.integrity_ok !== false) {
    return false
  }
  return true
}

function hasAnyEndValue(log: {
  end_date: string | null
  end_time: string | null
  end_temp: number | null
  integrity_ok?: boolean | null
}): boolean {
  return Boolean(
    log.end_date ||
      log.end_time ||
      log.end_temp != null ||
      log.integrity_ok === true ||
      log.integrity_ok === false,
  )
}

/** Multi-lot RM linked to a stage (explicit id, or name match e.g. Bromine addition → Bromine). */
function resolveStageLotRm(
  stage: ProductStage | undefined,
  rms: ProductRm[],
): ProductRm | undefined {
  if (!stage) return undefined
  if (stage.lot_rm_def_id) {
    const byId = rms.find((r) => r.id === stage.lot_rm_def_id)
    if (byId?.allow_multi_lot) return byId
  }
  const stageName = (stage.name || '').toLowerCase()
  return rms.find(
    (r) =>
      r.allow_multi_lot &&
      Boolean(r.material_name?.trim()) &&
      stageName.includes(r.material_name.toLowerCase()),
  )
}

export function ProductionBatchDetail({
  mode = 'chemist',
}: {
  mode?: 'owner' | 'chemist'
}) {
  const params = useParams<{ id: string }>()
  const batchId = params.id
  const router = useRouter()
  const toast = useToast()
  const { loading: authLoading } = useAuth()
  const { factoryId: ctxFactoryId } = useInventoryFactory()
  const isOwnerView = mode === 'owner'

  const [step, setStep] = useState<WizardStep>(1)
  const [stepReady, setStepReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [sendingQc, setSendingQc] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)

  const [batchNo, setBatchNo] = useState('')
  const [vessel, setVessel] = useState('')
  const [mfgDate, setMfgDate] = useState('')
  const [chemistName, setChemistName] = useState('')
  const [status, setStatus] = useState('draft')
  const [qcStatus, setQcStatus] = useState('none')
  const [qcSentAt, setQcSentAt] = useState<string | null>(null)
  const [factoryId, setFactoryId] = useState('')
  const [productId, setProductId] = useState('')
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [batchKind, setBatchKind] = useState<'sfg' | 'fg'>('sfg')

  const [rms, setRms] = useState<ProductRm[]>([])
  const [stages, setStages] = useState<ProductStage[]>([])
  const [outputs, setOutputs] = useState<ProductOutput[]>([])
  const [rmLines, setRmLines] = useState<RmLine[]>([])
  const [stageLogs, setStageLogs] = useState<StageLog[]>([])
  const [outputRows, setOutputRows] = useState<OutputRow[]>([])

  const [lotsByMaterial, setLotsByMaterial] = useState<Record<string, StockLot[]>>({})
  /** Intended total qty per RM (allocations must sum to this). */
  const [rmTotals, setRmTotals] = useState<Record<string, number>>({})
  /** Index within ordered process stages (Excel: one stage after another). */
  const [processStageIndex, setProcessStageIndex] = useState(0)
  /** Explicit confirm: start values alone do not open end fields. */
  const [startedStageIds, setStartedStageIds] = useState<Set<string>>(() => new Set())
  const [endedStageIds, setEndedStageIds] = useState<Set<string>>(() => new Set())
  const [startedWashKeys, setStartedWashKeys] = useState<Set<string>>(() => new Set())
  const [endedWashKeys, setEndedWashKeys] = useState<Set<string>>(() => new Set())
  /** How many lot slots are shown per multi-lot RM (starts at 1). */
  const [revealedLotSlots, setRevealedLotSlots] = useState<Record<string, number>>({})

  const readOnly = status === 'completed' || isOwnerView
  const canSendForQc = status === 'completed' && qcStatus === 'none'
  const listHref = isOwnerView
    ? '/inventory/owner/production'
    : '/inventory/chemist/production'
  const accent = isOwnerView ? 'owner' : 'chemist'

  const rmDefById = useMemo(() => new Map(rms.map((r) => [r.id, r])), [rms])
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])
  const outputById = useMemo(() => new Map(outputs.map((o) => [o.id, o])), [outputs])
  const orderedOutputRows = useMemo(
    () =>
      [...outputRows].sort(
        (a, b) =>
          (outputById.get(a.output_field_id)?.sort_order ?? 0) -
          (outputById.get(b.output_field_id)?.sort_order ?? 0),
      ),
    [outputRows, outputById],
  )

  const orderedStageLogs = useMemo(() => {
    return [...stageLogs].sort((a, b) => {
      const ao = stageById.get(a.stage_id)?.sort_order ?? 0
      const bo = stageById.get(b.stage_id)?.sort_order ?? 0
      if (ao !== bo) return ao - bo
      return (a.lot_slot ?? 1) - (b.lot_slot ?? 1)
    })
  }, [stageLogs, stageById])

  function washStepsForLog(log: StageLog): CrudeWashStep[] {
    const stage = stageById.get(log.stage_id)
    if (!isCrudeWashStage(stage?.name)) return []
    const materials = crudeWashMaterials(rms, stage?.process)
    if (materials.length === 0) return []
    return alignCrudeWashSteps(log.wash_steps, materials)
  }

  useEffect(() => {
    if (step !== 3) return
    if (orderedStageLogs.length === 0) {
      setProcessStageIndex(0)
      return
    }
    setProcessStageIndex((i) => Math.min(i, orderedStageLogs.length - 1))
  }, [step, orderedStageLogs.length])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await productionApi.getBatch(batchId)
    if (data.error || !data.batch) {
      toast.error(data.error || 'Batch not found')
      setLoading(false)
      return
    }
    const b = data.batch
    setBatchNo(b.batch_no)
    setVessel(b.vessel || '')
    setMfgDate(b.mfg_date || '')
    setChemistName(b.created_by_name || '')
    setStatus(b.status)
    setQcStatus(b.qc_status || 'none')
    setQcSentAt(b.qc_sent_at || null)
    setFactoryId(b.factory_id)
    setProductId(b.product_id || '')
    setProductCode(b.product_code || '')
    setProductName(b.product_name || '')
    setBatchKind(b.kind === 'fg' ? 'fg' : 'sfg')
    setRmLines(b.rm_lines || [])
    setStageLogs(b.stage_logs || [])
    setOutputRows(b.outputs || [])

    const prod = await productionApi.getProduct(b.product_id)
    if (prod.product) {
      const proc = b.kind === 'fg' ? 'fg' : 'sfg'
      const allRms = (prod.product.rms || []) as ProductRm[]
      const allStages = (prod.product.stages || []) as ProductStage[]
      const allOutputs = (prod.product.outputs || []) as ProductOutput[]
      const nextOutputs = allOutputs
        .filter((o) => (o.process || 'sfg') === proc)
        .map(
        (o: ProductOutput & { sum_of?: string[] }) => ({
          ...o,
          sum_of: Array.isArray(o.sum_of) ? o.sum_of : [],
          is_computed: Boolean(o.is_computed) || (o.sum_of?.length ?? 0) > 0,
        }),
      )
      setRms(allRms.filter((r) => (r.process || 'sfg') === proc))
      setStages(allStages.filter((s) => (s.process || 'sfg') === proc))
      setOutputs(nextOutputs)
      setOutputRows(
        applyComputedOutputQtys(b.outputs || [], nextOutputs),
      )
    }
    setLoading(false)
  }, [batchId])

  useEffect(() => {
    setStepReady(false)
    setProcessStageIndex(0)
    setStartedStageIds(new Set())
    setEndedStageIds(new Set())
    setStartedWashKeys(new Set())
    setEndedWashKeys(new Set())
    setRevealedLotSlots({})
    setRmTotals({})
  }, [batchId])

  // Restore start/end confirms — only when field data actually supports them
  // (stale localStorage alone must not lock empty fields as "Complete")
  useEffect(() => {
    if (loading || !batchId) return
    const stored = loadStageRunMarks(batchId)
    const storedStarted = new Set(stored.started)
    const started = new Set<string>()
    const ended = new Set<string>()

    for (const log of stageLogs) {
      const stage = stageById.get(log.stage_id)
      const startOk = isStageStartComplete(log, stage)
      const endOk = isStageEndComplete(log, stage)

      if (
        startOk &&
        (storedStarted.has(log.id) || hasAnyEndValue(log) || endOk)
      ) {
        started.add(log.id)
      }
      // Fully filled start+end = done on resume (even if confirm mark was lost)
      if (startOk && endOk) {
        ended.add(log.id)
      }
    }

    setStartedStageIds(started)
    setEndedStageIds(ended)
    saveStageRunMarks(batchId, {
      started: [...started],
      ended: [...ended],
    })

    const storedWash = loadWashRunMarks(batchId)
    const storedWashStarted = new Set(storedWash.started)
    const washStarted = new Set<string>()
    const washEnded = new Set<string>()
    for (const log of stageLogs) {
      for (const step of washStepsForLog(log)) {
        const key = crudeWashKey(log.id, step.material_name)
        const startOk = washStartFilled(step)
        const endOk = washEndFilled(step)
        if (startOk && (storedWashStarted.has(key) || endOk)) washStarted.add(key)
        if (startOk && endOk) washEnded.add(key)
      }
    }
    setStartedWashKeys(washStarted)
    setEndedWashKeys(washEnded)
    saveWashRunMarks(batchId, {
      started: [...washStarted],
      ended: [...washEnded],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per load
  }, [loading, batchId, stages.length, stageLogs.length])

  // Hydrate how many lot slots to show — only filled slots (don't show empty leftover rows)
  useEffect(() => {
    if (loading) return
    const next: Record<string, number> = {}
    for (const def of rms) {
      next[def.id] = 1
    }
    for (const line of rmLines) {
      if (line.lot_slot == null) continue
      const inUse =
        Number(line.qty) > 0 ||
        Boolean(line.lot_invoice) ||
        Boolean(line.notes?.trim())
      if (!inUse) continue
      next[line.rm_def_id] = Math.max(next[line.rm_def_id] ?? 1, line.lot_slot)
    }
    setRevealedLotSlots((prev) => {
      const merged = { ...next }
      // Keep slots the user explicitly added this session
      for (const [id, n] of Object.entries(prev)) {
        merged[id] = Math.max(merged[id] ?? 1, n)
      }
      return merged
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per load
  }, [loading, batchId, rms.length])

  // Hydrate intended totals from allocated line qtys
  useEffect(() => {
    if (loading) return
    const next: Record<string, number> = {}
    for (const def of rms) {
      const sum = rmLines
        .filter((l) => l.rm_def_id === def.id)
        .reduce((s, l) => s + (Number(l.qty) || 0), 0)
      next[def.id] = Math.abs(sum) < 1e-6 ? 0 : Number(sum.toFixed(3))
    }
    setRmTotals(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per load
  }, [loading, batchId, rms.length])

  useEffect(() => {
    if (!batchId || loading) return
    saveStageRunMarks(batchId, {
      started: [...startedStageIds],
      ended: [...endedStageIds],
    })
  }, [batchId, loading, startedStageIds, endedStageIds])

  useEffect(() => {
    if (!batchId || loading) return
    saveWashRunMarks(batchId, {
      started: [...startedWashKeys],
      ended: [...endedWashKeys],
    })
  }, [batchId, loading, startedWashKeys, endedWashKeys])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  // Resume at first incomplete step from saved data (not stale ?step=2 / localStorage).
  useEffect(() => {
    if (loading || stepReady) return

    if (status === 'completed') {
      setStep(5)
      setProcessStageIndex(0)
      setStepReady(true)
      return
    }

    const headerOk = Boolean(batchNo.trim() && vessel.trim())
    const rmOk = areRmInputsComplete(rms, rmLines)

    const ordered = [...stageLogs].sort((a, b) => {
      const ao = stageById.get(a.stage_id)?.sort_order ?? 0
      const bo = stageById.get(b.stage_id)?.sort_order ?? 0
      if (ao !== bo) return ao - bo
      return (a.lot_slot ?? 1) - (b.lot_slot ?? 1)
    })
    const processDone =
      ordered.length === 0 ||
      ordered.every((l) => {
        const stage = stageById.get(l.stage_id)
        return isStageStartComplete(l, stage) && isStageEndComplete(l, stage)
      })
    const firstOpenProcess = ordered.findIndex((l) => {
      const stage = stageById.get(l.stage_id)
      return !isStageStartComplete(l, stage) || !isStageEndComplete(l, stage)
    })

    const requiredOuts = outputRows.filter((row) => {
      const field = outputById.get(row.output_field_id)
      return field && !field.is_computed
    })
    const finishedOk =
      requiredOuts.length === 0 || requiredOuts.every((row) => Number(row.qty) > 0)

    let inferred: WizardStep = 1
    if (!headerOk) inferred = 1
    else if (!rmOk) inferred = 2
    else if (!processDone) inferred = 3
    else if (!finishedOk) inferred = 4
    else inferred = 5

    setStep(inferred)
    setProcessStageIndex(firstOpenProcess >= 0 ? firstOpenProcess : 0)
    setStepReady(true)

    try {
      localStorage.setItem(stepStorageKey(batchId), String(inferred))
    } catch {
      /* ignore */
    }

    // Drop stale ?step= from new-batch redirect so reopen uses progress
    try {
      if (typeof window !== 'undefined' && window.location.search.includes('step=')) {
        const base = isOwnerView
          ? `/inventory/owner/production/${batchId}`
          : `/inventory/chemist/production/${batchId}`
        router.replace(base)
      }
    } catch {
      /* ignore */
    }
  }, [
    loading,
    stepReady,
    status,
    batchId,
    batchNo,
    vessel,
    rms,
    rmLines,
    stageLogs,
    outputRows,
    stageById,
    outputById,
    router,
    isOwnerView,
  ])

  useEffect(() => {
    if (!stepReady || readOnly) return
    try {
      localStorage.setItem(stepStorageKey(batchId), String(step))
    } catch {
      /* ignore */
    }
  }, [step, batchId, stepReady, readOnly])

  useEffect(() => {
    if (!factoryId || rms.length === 0) return
    void (async () => {
      const next = await loadReleasedLots(factoryId, rms, batchKind)
      setLotsByMaterial(next)
    })()
  }, [factoryId, rms, batchKind])

  async function reloadReleasedLots() {
    const factory = factoryId || ctxFactoryId
    if (!factory || rms.length === 0) return
    const next = await loadReleasedLots(factory, rms, batchKind)
    setLotsByMaterial(next)
  }

  function updateRmLine(id: string, patch: Partial<RmLine>) {
    setRmLines((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r
        if (r.usage_entry_id) return r // already deducted — locked
        return { ...r, ...patch }
      }),
    )
  }

  function allocatedQty(rmDefId: string, exceptLineId?: string): number {
    return rmLines
      .filter((l) => l.rm_def_id === rmDefId && l.id !== exceptLineId)
      .reduce((s, l) => s + (Number(l.qty) || 0), 0)
  }

  /** Qty already taken from this GRN on other allocation rows (this batch). */
  function qtyTakenOnInvoice(invoice: string, exceptLineId?: string): number {
    return rmLines
      .filter(
        (l) =>
          l.lot_invoice === invoice &&
          l.id !== exceptLineId &&
          !l.usage_entry_id,
      )
      .reduce((s, l) => s + (Number(l.qty) || 0), 0)
  }

  function releasedLeftForLine(
    def: ProductRm,
    invoice: string,
    exceptLineId?: string,
  ): number | null {
    const lots = lotsForDef(def, lotsByMaterial, batchKind, rms)
    const lot = lots.find((l) => l.invoice_number === invoice)
    if (!lot) return null
    const raw = Number(lot.tons_remaining)
    const takenElsewhere = qtyTakenOnInvoice(invoice, exceptLineId)
    return Math.max(0, raw - takenElsewhere)
  }

  /** GRNs already chosen on sibling rows — each GRN only once per material. */
  function siblingInvoices(rmDefId: string, exceptLineId?: string): Set<string> {
    const used = new Set<string>()
    for (const l of rmLines) {
      if (l.rm_def_id !== rmDefId || l.id === exceptLineId || !l.lot_invoice) continue
      used.add(l.lot_invoice)
    }
    return used
  }

  function setMaterialTotal(rmDefId: string, total: number) {
    const cleaned = Number.isFinite(total) ? total : 0
    setRmTotals((prev) => ({
      ...prev,
      [rmDefId]: Math.abs(cleaned) < 1e-6 ? 0 : cleaned,
    }))
  }

  /** When picking a GRN, suggest qty = min(still needed for total, released left). */
  function selectLotForLine(line: RmLine, def: ProductRm, invoice: string | null) {
    if (!invoice) {
      updateRmLine(line.id, { lot_invoice: null })
      return
    }
    // Block picking a GRN already used on another row for this material
    if (siblingInvoices(def.id, line.id).has(invoice)) {
      toast.error(`${invoice} is already used on another row — take all qty from that row`)
      return
    }
    const available = releasedLeftForLine(def, invoice, line.id) ?? 0
    const total = Number(rmTotals[def.id]) || 0
    const other = allocatedQty(def.id, line.id)
    const stillNeed = Math.max(0, total - other)
    const currentQty = Number(line.qty) || 0
    const suggest =
      currentQty > 0
        ? Math.min(currentQty, available)
        : Math.min(stillNeed > 0 ? stillNeed : available, available)
    updateRmLine(line.id, {
      lot_invoice: invoice,
      qty: suggest > 0 ? Number(suggest.toFixed(3)) : 0,
    })
  }

  function consumptionMaxLots(def: ProductRm): number {
    if (def.allow_multi_lot) return Math.min(10, Math.max(1, def.max_lots || 2))
    // Split qty across multiple released GRNs (independent of process multi-lot)
    return 5
  }

  function isRmLineVisible(line: RmLine): boolean {
    if (line.lot_slot == null) return true
    const revealed = revealedLotSlots[line.rm_def_id] ?? 1
    const inUse =
      Number(line.qty) > 0 ||
      Boolean(line.lot_invoice) ||
      Boolean(line.notes?.trim())
    return inUse || line.lot_slot <= revealed
  }

  /** Keep local lot/qty edits when server returns batch lines (add/remove lot). */
  function mergeRmLinesPreservingLocal(
    serverLines: RmLine[],
    localLines: RmLine[],
  ): RmLine[] {
    const localById = new Map(localLines.map((l) => [l.id, l]))
    return serverLines.map((server) => {
      const local = localById.get(server.id)
      if (!local || server.usage_entry_id) return server
      return {
        ...server,
        qty: local.qty,
        lot_invoice: local.lot_invoice,
        notes: local.notes,
      }
    })
  }

  async function addRmLot(rmDefId: string) {
    if (readOnly) return
    const def = rmDefById.get(rmDefId)
    if (!def) return
    const maxLots = consumptionMaxLots(def)
    const revealed = revealedLotSlots[rmDefId] ?? 1
    if (revealed >= maxLots) {
      toast.error(`Maximum ${maxLots} lots for ${def.material_name}`)
      return
    }
    const nextSlot = revealed + 1
    const existing = rmLines.find(
      (l) => l.rm_def_id === rmDefId && l.lot_slot === nextSlot,
    )
    if (existing) {
      setRevealedLotSlots((prev) => ({ ...prev, [rmDefId]: nextSlot }))
      return
    }

    // Save allocations first — otherwise server reload wipes unsaved Lot/Qty
    const snapshot = rmLines
    const saved = await persist({ silent: true, keepStatus: true })
    if (!saved) return

    const data = await productionApi.addRmLot(batchId, { rm_def_id: rmDefId })
    if (data.error || !data.batch) {
      toast.error(data.error || 'Could not add lot')
      // Restore local edits if add failed after save
      setRmLines(mergeRmLinesPreservingLocal(rmLines, snapshot))
      return
    }
    const serverLines = (data.batch.rm_lines || []) as RmLine[]
    setRmLines(mergeRmLinesPreservingLocal(serverLines, snapshot))
    const slot = Number(data.lot_slot) || nextSlot
    setRevealedLotSlots((prev) => ({
      ...prev,
      [rmDefId]: Math.max(prev[rmDefId] ?? 1, slot),
    }))
  }

  async function removeRmLot(line: RmLine) {
    if (readOnly || line.usage_entry_id) return
    const siblings = rmLines.filter((l) => l.rm_def_id === line.rm_def_id)
    if (siblings.length <= 1) {
      toast.error('Keep at least one allocation row')
      return
    }

    const snapshot = rmLines.filter((l) => l.id !== line.id)
    const saved = await persist({ silent: true, keepStatus: true })
    if (!saved) return

    const data = await productionApi.removeRmLot(batchId, { line_id: line.id })
    if (data.error || !data.batch) {
      toast.error(data.error || 'Could not remove allocation')
      return
    }
    const serverLines = (data.batch.rm_lines || []) as RmLine[]
    setRmLines(mergeRmLinesPreservingLocal(serverLines, snapshot))
    const maxSlot = serverLines
      .filter((l) => l.rm_def_id === line.rm_def_id && l.lot_slot != null)
      .reduce((m, l) => Math.max(m, l.lot_slot ?? 1), 1)
    setRevealedLotSlots((prev) => ({
      ...prev,
      [line.rm_def_id]: Math.max(1, maxSlot),
    }))
  }

  async function addStageLotRun(stageId: string) {
    if (readOnly) return
    const data = await productionApi.addStageLotRun(batchId, { stage_id: stageId })
    if (data.error || !data.batch) {
      toast.error(data.error || 'Could not add lot run')
      return
    }
    setRmLines(data.batch.rm_lines || [])
    setStageLogs(data.batch.stage_logs || [])
    const stage = stageById.get(stageId)
    const lotRm = resolveStageLotRm(stage, rms)
    if (lotRm && data.lot_slot) {
      setRevealedLotSlots((prev) => ({
        ...prev,
        [lotRm.id]: Math.max(prev[lotRm.id] ?? 1, Number(data.lot_slot) || 1),
      }))
    }
    // Jump to the new run (same stage, next lot)
    const logs = [...(data.batch.stage_logs || [])].sort((a: StageLog, b: StageLog) => {
      const ao = stageById.get(a.stage_id)?.sort_order ?? 0
      const bo = stageById.get(b.stage_id)?.sort_order ?? 0
      if (ao !== bo) return ao - bo
      return (a.lot_slot ?? 1) - (b.lot_slot ?? 1)
    })
    const idx = logs.findIndex(
      (l: StageLog) =>
        l.stage_id === stageId && (l.lot_slot ?? 1) === Number(data.lot_slot),
    )
    if (idx >= 0) setProcessStageIndex(idx)
    toast.success(`Lot ${data.lot_slot} ready — record start when you begin`)
  }

  function updateStageLog(id: string, patch: Partial<StageLog>) {
    let clearStarted = false
    let clearEnded = false
    setStageLogs((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        const stage = stageById.get(next.stage_id)
        if (!isStageStartComplete(next, stage)) {
          next.end_date = null
          next.end_time = null
          next.end_temp = null
          clearStarted = true
          clearEnded = true
        } else if (!isStageEndComplete(next, stage)) {
          clearEnded = true
        }
        return next
      }),
    )
    if (clearStarted) {
      setStartedStageIds((prev) => {
        if (!prev.has(id)) return prev
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }
    if (clearEnded) {
      setEndedStageIds((prev) => {
        if (!prev.has(id)) return prev
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }
  }

  function updateWashStep(logId: string, materialName: string, patch: Partial<CrudeWashStep>) {
    const key = crudeWashKey(logId, materialName)
    let clearStarted = false
    let clearEnded = false
    let clearStageStarted = false
    setStageLogs((rows) =>
      rows.map((row) => {
        if (row.id !== logId) return row
        const stage = stageById.get(row.stage_id)
        const materials = crudeWashMaterials(rms, stage?.process)
        const steps = alignCrudeWashSteps(row.wash_steps, materials).map((step) => {
          if (step.material_name.toLowerCase() !== materialName.trim().toLowerCase()) return step
          const next = { ...step, ...patch }
          if (!washStartFilled(next)) {
            next.end_date = null
            next.end_time = null
            clearStarted = true
            clearEnded = true
            if (materials[0]?.toLowerCase() === materialName.trim().toLowerCase()) {
              clearStageStarted = true
            }
          } else if (!washEndFilled(next)) {
            clearEnded = true
          }
          return next
        })
        const roll = rollupCrudeWash(steps)
        return {
          ...row,
          wash_steps: steps,
          start_date: roll.start_date,
          start_time: roll.start_time,
          end_date: roll.end_date,
          end_time: roll.end_time,
        }
      }),
    )
    if (clearStarted) {
      setStartedWashKeys((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
    if (clearEnded || clearStarted) {
      setEndedWashKeys((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      setEndedStageIds((prev) => {
        if (!prev.has(logId)) return prev
        const next = new Set(prev)
        next.delete(logId)
        return next
      })
    }
    if (clearStageStarted) {
      setStartedStageIds((prev) => {
        if (!prev.has(logId)) return prev
        const next = new Set(prev)
        next.delete(logId)
        return next
      })
    }
  }

  async function confirmStageStart(logId: string): Promise<boolean> {
    const log = stageLogs.find((l) => l.id === logId)
    if (!log) return false
    const stage = stageById.get(log.stage_id)
    const washSteps = washStepsForLog(log)
    const firstWash = washSteps[0]
    if (washSteps.length > 0) {
      if (!firstWash || !washStartFilled(firstWash)) {
        toast.error(`Enter start date and time for ${firstWash?.material_name || 'the first wash'}`)
        return false
      }
    } else if (!isStageStartComplete(log, stage)) {
      toast.error('Enter start date, time, and temperature first')
      return false
    }
    const lotRm = resolveStageLotRm(stage, rms)
    if (lotRm) {
      const lotSlot = log.lot_slot ?? 1
      const line = rmLines.find(
        (l) => l.rm_def_id === lotRm.id && (l.lot_slot ?? 1) === lotSlot,
      )
      if (!line || !(Number(line.qty) > 0)) {
        toast.error(`Enter ${lotRm.material_name} quantity used for lot ${lotSlot}`)
        return false
      }
      if (lotRm.lot_required && !line.lot_invoice) {
        toast.error(`Select Lot/GRN for ${lotRm.material_name} lot ${lotSlot}`)
        return false
      }
    }

    for (const line of rmLines) {
      if (!(Number(line.qty) > 0)) continue
      const def = rmDefById.get(line.rm_def_id)
      if (def?.lot_required && !line.lot_invoice) {
        toast.error(
          `Select Lot/GRN for ${def.material_name}${
            line.lot_slot != null ? ` lot ${line.lot_slot}` : ''
          } before starting process`,
        )
        return false
      }
    }

    const saved = await persist({ silent: true })
    if (!saved) return false

    const commit = await productionApi.commitRmUsage(batchId)
    if (commit.error) {
      toast.error(commit.error)
      return false
    }
    if (commit.batch) {
      setStatus(commit.batch.status)
      setRmLines(commit.batch.rm_lines || [])
    }
    setStartedStageIds((prev) => new Set(prev).add(logId))

    const factory = factoryId || ctxFactoryId
    if (factory) {
      const next = await loadReleasedLots(factory, rms, batchKind)
      setLotsByMaterial(next)
    }

    const posted = Number(commit.posted ?? 0)
    if (posted > 0) {
      toast.success(`Stage started — ${posted} RM line(s) deducted from released stock`)
    }
    return true
  }

  function confirmStageEnd(logId: string) {
    const log = stageLogs.find((l) => l.id === logId)
    if (!log) return
    const stage = stageById.get(log.stage_id)
    if (!startedStageIds.has(logId)) {
      toast.error('Start this stage before recording the end')
      return
    }
    if (!isStageEndComplete(log, stage)) {
      toast.error('Enter end date, time, and temperature first')
      return
    }
    setEndedStageIds((prev) => new Set(prev).add(logId))
    void persist({ silent: true })
  }

  async function confirmWashStart(logId: string, materialName: string) {
    const log = stageLogs.find((l) => l.id === logId)
    if (!log) return
    const steps = washStepsForLog(log)
    const index = steps.findIndex(
      (step) => step.material_name.toLowerCase() === materialName.trim().toLowerCase(),
    )
    const step = index >= 0 ? steps[index] : undefined
    if (!step || !washStartFilled(step)) {
      toast.error(`Enter start date and time for ${materialName}`)
      return
    }
    if (index > 0) {
      const prev = steps[index - 1]
      if (!prev || !washEndFilled(prev) || !endedWashKeys.has(crudeWashKey(logId, prev.material_name))) {
        toast.error(`End ${prev?.material_name || 'the previous wash'} before starting ${materialName}`)
        return
      }
    }
    if (index === 0 && !startedStageIds.has(logId)) {
      const saved = await confirmStageStart(logId)
      if (!saved) return
    } else {
      const saved = await persist({ silent: true })
      if (!saved) return
    }
    setStartedWashKeys((prev) => new Set(prev).add(crudeWashKey(logId, materialName)))
  }

  function confirmWashEnd(logId: string, materialName: string) {
    const log = stageLogs.find((l) => l.id === logId)
    if (!log) return
    const steps = washStepsForLog(log)
    const index = steps.findIndex(
      (step) => step.material_name.toLowerCase() === materialName.trim().toLowerCase(),
    )
    const step = index >= 0 ? steps[index] : undefined
    const key = crudeWashKey(logId, materialName)
    if (!step || !startedWashKeys.has(key)) {
      toast.error(`Start ${materialName} before recording the end`)
      return
    }
    if (!washEndFilled(step)) {
      toast.error(`Enter end date and time for ${materialName}`)
      return
    }
    const endedNow = new Set(endedWashKeys)
    endedNow.add(key)
    setEndedWashKeys(endedNow)
    if (steps.every((item) => endedNow.has(crudeWashKey(logId, item.material_name)))) {
      setEndedStageIds((prev) => new Set(prev).add(logId))
      setStartedStageIds((prev) => new Set(prev).add(logId))
    }
    const next = steps[index + 1]
    let nextLogs = stageLogs
    if (next && !next.start_date && !next.start_time) {
      const stage = stageById.get(log.stage_id)
      const materials = crudeWashMaterials(rms, stage?.process)
      const patched = alignCrudeWashSteps(log.wash_steps, materials).map((item) =>
        item.material_name.toLowerCase() === next.material_name.toLowerCase()
          ? {
              ...item,
              start_date: clampTodayOrLater(step.end_date || nowDate()),
              start_time: step.end_time || nowTime(),
            }
          : item,
      )
      const roll = rollupCrudeWash(patched)
      const nextLog: StageLog = {
        ...log,
        wash_steps: patched,
        start_date: roll.start_date,
        start_time: roll.start_time,
        end_date: roll.end_date,
        end_time: roll.end_time,
      }
      nextLogs = stageLogs.map((row) => (row.id === logId ? nextLog : row))
      setStageLogs(nextLogs)
    }
    void persist({ silent: true, stageLogsOverride: nextLogs })
  }

  function updateOutput(id: string, qty: number) {
    setOutputRows((rows) => {
      const next = rows.map((r) => (r.id === id ? { ...r, qty } : r))
      return applyComputedOutputQtys(next, outputs)
    })
  }

  function headerError(): string | null {
    if (!batchNo.trim()) return 'Batch number is missing'
    if (!vessel.trim()) return 'Vessel is required'
    if (!mfgDate.trim()) return 'Manufacturing date is required'
    if (mfgDate.trim() < nowDate()) return 'Manufacturing date cannot be in the past'
    return null
  }

  function rmError(): string | null {
    if (rms.length === 0) return 'No raw materials on this template'

    for (const def of rms) {
      const total = Number(rmTotals[def.id]) || 0
      const lines = rmLines.filter((l) => l.rm_def_id === def.id && isRmLineVisible(l))
      if (lines.length === 0) continue
      const allocated = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
      const name = def.material_name || 'Material'

      if (!(total > 0)) {
        return `${name}: enter needed qty and take it from a released GRN`
      }

      if (Math.abs(allocated - total) > 1e-9) {
        if (allocated < total - 1e-9) {
          return `${name}: allocate ${(total - allocated).toFixed(3)} more from released lots (total ${total.toFixed(3)})`
        }
        return `${name}: lot qtys ${allocated.toFixed(3)} exceed total ${total.toFixed(3)}`
      }

      for (const line of lines) {
        const qty = Number(line.qty) || 0
        if (!(qty > 0) && !line.lot_invoice) continue
        const label = `${name}${line.lot_slot != null ? ` · lot ${line.lot_slot}` : ''}`
        if (qty > 0 && def.lot_required && !line.lot_invoice) {
          return `Select Lot/GRN for ${label}`
        }
        if (line.lot_invoice && qty > 0) {
          const available = releasedLeftForLine(def, line.lot_invoice, line.id)
          if (available == null && !line.usage_entry_id) {
            return `${label}: ${line.lot_invoice} is not in released stock`
          }
          if (available != null && qty > available + 1e-9) {
            return `${label}: only ${available.toFixed(3)} left on ${line.lot_invoice}`
          }
        }
      }

      // Same GRN on two rows for one material is not allowed
      const seenInv = new Set<string>()
      for (const line of lines) {
        if (!line.lot_invoice) continue
        if (seenInv.has(line.lot_invoice)) {
          return `${name}: ${line.lot_invoice} is selected on more than one row — use one row per GRN`
        }
        seenInv.add(line.lot_invoice)
      }
    }

    const needByLot = new Map<string, number>()
    for (const line of rmLines) {
      if (!line.lot_invoice || line.usage_entry_id) continue
      const qty = Number(line.qty) || 0
      if (!(qty > 0)) continue
      needByLot.set(line.lot_invoice, (needByLot.get(line.lot_invoice) ?? 0) + qty)
    }
    for (const [inv, need] of needByLot) {
      let available: number | null = null
      for (const lots of Object.values(lotsByMaterial)) {
        const hit = lots.find((l) => l.invoice_number === inv)
        if (hit) {
          available = Number(hit.tons_remaining)
          break
        }
      }
      if (available != null && need > available + 1e-9) {
        return `Total qty ${need.toFixed(3)} exceeds released ${available.toFixed(3)} on ${inv}`
      }
    }
    return null
  }

  function processError(): string | null {
    if (orderedStageLogs.length === 0) return 'No process stages on this template'
    for (const log of orderedStageLogs) {
      const stage = stageById.get(log.stage_id)
      const lotSlot = log.lot_slot ?? 1
      const name = `${stage?.name || 'Stage'}${lotSlot > 1 ? ` · Lot ${lotSlot}` : ''}`
      const captureEnd =
        stage?.capture_end_date !== false ||
        stage?.capture_end_time !== false ||
        stage?.capture_end_temp !== false ||
        Boolean(stage?.capture_integrity)
      const lotRm = resolveStageLotRm(stage, rms)
      const lotRmLine = lotRm
        ? rmLines.find(
            (l) => l.rm_def_id === lotRm.id && (l.lot_slot ?? 1) === lotSlot,
          )
        : undefined
      if (lotRm) {
        if (!(Number(lotRmLine?.qty) > 0)) {
          return `${name}: enter ${lotRm.material_name} qty`
        }
        if (lotRm.lot_required && !lotRmLine?.lot_invoice) {
          return `${name}: select GRN for ${lotRm.material_name}`
        }
      }
      const washSteps = washStepsForLog(log)
      if (isIntegrityOnlyStage(stage)) {
        if (log.integrity_ok !== true && log.integrity_ok !== false) {
          return `${name}: confirm filter integrity`
        }
        if (!readOnly && !endedStageIds.has(log.id)) {
          return `${name}: confirm filter integrity`
        }
        continue
      }
      if (washSteps.length > 0) {
        for (const step of washSteps) {
          const key = crudeWashKey(log.id, step.material_name)
          if (!washStartFilled(step)) {
            return `${name}: enter start date and time for ${step.material_name}`
          }
          if (!readOnly && !startedWashKeys.has(key)) {
            return `${name}: start ${step.material_name}`
          }
          if (!washEndFilled(step)) {
            return `${name}: enter end date and time for ${step.material_name}`
          }
          if (!readOnly && !endedWashKeys.has(key)) {
            return `${name}: end ${step.material_name}`
          }
        }
        continue
      }
      if (!isStageStartComplete(log, stage)) {
        return `${name}: enter start date, time, and temperature`
      }
      if (!readOnly && !startedStageIds.has(log.id)) {
        return `${name}: start this stage`
      }
      if (captureEnd) {
        if (!isStageEndComplete(log, stage)) {
          return `${name}: enter end date, time, and temperature`
        }
        if (!readOnly && !endedStageIds.has(log.id)) {
          return `${name}: end this stage`
        }
      }
    }
    return null
  }

  function finishedError(): string | null {
    const required = outputRows.filter((row) => {
      const field = outputById.get(row.output_field_id)
      return field && !field.is_computed
    })
    if (required.length === 0) return null
    const empty = required.find((row) => !(Number(row.qty) > 0))
    if (empty) {
      const field = outputById.get(empty.output_field_id)
      return `Enter qty for ${field?.name || 'finished output'}`
    }
    return null
  }

  function isStepComplete(s: WizardStep): boolean {
    if (s === 1) return !headerError()
    if (s === 2) return !rmError()
    if (s === 3) return !processError()
    if (s === 4) return !finishedError()
    return false
  }

  async function persist(opts?: {
    nextStatus?: 'draft' | 'in_progress'
    silent?: boolean
    /** Do not auto-promote draft → in_progress (e.g. mid-edit add lot). */
    keepStatus?: boolean
    stageLogsOverride?: StageLog[]
  }): Promise<boolean> {
    if (readOnly) return false
    const err = headerError()
    if (err) {
      toast.error(err)
      return false
    }
    setSaving(true)
    const outputsToSave = applyComputedOutputQtys(outputRows, outputs)
    if (outputsToSave !== outputRows) setOutputRows(outputsToSave)
    const logsToSave = opts?.stageLogsOverride ?? stageLogs
    const data = await productionApi.updateBatch(batchId, {
      batch_no: batchNo.trim(),
      vessel: vessel.trim(),
      mfg_date: mfgDate.trim() || null,
      status: opts?.keepStatus
        ? undefined
        : (opts?.nextStatus ?? (status === 'draft' ? 'in_progress' : undefined)),
      rm_lines: rmLines.map((l) => ({
        id: l.id,
        qty: Number(l.qty) || 0,
        lot_invoice: l.lot_invoice,
        notes: l.notes,
      })),
      stage_logs: logsToSave.map((l) => {
        const steps = washStepsForLog(l)
        return {
          id: l.id,
          start_date: l.start_date,
          end_date: l.end_date,
          start_time: l.start_time,
          end_time: l.end_time,
          start_temp: l.start_temp,
          end_temp: l.end_temp,
          integrity_ok: l.integrity_ok ?? null,
          ...(steps.length > 0 ? { wash_steps: steps } : {}),
        }
      }),
      outputs: outputsToSave.map((o) => ({
        id: o.id,
        qty: Number(o.qty) || 0,
      })),
    })
    setSaving(false)
    if (data.error) {
      toast.error(data.error)
      return false
    }
    if (!opts?.silent) toast.success('Draft saved')
    if (data.batch) {
      setStatus(data.batch.status)
      // When keepStatus mid-edit, merge so we don't drop any racey local keys
      const serverLines = (data.batch.rm_lines || []) as RmLine[]
      setRmLines(
        opts?.keepStatus
          ? mergeRmLinesPreservingLocal(serverLines, rmLines)
          : serverLines,
      )
      setStageLogs(data.batch.stage_logs || [])
      setOutputRows(data.batch.outputs || [])
    }
    return true
  }

  async function goNext() {
    if (readOnly) return
    if (step === 1) {
      const err = headerError()
      if (err) {
        toast.error(err)
        return
      }
    } else if (step === 2) {
      const err = rmError()
      if (err) {
        toast.error(err)
        return
      }
    } else if (step === 3) {
      const err = processError()
      if (err) {
        toast.error(err)
        return
      }
    } else if (step === 4) {
      const err = finishedError()
      if (err) {
        toast.error(err)
        return
      }
    }

    const ok = await persist({ silent: true })
    if (!ok) return
    if (step < 5) setStep((step + 1) as WizardStep)
  }

  async function goBack() {
    if (step > 1) setStep((step - 1) as WizardStep)
  }

  async function saveDraft() {
    await persist({ silent: false })
  }

  async function complete() {
    if (readOnly) return
    const h = headerError()
    if (h) {
      toast.error(h)
      setStep(1)
      return
    }
    const r = rmError()
    if (r) {
      toast.error(r)
      setStep(2)
      return
    }
    const p = processError()
    if (p) {
      toast.error(p)
      setStep(3)
      return
    }
    const f = finishedError()
    if (f) {
      toast.error(f)
      setStep(4)
      return
    }

    setCompleting(true)
    const saved = await persist({ nextStatus: 'in_progress', silent: true })
    if (!saved) {
      setCompleting(false)
      return
    }
    const data = await productionApi.completeBatch(batchId)
    setCompleting(false)
    if (data.error) {
      toast.error(data.error)
      return
    }
    try {
      localStorage.removeItem(stepStorageKey(batchId))
    } catch {
      /* ignore */
    }
    toast.success('Batch completed — RM usage posted')
    setStatus('completed')
    setStep(5)
    void load()
  }

  async function sendForQc() {
    if (!canSendForQc || sendingQc) return
    setSendingQc(true)
    const data = await productionApi.sendBatchForQc(batchId)
    setSendingQc(false)
    if (data.error) {
      toast.error(data.error)
      return
    }
    toast.success(data.message || 'Sent to lab for SFG QC')
    if (data.batch) {
      setQcStatus(data.batch.qc_status || 'pending_qc')
      setQcSentAt(data.batch.qc_sent_at || null)
    } else {
      setQcStatus('pending_qc')
      setQcSentAt(new Date().toISOString())
    }
  }

  function fillStageStartNow(logId: string) {
    updateStageLog(logId, {
      start_date: nowDate(),
      start_time: nowTime(),
    })
  }

  function fillStageEndNow(logId: string) {
    updateStageLog(logId, {
      end_date: nowDate(),
      end_time: nowTime(),
    })
  }

  function previousTimedLog(fromIndex: number): StageLog | undefined {
    for (let i = fromIndex; i >= 0; i--) {
      const log = orderedStageLogs[i]
      if (!log) continue
      if (isIntegrityOnlyStage(stageById.get(log.stage_id))) continue
      if (log.end_date || log.end_time || log.start_date || log.start_time) return log
    }
    return undefined
  }

  /** Next stage starts when previous ends (Excel sequence). */
  function applyStartFromPrevious(index: number) {
    if (index <= 0) return
    const prev = previousTimedLog(index - 1)
    const curr = orderedStageLogs[index]
    if (!prev || !curr) return
    updateStageLog(curr.id, {
      start_date: clampTodayOrLater(prev.end_date || prev.start_date || nowDate()),
      start_time: prev.end_time || prev.start_time || nowTime(),
    })
  }

  function confirmIntegrity(logId: string) {
    const log = stageLogs.find((l) => l.id === logId)
    if (!log) return
    if (log.integrity_ok !== true && log.integrity_ok !== false) {
      toast.error('Confirm filter integrity')
      return
    }
    setStartedStageIds((prev) => new Set(prev).add(logId))
    setEndedStageIds((prev) => new Set(prev).add(logId))
    void persist({ silent: true })
  }

  function goToNextProcessStage() {
    const curr = orderedStageLogs[processStageIndex]
    const nextIdx = processStageIndex + 1
    if (!curr || nextIdx >= orderedStageLogs.length) return

    const stage = stageById.get(curr.stage_id)
    const washSteps = washStepsForLog(curr)
    if (washSteps.length > 0) {
      const incomplete = washSteps.find((step) => {
        const key = crudeWashKey(curr.id, step.material_name)
        return !washEndFilled(step) || !endedWashKeys.has(key)
      })
      if (incomplete) {
        toast.error(`End ${incomplete.material_name} before continuing`)
        return
      }
    } else if (isIntegrityOnlyStage(stage)) {
      if (
        (curr.integrity_ok !== true && curr.integrity_ok !== false) ||
        !endedStageIds.has(curr.id)
      ) {
        toast.error('Confirm filter integrity before continuing')
        return
      }
    } else {
      if (!startedStageIds.has(curr.id) || !isStageStartComplete(curr, stage)) {
        toast.error('Start this stage before continuing')
        return
      }
      if (!endedStageIds.has(curr.id) || !isStageEndComplete(curr, stage)) {
        toast.error('End this stage before continuing')
        return
      }
    }

    const source = isIntegrityOnlyStage(stage) ? previousTimedLog(processStageIndex - 1) : curr
    const endDate = source?.end_date || source?.start_date
    const endTime = source?.end_time || source?.start_time

    const nextLog = orderedStageLogs[nextIdx]
    if (
      nextLog &&
      (endDate || endTime) &&
      !isIntegrityOnlyStage(stageById.get(nextLog.stage_id)) &&
      !isStageStartComplete(nextLog, stageById.get(nextLog.stage_id))
    ) {
      if (!nextLog.start_date && !nextLog.start_time) {
        updateStageLog(nextLog.id, {
          start_date: endDate ? clampTodayOrLater(endDate) : null,
          start_time: endTime || null,
        })
      }
    }
    setProcessStageIndex(nextIdx)
  }

  function goToPrevProcessStage() {
    if (processStageIndex <= 0) return
    setProcessStageIndex(processStageIndex - 1)
  }

  const effectiveFactory = factoryId || ctxFactoryId
  const busy = saving || completing
  const stepBlockReason =
    step === 1
      ? headerError()
      : step === 2
        ? rmError()
        : step === 3
          ? processError()
          : step === 4
            ? finishedError()
            : null

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="mb-4 hidden lg:block">
        <PageHeader
          title={batchNo || 'Batch'}
          subtitle={`${productCode}${productName ? ` · ${productName}` : ''} · ${status.replace('_', ' ')}${
            isOwnerView && status !== 'completed' ? ' · view only' : ''
          }`}
          accent={accent}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ProductionRecordExportButton
                factoryId={effectiveFactory}
                productId={productId}
                disabled={loading || !productId}
              />
              <Link href={listHref} className="btn btn-ghost">
                ← All batches
              </Link>
            </div>
          }
        />
        </div>

        <div className="mb-3 lg:hidden">
          <Link href={listHref} className="text-sm text-muted">
            ← All batches
          </Link>
          <p className="mt-1 text-sm font-medium text-primary">{batchNo || 'Batch'}</p>
          <p className="text-xs text-muted">
            {productCode}
            {productName ? ` · ${productName}` : ''}
            {` · ${status.replace('_', ' ')}`}
          </p>
        </div>

        {isOwnerView && (
          <div className="mt-4 rounded-xl border border-owner/30 bg-owner/5 px-4 py-3 text-sm text-foreground">
            <span className="font-medium text-owner">Admin view · read only.</span>
            {' '}
            You can browse every step; only the chemist can edit this batch.
          </div>
        )}

        {loading || !stepReady ? (
          <SkeletonPanel className="mt-6" rows={6} />
        ) : (
          <>
            <div className="table-panel mt-6">
            {/* Progress */}
            <div className="border-b border-border px-4 py-4 md:px-6">
              <p className="mb-3 text-sm font-medium text-primary">
                Step {step} of 5 · {stepLabel(step, batchKind)}
              </p>
              <ol className="grid grid-cols-5 gap-1 sm:gap-2">
                {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => {
                  const done = s < step || (s < 5 && isStepComplete(s)) || (readOnly && s <= 5)
                  const active = s === step
                  const canJump = readOnly || s <= step
                  return (
                    <li key={s} className="min-w-0">
                      <button
                        type="button"
                        disabled={!canJump}
                        onClick={() => {
                          if (canJump) setStep(s)
                        }}
                        className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors ${
                          canJump ? 'hover:bg-muted/30' : 'cursor-default'
                        } ${
                          active
                            ? isOwnerView
                              ? 'bg-owner/15 text-owner'
                              : 'bg-chemist/15 text-chemist'
                            : done
                              ? isOwnerView
                                ? 'text-owner'
                                : 'text-chemist'
                              : 'text-muted'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                            active
                              ? isOwnerView
                                ? 'bg-owner text-white'
                                : 'bg-chemist text-white'
                              : done
                                ? isOwnerView
                                  ? 'bg-owner/20 text-owner'
                                  : 'bg-chemist/20 text-chemist'
                                : 'bg-muted/50 text-muted'
                          }`}
                        >
                          {done && !active ? <Check size={14} /> : s}
                        </span>
                        <span className="hidden truncate text-[10px] sm:block">
                          {stepLabel(s, batchKind)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>

            {/* Step body */}
            <div className="px-4 py-5 md:px-6">
              <p className="mb-4 text-sm text-muted">{stepHint(step, batchKind)}</p>
              {step === 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">Batch no</span>
                      <input
                        readOnly
                        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-muted"
                        value={batchNo}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">Vessel *</span>
                      <input
                        disabled={readOnly}
                        className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                        value={vessel}
                        onChange={(e) => setVessel(e.target.value)}
                        required
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">Mfg date *</span>
                      <input
                        type="date"
                        min={nowDate()}
                        disabled={readOnly}
                        className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                        value={mfgDate}
                        onChange={(e) => setMfgDate(clampTodayOrLater(e.target.value))}
                        required
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">Chemist</span>
                      <input
                        readOnly
                        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted"
                        value={chemistName || '—'}
                      />
                    </label>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  {!effectiveFactory && (
                    <p className="text-xs text-amber-700">
                      Select a factory in the header to load released lots.
                    </p>
                  )}
                  {rmLines.length === 0 ? (
                    <p className="text-sm text-muted">No RM lines on this template.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {[...rms]
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((def) => {
                          const lines = rmLines
                            .filter((l) => l.rm_def_id === def.id && isRmLineVisible(l))
                            .sort((a, b) => (a.lot_slot ?? 0) - (b.lot_slot ?? 0))
                          if (lines.length === 0) return null
                          const revealed = revealedLotSlots[def.id] ?? 1
                          const maxLots = consumptionMaxLots(def)
                          const canAddLot = !readOnly && revealed < maxLots
                          const releasedLots = lotsForDef(
                            def,
                            lotsByMaterial,
                            batchKind,
                            rms,
                          )
                          const total = Number(rmTotals[def.id]) || 0
                          const allocated = lines.reduce(
                            (s, l) => s + (Number(l.qty) || 0),
                            0,
                          )
                          const remaining = total - allocated
                          const allLocked = lines.every((l) => Boolean(l.usage_entry_id))
                          const balanced =
                            total > 0 && Math.abs(remaining) <= 1e-9 && allocated > 0
                          const pct =
                            total > 0
                              ? Math.min(100, Math.max(0, (allocated / total) * 100))
                              : 0
                          const noStock = Boolean(effectiveFactory) && releasedLots.length === 0
                          const multi = lines.length > 1
                          return (
                            <div
                              key={def.id}
                              className={`overflow-hidden rounded-lg border border-border bg-panel ${
                                noStock ? 'opacity-90' : ''
                              }`}
                            >
                              {/* Title + total */}
                              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">
                                    {def.material_name || 'Material'}
                                  </p>
                                  <p className="text-[11px] text-muted">
                                    {def.unit || 'Kg'}
                                    {defStockKind(def, batchKind, rms) === 'sfg'
                                      ? ' · SFG lots'
                                      : ' · RM lots'}
                                    {def.lot_required ? ' · lot required' : ''}
                                    {allLocked ? ' · deducted' : ''}
                                  </p>
                                </div>
                                <label className="flex items-center gap-1.5 text-xs text-muted">
                                  <span>Needed</span>
                                  <input
                                    type="number"
                                    step="0.001"
                                    disabled={readOnly || allLocked}
                                    className="w-24 rounded-md border border-border bg-panel px-2 py-1 text-sm font-medium tabular-nums disabled:opacity-60"
                                    value={total || ''}
                                    placeholder="Qty"
                                    onChange={(e) =>
                                      setMaterialTotal(
                                        def.id,
                                        e.target.value === '' ? 0 : Number(e.target.value),
                                      )
                                    }
                                  />
                                </label>
                              </div>

                              {/* Progress when total set */}
                              {total > 0 ? (
                                <div className="px-3 pt-2">
                                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                                    <span
                                      className={
                                        balanced
                                          ? 'font-medium text-chemist'
                                          : remaining > 0
                                            ? 'text-amber-700'
                                            : 'text-amber-700'
                                      }
                                    >
                                      {balanced
                                        ? `Fully allocated · ${allocated.toFixed(3)} ${def.unit || 'Kg'}`
                                        : remaining > 0
                                          ? `${allocated.toFixed(3)} of ${total.toFixed(3)} · still need ${remaining.toFixed(3)}`
                                          : `${allocated.toFixed(3)} of ${total.toFixed(3)} · ${Math.abs(remaining).toFixed(3)} over`}
                                    </span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        balanced
                                          ? 'bg-chemist'
                                          : remaining < 0
                                            ? 'bg-amber-500'
                                            : 'bg-chemist/60'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              ) : null}

                              {noStock ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
                                  <p className="text-[11px] text-amber-700">
                                    No released stock — request and get warehouse release first.
                                  </p>
                                  {!readOnly && !isOwnerView ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRequestBusy(false)
                                        setRequestOpen(true)
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-chemist hover:underline"
                                    >
                                      <Plus size={12} />
                                      Request material
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}

                              {/* Lot takes */}
                              <div className="space-y-1.5 px-3 py-2.5">
                                {lines.map((line, idx) => {
                                  const qty = Number(line.qty) || 0
                                  const needsLot =
                                    Boolean(def.lot_required) && qty > 0
                                  const missingLot = needsLot && !line.lot_invoice
                                  const availQty = line.lot_invoice
                                    ? releasedLeftForLine(def, line.lot_invoice, line.id)
                                    : null
                                  const overLot =
                                    availQty != null && qty > availQty + 1e-9
                                  const canRemove =
                                    !readOnly &&
                                    !line.usage_entry_id &&
                                    lines.length > 1
                                  const usedBySiblings = siblingInvoices(def.id, line.id)
                                  const lotOptions = releasedLots.filter(
                                    (lot) =>
                                      !usedBySiblings.has(lot.invoice_number) ||
                                      lot.invoice_number === line.lot_invoice,
                                  )
                                  const lotLocked =
                                    readOnly || Boolean(line.usage_entry_id)
                                  const takeLocked =
                                    lotLocked ||
                                    (Boolean(def.lot_required) && !line.lot_invoice)
                                  return (
                                    <div
                                      key={line.id}
                                      className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 ${
                                        multi ? 'bg-panel/80 ring-1 ring-border/60' : ''
                                      } ${missingLot || overLot ? 'ring-amber-400/70' : ''}`}
                                    >
                                      {multi ? (
                                        <span className="w-12 shrink-0 text-[11px] font-medium text-muted">
                                          Lot {idx + 1}
                                        </span>
                                      ) : (
                                        <span className="w-14 shrink-0 text-[11px] text-muted">
                                          GRN
                                        </span>
                                      )}
                                      <select
                                        disabled={lotLocked || noStock}
                                        className={`min-w-[12rem] flex-1 rounded-md border bg-panel px-2 py-1.5 text-xs disabled:opacity-60 ${
                                          missingLot
                                            ? 'border-amber-500'
                                            : 'border-border'
                                        }`}
                                        value={line.lot_invoice || ''}
                                        onChange={(e) =>
                                          selectLotForLine(
                                            line,
                                            def,
                                            e.target.value || null,
                                          )
                                        }
                                      >
                                        <option value="">
                                          {noStock ? 'No released GRN' : 'Select GRN…'}
                                        </option>
                                        {lotOptions.map((lot) => {
                                          const left =
                                            releasedLeftForLine(
                                              def,
                                              lot.invoice_number,
                                              line.id,
                                            ) ?? Number(lot.tons_remaining)
                                          return (
                                            <option
                                              key={lot.invoice_number}
                                              value={lot.invoice_number}
                                              disabled={left <= 1e-9}
                                            >
                                              {lotOptionLabel(lot, left)}
                                            </option>
                                          )
                                        })}
                                      </select>
                                      <label className="flex items-center gap-1 text-[11px] text-muted">
                                        <span>Take</span>
                                        <input
                                          type="number"
                                          step="0.001"
                                          disabled={takeLocked}
                                          className={`w-[5.5rem] rounded-md border bg-panel px-2 py-1.5 text-xs tabular-nums disabled:opacity-60 ${
                                            overLot
                                              ? 'border-amber-500'
                                              : 'border-border'
                                          }`}
                                          value={line.qty || ''}
                                          placeholder="Qty"
                                          onChange={(e) =>
                                            updateRmLine(line.id, {
                                              qty:
                                                e.target.value === ''
                                                  ? 0
                                                  : Number(e.target.value),
                                            })
                                          }
                                        />
                                      </label>
                                      {canRemove ? (
                                        <button
                                          type="button"
                                          onClick={() => void removeRmLot(line)}
                                          className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
                                          title="Remove this lot"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      ) : null}
                                    </div>
                                  )
                                })}

                                {canAddLot && total > 0 && remaining > 1e-9 ? (
                                  <button
                                    type="button"
                                    onClick={() => void addRmLot(def.id)}
                                    className="mt-0.5 text-xs font-medium text-chemist hover:underline"
                                  >
                                    + Split remaining {remaining.toFixed(3)} across another
                                    lot
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  {orderedStageLogs.length === 0 ? (
                    <p className="text-sm text-muted">No process stages on this template.</p>
                  ) : (
                    <>
                      {/* Sequence strip */}
                      <ol className="flex flex-wrap items-center gap-1.5">
                        {orderedStageLogs.map((log, i) => {
                          const stage = stageById.get(log.stage_id)
                          const active = i === processStageIndex
                          const washSteps = washStepsForLog(log)
                          const startOk = washSteps.length
                            ? washSteps.every(washStartFilled)
                            : isStageStartComplete(log, stage)
                          const endOk = washSteps.length
                            ? washSteps.every(washEndFilled)
                            : isStageEndComplete(log, stage)
                          const started = washSteps.length
                            ? washSteps.some(
                                (step) =>
                                  startedWashKeys.has(crudeWashKey(log.id, step.material_name)) ||
                                  (readOnly && washStartFilled(step)),
                              )
                            : startOk && startedStageIds.has(log.id)
                          const ended = washSteps.length
                            ? washSteps.every(
                                (step) =>
                                  washEndFilled(step) &&
                                  (endedWashKeys.has(crudeWashKey(log.id, step.material_name)) ||
                                    readOnly),
                              )
                            : startOk && endOk && endedStageIds.has(log.id)
                          const running = started && !ended
                          const done = ended || i < processStageIndex
                          const lotSlot = log.lot_slot ?? 1
                          const showLot =
                            Boolean(resolveStageLotRm(stage, rms)) ||
                            orderedStageLogs.filter((l) => l.stage_id === log.stage_id)
                              .length > 1
                          return (
                            <li key={log.id} className="flex items-center gap-1.5">
                              {i > 0 && (
                                <span className="text-muted" aria-hidden>
                                  →
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setProcessStageIndex(i)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                  active
                                    ? 'bg-chemist text-white'
                                    : done
                                      ? 'bg-chemist/15 text-chemist'
                                      : running
                                        ? 'bg-chemist/25 text-chemist ring-1 ring-chemist/40'
                                        : 'bg-muted/40 text-muted hover:text-foreground'
                                }`}
                              >
                                {i + 1}. {stage?.name || 'Stage'}
                                {showLot ? ` · Lot ${lotSlot}` : ''}
                              </button>
                            </li>
                          )
                        })}
                      </ol>

                      {(() => {
                        const log = orderedStageLogs[processStageIndex]
                        if (!log) return null
                        const stage = stageById.get(log.stage_id)
                        const isFirst = processStageIndex === 0
                        const isLast = processStageIndex === orderedStageLogs.length - 1
                        const prevName = !isFirst
                          ? stageById.get(orderedStageLogs[processStageIndex - 1]?.stage_id)
                              ?.name
                          : null
                        const nextName = !isLast
                          ? stageById.get(orderedStageLogs[processStageIndex + 1]?.stage_id)
                              ?.name
                          : null

                        const captureStart =
                          stage?.capture_start_date !== false ||
                          stage?.capture_start_time !== false ||
                          stage?.capture_start_temp !== false
                        const captureEnd =
                          stage?.capture_end_date !== false ||
                          stage?.capture_end_time !== false ||
                          stage?.capture_end_temp !== false ||
                          Boolean(stage?.capture_integrity)

                        const startComplete = isStageStartComplete(log, stage)
                        const endComplete = isStageEndComplete(log, stage)
                        // Never treat as started/ended without the underlying values
                        // Owner view: treat filled data as confirmed so end fields are visible
                        const started =
                          startComplete &&
                          (startedStageIds.has(log.id) || readOnly)
                        const ended =
                          startComplete &&
                          endComplete &&
                          (endedStageIds.has(log.id) || readOnly)
                        const startLocked = readOnly || started
                        const endLocked = readOnly || ended
                        const lotSlot = log.lot_slot ?? 1
                        const lotRm = resolveStageLotRm(stage, rms)
                        const maxLotRuns = lotRm
                          ? Math.min(10, Math.max(1, lotRm.max_lots || 2))
                          : 1
                        const runsForStage = orderedStageLogs.filter(
                          (l) => l.stage_id === log.stage_id,
                        ).length
                        const washMaterials = isCrudeWashStage(stage?.name)
                          ? crudeWashMaterials(rms, stage?.process)
                          : []
                        const washSteps = washMaterials.length
                          ? alignCrudeWashSteps(log.wash_steps, washMaterials)
                          : []
                        const usingWashes = washSteps.length > 0
                        const activeWashIndex = usingWashes
                          ? washSteps.findIndex((step) => {
                              const key = crudeWashKey(log.id, step.material_name)
                              return !(
                                washEndFilled(step) &&
                                (endedWashKeys.has(key) || readOnly)
                              )
                            })
                          : -1
                        const activeWash =
                          activeWashIndex >= 0 ? washSteps[activeWashIndex] : null
                        const activeWashKey = activeWash
                          ? crudeWashKey(log.id, activeWash.material_name)
                          : ''
                        const activeWashStarted = Boolean(
                          activeWash &&
                            washStartFilled(activeWash) &&
                            (startedWashKeys.has(activeWashKey) || readOnly),
                        )

                        const integrityOnly = isIntegrityOnlyStage(stage)
                        const integrityChosen =
                          log.integrity_ok === true || log.integrity_ok === false
                        const integrityDone =
                          integrityChosen && (endedStageIds.has(log.id) || readOnly)
                        // End fields only after explicit "Start this stage"
                        const showEndFields =
                          usingWashes || integrityOnly ? false : started && captureEnd
                        const phase: 'start' | 'end' | 'done' = usingWashes
                          ? !activeWash
                            ? 'done'
                            : activeWashStarted
                              ? 'end'
                              : 'start'
                          : integrityOnly
                            ? integrityDone
                              ? 'done'
                              : 'end'
                            : !started
                              ? 'start'
                              : captureEnd && !ended
                                ? 'end'
                                : 'done'
                        const canAddLotRun =
                          !readOnly &&
                          phase === 'done' &&
                          Boolean(lotRm?.allow_multi_lot) &&
                          runsForStage < maxLotRuns

                        const lotRmLine = lotRm
                          ? rmLines.find(
                              (l) =>
                                l.rm_def_id === lotRm.id &&
                                (l.lot_slot ?? 1) === lotSlot,
                            )
                          : undefined
                        const rmLocked =
                          readOnly || Boolean(lotRmLine?.usage_entry_id)
                        const lotRmLots = lotRm
                          ? lotsForDef(lotRm, lotsByMaterial, batchKind, rms)
                          : []
                        const lotQtyMissing =
                          Boolean(lotRm) && !(Number(lotRmLine?.qty) > 0)
                        const lotInvoiceMissing =
                          Boolean(lotRm?.lot_required) &&
                          Number(lotRmLine?.qty) > 0 &&
                          !lotRmLine?.lot_invoice
                        const startReady =
                          startComplete && !lotQtyMissing && !lotInvoiceMissing

                        return (
                          <div
                            className={`rounded-xl border bg-panel p-4 ${
                              isOwnerView
                                ? 'border-owner/30'
                                : 'border-chemist/30'
                            }`}
                          >
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-mono uppercase tracking-wider text-muted">
                                Stage {processStageIndex + 1} of {orderedStageLogs.length}
                                {usingWashes
                                  ? ` · Wash ${
                                      activeWashIndex < 0 ? washSteps.length : activeWashIndex + 1
                                    } of ${washSteps.length}`
                                  : ''}
                                {' · '}
                                {integrityOnly
                                  ? phase === 'done'
                                    ? 'Complete'
                                    : 'Confirm'
                                  : phase === 'start'
                                    ? 'Record start'
                                    : phase === 'end'
                                      ? 'In progress · record end'
                                      : 'Complete'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {!readOnly &&
                                  phase === 'start' &&
                                  usingWashes &&
                                  activeWash &&
                                  !(activeWashIndex <= 0 && isFirst) && (
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-chemist hover:underline"
                                    onClick={() => {
                                      if (activeWashIndex <= 0) {
                                        const prev = orderedStageLogs[processStageIndex - 1]
                                        updateWashStep(log.id, activeWash.material_name, {
                                          start_date: clampTodayOrLater(
                                            prev?.end_date || prev?.start_date || nowDate(),
                                          ),
                                          start_time: prev?.end_time || prev?.start_time || nowTime(),
                                        })
                                        return
                                      }
                                      const prevWash = washSteps[activeWashIndex - 1]
                                      updateWashStep(log.id, activeWash.material_name, {
                                        start_date: clampTodayOrLater(
                                          prevWash?.end_date || prevWash?.start_date || nowDate(),
                                        ),
                                        start_time:
                                          prevWash?.end_time || prevWash?.start_time || nowTime(),
                                      })
                                    }}
                                  >
                                    Start = end of{' '}
                                    {activeWashIndex <= 0
                                      ? prevName || 'previous'
                                      : washSteps[activeWashIndex - 1]?.material_name}
                                  </button>
                                )}
                                {!readOnly && phase === 'start' && !usingWashes && !isFirst && (
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-chemist hover:underline"
                                    onClick={() => applyStartFromPrevious(processStageIndex)}
                                  >
                                    Start = end of {prevName || 'previous'}
                                  </button>
                                )}
                                {!readOnly &&
                                  phase === 'start' &&
                                  (usingWashes ? Boolean(activeWash) : captureStart) && (
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-chemist hover:underline"
                                    onClick={() =>
                                      usingWashes && activeWash
                                        ? updateWashStep(log.id, activeWash.material_name, {
                                            start_date: nowDate(),
                                            start_time: nowTime(),
                                          })
                                        : fillStageStartNow(log.id)
                                    }
                                  >
                                    Start = now
                                  </button>
                                )}
                                {!readOnly &&
                                  phase === 'end' &&
                                  !integrityOnly &&
                                  (usingWashes ? Boolean(activeWash) : captureEnd) && (
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-chemist hover:underline"
                                    onClick={() =>
                                      usingWashes && activeWash
                                        ? updateWashStep(log.id, activeWash.material_name, {
                                            end_date: nowDate(),
                                            end_time: nowTime(),
                                          })
                                        : fillStageEndNow(log.id)
                                    }
                                  >
                                    End = now
                                  </button>
                                )}
                              </div>
                            </div>
                            <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                              {stage?.name || 'Stage'}
                              {lotRm || runsForStage > 1 ? ` · Lot ${lotSlot}` : ''}
                            </h3>
                            {usingWashes && activeWash && (
                              <p className="mb-1 text-sm font-medium text-foreground">
                                {activeWash.material_name}
                              </p>
                            )}
                            <p className="mb-4 text-sm text-muted">
                              {integrityOnly
                                ? phase === 'done'
                                  ? 'Filter integrity confirmed. Continue when ready.'
                                  : 'Confirm whether the filter passed. No start or end time.'
                                : usingWashes
                                ? phase === 'start'
                                  ? `Enter the start for ${activeWash?.material_name || 'this wash'}. The next wash starts when this one ends.`
                                  : phase === 'end'
                                    ? `In progress — enter the end for ${activeWash?.material_name || 'this wash'}.`
                                    : 'Each wash start and end is recorded. Continue when ready.'
                                : phase === 'start'
                                  ? lotRm
                                    ? `Enter ${lotRm.material_name} for this lot, then start.`
                                    : 'Enter start, then start this stage.'
                                  : phase === 'end'
                                    ? 'In progress — enter end when it finishes.'
                                    : 'Start and end recorded. Continue when ready.'}
                            </p>
                            {canAddLotRun && (
                              <div className="mb-4 rounded-lg border border-chemist/30 bg-chemist/5 px-3 py-2 text-sm">
                                <button
                                  type="button"
                                  onClick={() => void addStageLotRun(log.stage_id)}
                                  className="font-medium text-chemist hover:underline"
                                >
                                  + Add another {lotRm?.material_name || 'material'} lot
                                </button>
                                <span className="text-muted">
                                  {' '}
                                  — run this stage again for lot {runsForStage + 1} before
                                  continuing
                                </span>
                              </div>
                            )}

                            {lotRm && lotRmLine && (
                              <div
                                className={`mb-4 grid gap-3 rounded-lg border bg-panel/60 p-3 sm:grid-cols-2 ${
                                  lotQtyMissing || lotInvoiceMissing
                                    ? 'border-amber-500/50'
                                    : 'border-border'
                                }`}
                              >
                                <p className="sm:col-span-2 text-xs font-mono uppercase tracking-wider text-muted">
                                  {lotRm.material_name} · Lot {lotSlot} consumption
                                  {lotRmLine.usage_entry_id ? ' · deducted' : ''}
                                </p>
                                <label className="block text-sm">
                                  <span className="mb-1 block text-muted">
                                    Qty used ({lotRm.unit || 'Kg'})
                                  </span>
                                  <input
                                    type="number"
                                    step="0.001"
                                    disabled={rmLocked}
                                    className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                    value={lotRmLine.qty || ''}
                                    onChange={(e) =>
                                      updateRmLine(lotRmLine.id, {
                                        qty:
                                          e.target.value === ''
                                            ? 0
                                            : Number(e.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label className="block text-sm">
                                  <span className="mb-1 block text-muted">Lot / GRN</span>
                                  <select
                                    disabled={rmLocked}
                                    className={`w-full rounded-lg border bg-panel px-3 py-2 disabled:opacity-60 ${
                                      lotInvoiceMissing
                                        ? 'border-amber-500'
                                        : 'border-border'
                                    }`}
                                    value={lotRmLine.lot_invoice || ''}
                                    onChange={(e) =>
                                      selectLotForLine(
                                        lotRmLine,
                                        lotRm,
                                        e.target.value || null,
                                      )
                                    }
                                  >
                                    <option value="">—</option>
                                    {lotRmLots
                                      .filter(
                                        (lot) =>
                                          !siblingInvoices(lotRm.id, lotRmLine.id).has(
                                            lot.invoice_number,
                                          ) ||
                                          lot.invoice_number === lotRmLine.lot_invoice,
                                      )
                                      .map((lot) => {
                                        const left =
                                          releasedLeftForLine(
                                            lotRm,
                                            lot.invoice_number,
                                            lotRmLine.id,
                                          ) ?? Number(lot.tons_remaining)
                                        return (
                                          <option
                                            key={lot.invoice_number}
                                            value={lot.invoice_number}
                                            disabled={left <= 1e-9}
                                          >
                                            {lotOptionLabel(lot, left)}
                                          </option>
                                        )
                                      })}
                                  </select>
                                </label>
                              </div>
                            )}

                            {usingWashes && (
                              <div className="space-y-3">
                                {washSteps.map((step, washIndex) => {
                                  const key = crudeWashKey(log.id, step.material_name)
                                  const done =
                                    washEndFilled(step) &&
                                    (endedWashKeys.has(key) || readOnly)
                                  const current = washIndex === activeWashIndex
                                  if (!current) {
                                    return (
                                      <div
                                        key={key}
                                        className="rounded-lg border border-border px-3 py-2 text-sm"
                                      >
                                        <p
                                          className={
                                            done
                                              ? 'font-medium text-foreground'
                                              : 'text-muted'
                                          }
                                        >
                                          {washIndex + 1}. {step.material_name}
                                        </p>
                                        {done ? (
                                          <p className="text-muted">
                                            {step.start_date} {step.start_time} → {step.end_date}{' '}
                                            {step.end_time}
                                          </p>
                                        ) : null}
                                      </div>
                                    )
                                  }
                                  const lockStart = readOnly || phase !== 'start'
                                  const showThisEnd = readOnly || phase !== 'start'
                                  const lockEnd = readOnly || phase !== 'end'
                                  return (
                                    <div key={key} className="space-y-4">
                                      <div>
                                        <p className="mb-2 text-xs font-mono uppercase tracking-wider text-muted">
                                          Start
                                        </p>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                          <label className="block text-sm">
                                            <span className="mb-1 block text-muted">Start date</span>
                                            <input
                                              type="date"
                                              min={nowDate()}
                                              disabled={lockStart}
                                              className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                              value={step.start_date || ''}
                                              onChange={(e) =>
                                                updateWashStep(log.id, step.material_name, {
                                                  start_date:
                                                    clampTodayOrLater(e.target.value) || null,
                                                })
                                              }
                                            />
                                          </label>
                                          <label className="block text-sm">
                                            <span className="mb-1 block text-muted">Start time</span>
                                            <input
                                              type="time"
                                              disabled={lockStart}
                                              className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                              value={step.start_time || ''}
                                              onChange={(e) =>
                                                updateWashStep(log.id, step.material_name, {
                                                  start_time: e.target.value || null,
                                                })
                                              }
                                            />
                                          </label>
                                        </div>
                                      </div>
                                      {showThisEnd && (
                                        <div>
                                          <p className="mb-2 text-xs font-mono uppercase tracking-wider text-muted">
                                            End
                                          </p>
                                          <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="block text-sm">
                                              <span className="mb-1 block text-muted">End date</span>
                                              <input
                                                type="date"
                                                min={nowDate()}
                                                disabled={lockEnd}
                                                className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                                value={step.end_date || ''}
                                                onChange={(e) =>
                                                  updateWashStep(log.id, step.material_name, {
                                                    end_date:
                                                      clampTodayOrLater(e.target.value) || null,
                                                  })
                                                }
                                              />
                                            </label>
                                            <label className="block text-sm">
                                              <span className="mb-1 block text-muted">End time</span>
                                              <input
                                                type="time"
                                                disabled={lockEnd}
                                                className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                                value={step.end_time || ''}
                                                onChange={(e) =>
                                                  updateWashStep(log.id, step.material_name, {
                                                    end_time: e.target.value || null,
                                                  })
                                                }
                                              />
                                            </label>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {!usingWashes && !integrityOnly && (
                            <div
                              className={`${showEndFields ? 'mb-4 border-b border-border pb-4' : ''}`}
                            >
                              {captureStart ? (
                                <p className="mb-2 text-xs font-mono uppercase tracking-wider text-muted">
                                  Start
                                </p>
                              ) : null}
                              <div className="grid gap-3 sm:grid-cols-3">
                              {stage?.capture_start_date !== false && (
                                <label className="block text-sm">
                                  <span className="mb-1 block text-muted">Start date</span>
                                  <input
                                    type="date"
                                    min={nowDate()}
                                    disabled={startLocked}
                                    className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                    value={log.start_date || ''}
                                    onChange={(e) =>
                                      updateStageLog(log.id, {
                                        start_date: clampTodayOrLater(e.target.value) || null,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              {stage?.capture_start_time !== false && (
                                <label className="block text-sm">
                                  <span className="mb-1 block text-muted">Start time</span>
                                  <input
                                    type="time"
                                    disabled={startLocked}
                                    className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                    value={log.start_time || ''}
                                    onChange={(e) =>
                                      updateStageLog(log.id, {
                                        start_time: e.target.value || null,
                                      })
                                    }
                                  />
                                </label>
                              )}
                              {stage?.capture_start_temp !== false && (
                                <label className="block text-sm">
                                  <span className="mb-1 block text-muted">Start temp</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    disabled={startLocked}
                                    className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                    value={log.start_temp ?? ''}
                                    onChange={(e) =>
                                      updateStageLog(log.id, {
                                        start_temp:
                                          e.target.value === ''
                                            ? null
                                            : Number(e.target.value),
                                      })
                                    }
                                  />
                                </label>
                              )}
                              </div>
                            </div>
                            )}

                            {showEndFields && (
                              <div className="mb-1">
                                <p className="mb-2 text-xs font-mono uppercase tracking-wider text-muted">
                                  End
                                </p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {stage?.capture_end_date !== false && (
                                  <label className="block text-sm">
                                    <span className="mb-1 block text-muted">End date</span>
                                    <input
                                      type="date"
                                      min={nowDate()}
                                      disabled={endLocked}
                                      className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                      value={log.end_date || ''}
                                      onChange={(e) =>
                                        updateStageLog(log.id, {
                                          end_date: clampTodayOrLater(e.target.value) || null,
                                        })
                                      }
                                    />
                                  </label>
                                )}
                                {stage?.capture_end_time !== false && (
                                  <label className="block text-sm">
                                    <span className="mb-1 block text-muted">End time</span>
                                    <input
                                      type="time"
                                      disabled={endLocked}
                                      className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                      value={log.end_time || ''}
                                      onChange={(e) =>
                                        updateStageLog(log.id, {
                                          end_time: e.target.value || null,
                                        })
                                      }
                                    />
                                  </label>
                                )}
                                {stage?.capture_end_temp !== false && (
                                  <label className="block text-sm">
                                    <span className="mb-1 block text-muted">End temp</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      disabled={endLocked}
                                      className="w-full rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                                      value={log.end_temp ?? ''}
                                      onChange={(e) =>
                                        updateStageLog(log.id, {
                                          end_temp:
                                            e.target.value === ''
                                              ? null
                                              : Number(e.target.value),
                                        })
                                      }
                                    />
                                  </label>
                                )}
                              </div>
                              </div>
                            )}

                            {(integrityOnly || showEndFields) && stage?.capture_integrity && (
                              <div className="mt-3">
                                <p className="mb-1 text-sm text-muted">Filter integrity</p>
                                <div className="flex gap-2">
                                  {(['ok', 'not_ok'] as const).map((v) => {
                                    const selected =
                                      v === 'ok'
                                        ? log.integrity_ok === true
                                        : log.integrity_ok === false
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        disabled={endLocked}
                                        onClick={() =>
                                          updateStageLog(log.id, {
                                            integrity_ok: v === 'ok',
                                          })
                                        }
                                        className={`rounded-lg px-3 py-2 text-sm ${
                                          selected
                                            ? 'bg-chemist text-white'
                                            : 'border border-border text-muted'
                                        } disabled:opacity-60`}
                                      >
                                        {v === 'ok' ? 'Ok' : 'Not Ok'}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {!readOnly && (
                              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                                <button
                                  type="button"
                                  disabled={isFirst}
                                  onClick={goToPrevProcessStage}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
                                >
                                  <ChevronLeft size={16} />
                                  Previous stage
                                </button>

                                {integrityOnly && phase !== 'done' ? (
                                  <button
                                    type="button"
                                    disabled={log.integrity_ok !== true && log.integrity_ok !== false}
                                    onClick={() => confirmIntegrity(log.id)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-chemist px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Confirm filter integrity
                                  </button>
                                ) : phase === 'start' ? (
                                  <button
                                    type="button"
                                    disabled={
                                      usingWashes
                                        ? !activeWash || !washStartFilled(activeWash)
                                        : !startReady
                                    }
                                    onClick={() =>
                                      usingWashes && activeWash
                                        ? void confirmWashStart(log.id, activeWash.material_name)
                                        : void confirmStageStart(log.id)
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg bg-chemist px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {usingWashes ? 'Start this wash' : 'Start this stage'}
                                  </button>
                                ) : phase === 'end' ? (
                                  <button
                                    type="button"
                                    disabled={
                                      usingWashes
                                        ? !activeWash || !washEndFilled(activeWash)
                                        : !endComplete
                                    }
                                    onClick={() =>
                                      usingWashes && activeWash
                                        ? confirmWashEnd(log.id, activeWash.material_name)
                                        : confirmStageEnd(log.id)
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg bg-chemist px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {usingWashes ? 'End this wash' : 'End this stage'}
                                  </button>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    {canAddLotRun && (
                                      <button
                                        type="button"
                                        onClick={() => void addStageLotRun(log.stage_id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-chemist px-4 py-2 text-sm font-medium text-chemist hover:bg-chemist/10"
                                      >
                                        + Add {lotRm?.material_name || 'another'} lot
                                      </button>
                                    )}
                                    {!isLast ? (
                                      <button
                                        type="button"
                                        onClick={goToNextProcessStage}
                                        className="inline-flex items-center gap-1 rounded-lg bg-chemist px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                                      >
                                        Next:{' '}
                                        {nextName
                                          ? `${nextName}${
                                              orderedStageLogs[processStageIndex + 1]
                                                ?.lot_slot &&
                                              (orderedStageLogs[processStageIndex + 1]
                                                ?.lot_slot ?? 1) > 1
                                                ? ` · Lot ${orderedStageLogs[processStageIndex + 1]?.lot_slot}`
                                                : ''
                                            }`
                                          : 'stage'}
                                        <ChevronRight size={16} />
                                      </button>
                                    ) : (
                                      <p className="text-xs text-muted">
                                        Last stage — use Next below when ready for finished
                                        product.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}

              {step === 4 && (
                <div>
                  {outputRows.length === 0 ? (
                    <p className="text-sm text-muted">No finished outputs on this template.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
                    {orderedOutputRows.map((row) => {
                      const field = outputById.get(row.output_field_id)
                      const computed =
                        Boolean(field?.is_computed) || (field?.sum_of?.length ?? 0) > 0
                      return (
                        <label
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                        >
                          <span>
                            <span className="font-medium text-primary">{field?.name || 'Output'}</span>
                            {computed && field?.sum_of && field.sum_of.length > 0 && (
                              <span className="mt-0.5 block text-[11px] text-muted">
                                = {field.sum_of.join(' + ')}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.001"
                              disabled={readOnly || computed}
                              className="w-40 rounded-lg border border-border bg-panel px-3 py-2 disabled:opacity-60"
                              value={row.qty || ''}
                              onChange={(e) =>
                                updateOutput(
                                  row.id,
                                  e.target.value === '' ? 0 : Number(e.target.value),
                                )
                              }
                            />
                            <span className="text-sm text-muted">Kg</span>
                          </span>
                        </label>
                      )
                    })}
                    </div>
                  )}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
                    <div className="px-4 py-4">
                      <button
                        type="button"
                        className="mb-3 text-xs font-mono uppercase tracking-wider text-chemist hover:underline"
                        onClick={() => setStep(1)}
                      >
                        Header
                      </button>
                      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted">Batch</dt>
                          <dd className="font-medium text-primary">{batchNo}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Product</dt>
                          <dd className="text-primary">
                            {productCode || '—'}
                            {productName ? ` · ${productName}` : ''}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Vessel</dt>
                          <dd className="text-primary">{vessel || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">Mfg</dt>
                          <dd className="text-primary">{mfgDate || '—'}</dd>
                        </div>
                        {chemistName ? (
                          <div className="sm:col-span-2">
                            <dt className="text-muted">Chemist</dt>
                            <dd className="text-primary">{chemistName}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>

                    <div className="px-4 py-4">
                      <button
                        type="button"
                        className="mb-3 text-xs font-mono uppercase tracking-wider text-chemist hover:underline"
                        onClick={() => setStep(2)}
                      >
                        Raw materials
                      </button>
                      <ul className="space-y-2 text-sm">
                        {rmLines
                          .filter((l) => Number(l.qty) > 0)
                          .map((line) => {
                            const def = rmDefById.get(line.rm_def_id)
                            return (
                              <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-primary">
                                  {def?.material_name}
                                  {line.lot_slot != null ? ` · Lot ${line.lot_slot}` : ''}
                                </span>
                                <span className="tabular-nums text-muted">
                                  {Number(line.qty).toFixed(3)} {def?.unit || 'Kg'}
                                  {line.lot_invoice ? ` · ${line.lot_invoice}` : ''}
                                </span>
                              </li>
                            )
                          })}
                        {rmLines.every((l) => !(Number(l.qty) > 0)) && (
                          <li className="text-muted">No RM qty entered</li>
                        )}
                      </ul>
                    </div>

                    <div className="px-4 py-4">
                      <button
                        type="button"
                        className="mb-3 text-xs font-mono uppercase tracking-wider text-chemist hover:underline"
                        onClick={() => setStep(3)}
                      >
                        Process
                      </button>
                      <ul className="space-y-2 text-sm">
                        {orderedStageLogs.map((log) => {
                          const stage = stageById.get(log.stage_id)
                          const washSteps = washStepsForLog(log)
                          const integrityOnly = isIntegrityOnlyStage(stage)
                          return (
                            <li key={log.id} className="space-y-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium text-primary">{stage?.name}</span>
                                {integrityOnly ? (
                                  <span className="text-muted">
                                    {log.integrity_ok === true
                                      ? 'Ok'
                                      : log.integrity_ok === false
                                        ? 'Not Ok'
                                        : '—'}
                                  </span>
                                ) : washSteps.length === 0 ? (
                                  <span className="text-muted">
                                    {log.start_date || '—'} {log.start_time || ''}
                                    {' → '}
                                    {log.end_date || '—'} {log.end_time || ''}
                                    {log.start_temp != null || log.end_temp != null
                                      ? ` · ${log.start_temp ?? '—'}→${log.end_temp ?? '—'}°`
                                      : ''}
                                  </span>
                                ) : null}
                              </div>
                              {washSteps.length > 0 && (
                                <ul className="space-y-1 pl-3 text-muted">
                                  {washSteps.map((step) => (
                                    <li
                                      key={step.material_name}
                                      className="flex flex-wrap items-baseline justify-between gap-2"
                                    >
                                      <span>{step.material_name}</span>
                                      <span>
                                        {step.start_date || '—'} {step.start_time || ''}
                                        {' → '}
                                        {step.end_date || '—'} {step.end_time || ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )
                        })}
                        {orderedStageLogs.length === 0 && (
                          <li className="text-muted">No stages</li>
                        )}
                      </ul>
                    </div>

                    <div className="px-4 py-4">
                      <button
                        type="button"
                        className="mb-3 text-xs font-mono uppercase tracking-wider text-chemist hover:underline"
                        onClick={() => setStep(4)}
                      >
                        {batchKind === 'fg' ? 'Finished product' : 'Semi-finished product'}
                      </button>
                      <ul className="space-y-2 text-sm">
                        {orderedOutputRows.map((row) => {
                          const field = outputById.get(row.output_field_id)
                          return (
                            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-primary">{field?.name}</span>
                              <span className="tabular-nums text-muted">
                                {Number(row.qty).toFixed(3)} Kg
                              </span>
                            </li>
                          )
                        })}
                        {outputRows.length === 0 && (
                          <li className="text-muted">No outputs</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {readOnly && (
                    <p className="text-sm text-muted">
                      {status === 'completed'
                        ? 'This batch is completed. RM usage has been posted to the stock ledger.'
                        : 'View only — chemist is still recording this batch.'}
                    </p>
                  )}

                  {status === 'completed' && (
                    <div className="rounded-xl border border-border bg-panel p-4">
                      <h3 className="mb-2 text-xs font-mono uppercase tracking-wider text-muted">
                        {batchKind === 'fg' ? 'Finished goods QC' : 'Semi-finished goods QC'}
                      </h3>
                      {qcStatus === 'pending_qc' || qcStatus === 'awaiting_admin' ? (
                        <p className="text-sm text-chemist">
                          Sent to lab for {batchKind === 'fg' ? 'FG' : 'SFG'} QC
                          {qcSentAt
                            ? ` · ${new Date(qcSentAt).toLocaleString()}`
                            : ''}
                          . Waiting on lab entry.
                        </p>
                      ) : qcStatus === 'needs_info' ? (
                        <p className="text-sm text-amber-700">
                          Lab requested more information on this batch.
                        </p>
                      ) : qcStatus === 'approved' || qcStatus === 'approved_printed' ? (
                        <p className="text-sm text-emerald-700">
                          {batchKind === 'fg' ? 'FG' : 'SFG'} QC {qcStatus === 'approved_printed' ? 'approved and printed' : 'approved'}.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          {qcStatus === 'rejected' && (
                            <p className="text-sm text-red-700">
                              {batchKind === 'fg'
                                ? 'FG QC rejected. This lot is in warehouse for discounted sale and cannot be reworked.'
                                : 'SFG QC rejected. Full batch quantity is in warehouse as rejected stock. Ask warehouse to release the quantity you need.'}
                            </p>
                          )}
                          {canSendForQc && (
                            <>
                              {qcStatus !== 'rejected' && (
                                <p className="text-sm text-muted">
                                  Send batch no, product, and finished quantities to lab
                                  for quality check.
                                </p>
                              )}
                              <button
                                type="button"
                                disabled={sendingQc}
                                onClick={() => void sendForQc()}
                                className={`ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 ${
                                  isOwnerView ? 'bg-owner' : 'bg-chemist'
                                }`}
                              >
                                <FlaskConical size={16} />
                                {sendingQc
                                  ? 'Sending…'
                                  : 'Send for QC'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer nav */}
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-4 md:px-6">
                {step < 5 && stepBlockReason ? (
                  <p className="w-full text-xs text-amber-700">{stepBlockReason}</p>
                ) : null}
                <button
                  type="button"
                  disabled={busy || step === 1}
                  onClick={() => void goBack()}
                  className="btn btn-ghost disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveDraft()}
                  className="btn btn-ghost disabled:opacity-60"
                >
                  {saving && !completing ? 'Saving…' : 'Save draft'}
                </button>
                <div className="ml-auto flex flex-wrap gap-3">
                  {step < 5 ? (
                    <button
                      type="button"
                      disabled={busy || Boolean(stepBlockReason)}
                      title={stepBlockReason || undefined}
                      onClick={() => void goNext()}
                      className="btn btn-chemist disabled:opacity-60"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void complete()}
                      className="btn btn-chemist disabled:opacity-60"
                    >
                      {completing ? 'Completing…' : 'Mark completed'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {readOnly && (
              <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-4 md:px-6">
                <button
                  type="button"
                  disabled={step === 1}
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))}
                  className="btn btn-ghost disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                {step < 5 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s < 5 ? ((s + 1) as WizardStep) : s))}
                    className={`btn ml-auto ${isOwnerView ? 'btn-owner' : 'btn-chemist'}`}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <Link href={listHref} className="btn btn-ghost ml-auto">
                    ← Back to list
                  </Link>
                )}
              </div>
            )}
            </div>

            {requestOpen && !isOwnerView ? (
              <MgmtDrawer
                title="Request material"
                eyebrow="Chemist · ask warehouse to release RM or SFG"
                onClose={() => {
                  if (requestBusy) return
                  setRequestOpen(false)
                }}
                footer={
                  <ChemistRequestMaterialFooter
                    onClose={() => {
                      if (requestBusy) return
                      setRequestOpen(false)
                    }}
                    submitting={requestBusy}
                  />
                }
              >
                <ChemistRequestMaterialForm
                  key={String(requestOpen)}
                  onBusy={setRequestBusy}
                  onCreated={() => {
                    toast.success('Request submitted — warehouse will release material against this request.')
                    setRequestBusy(false)
                    setRequestOpen(false)
                    void reloadReleasedLots()
                  }}
                />
              </MgmtDrawer>
            ) : null}

            <button
              type="button"
              className="mt-4 hidden"
              onClick={() => router.refresh()}
              aria-hidden
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default function ChemistProductionBatchPage() {
  return <ProductionBatchDetail mode="chemist" />
}
