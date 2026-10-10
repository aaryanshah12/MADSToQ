'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Circle, CircleDot } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { productionApi } from '@/lib/api'
import { ProductionRecordExportButton } from '@/components/inventory/ProductionRecordExportButton'
import { SkeletonPanel, StatusBadge } from '@/components/ui'
import {
  alignCrudeWashSteps,
  crudeWashMaterials,
  isCrudeWashStage,
  washEndFilled,
  washStartFilled,
  type CrudeWashStep,
} from '@/lib/crude-wash'

type ProductRm = {
  id: string
  material_name: string
  unit: string
  allow_multi_lot: boolean
  sort_order: number
  stock_kind?: 'rm' | 'sfg'
  process?: 'sfg' | 'fg'
}

type ProductStage = {
  id: string
  name: string
  sort_order: number
  lot_rm_def_id: string | null
  capture_start_date: boolean
  capture_end_date: boolean
  capture_start_time: boolean
  capture_end_time: boolean
  capture_start_temp: boolean
  capture_end_temp: boolean
  capture_integrity?: boolean
  process?: 'sfg' | 'fg'
}

type ProductOutput = {
  id: string
  name: string
  sort_order: number
  is_computed: boolean
  sum_of?: string[]
}

type RmLine = {
  id: string
  rm_def_id: string
  qty: number
  lot_invoice: string | null
  lot_slot: number | null
  notes: string | null
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
  integrity_ok?: boolean | null
  wash_steps?: CrudeWashStep[] | null
}

type OutputRow = {
  id: string
  output_field_id: string
  qty: number
}

function formatDate(v: string | null): string {
  if (!v) return '—'
  const [y, m, d] = v.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  return v
}

function formatTime(v: string | null): string {
  if (!v) return '—'
  return v.length >= 5 ? v.slice(0, 5) : v
}

function formatTemp(v: number | null): string {
  return v == null ? '—' : `${v}`
}

function formatStamp(
  date: string | null,
  time: string | null,
  temp: number | null,
  captureTemp: boolean,
) {
  const d = formatDate(date)
  const t = formatTime(time)
  if (d === '—' && t === '—' && (!captureTemp || temp == null)) return '—'
  const parts = [d, t]
  if (captureTemp) parts.push(`${formatTemp(temp)}${temp != null ? '°' : ''}`)
  return parts.filter((p) => p !== '—').join(' · ') || '—'
}

function isStartComplete(
  log: StageLog,
  stage: ProductStage | undefined,
): boolean {
  if (stage?.capture_start_date !== false && !log.start_date) return false
  if (stage?.capture_start_time !== false && !log.start_time) return false
  if (stage?.capture_start_temp !== false && log.start_temp == null) return false
  return true
}

function isEndComplete(
  log: StageLog,
  stage: ProductStage | undefined,
): boolean {
  if (stage?.capture_end_date !== false && !log.end_date) return false
  if (stage?.capture_end_time !== false && !log.end_time) return false
  if (stage?.capture_end_temp !== false && log.end_temp == null) return false
  return true
}

type StageStatus = 'pending' | 'running' | 'done'

function stageStatus(
  log: StageLog,
  stage: ProductStage | undefined,
): StageStatus {
  const startOk = isStartComplete(log, stage)
  const endOk = isEndComplete(log, stage)
  if (startOk && endOk) return 'done'
  if (startOk) return 'running'
  return 'pending'
}

export function OwnerProductionBatchDetail({
  batchId,
  onClose,
}: {
  batchId: string
  onClose?: () => void
}) {
  const { loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [vessel, setVessel] = useState('')
  const [status, setStatus] = useState('')
  const [factoryId, setFactoryId] = useState('')
  const [productId, setProductId] = useState('')
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [createdBy, setCreatedBy] = useState<string | null>(null)
  const [rms, setRms] = useState<ProductRm[]>([])
  const [stages, setStages] = useState<ProductStage[]>([])
  const [outputs, setOutputs] = useState<ProductOutput[]>([])
  const [rmLines, setRmLines] = useState<RmLine[]>([])
  const [stageLogs, setStageLogs] = useState<StageLog[]>([])
  const [outputRows, setOutputRows] = useState<OutputRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const data = await productionApi.getBatch(batchId)
    if (data.error || !data.batch) {
      setError(data.error || 'Batch not found')
      setLoading(false)
      return
    }
    const b = data.batch
    setBatchNo(b.batch_no)
    setVessel(b.vessel || '')
    setStatus(b.status)
    setFactoryId(b.factory_id || '')
    setProductId(b.product_id || '')
    setProductCode(b.product_code || '')
    setProductName(b.product_name || '')
    setCreatedBy(b.created_by_name || null)
    setRmLines(b.rm_lines || [])
    setStageLogs(b.stage_logs || [])
    setOutputRows(b.outputs || [])

    const prod = await productionApi.getProduct(b.product_id)
    if (prod.product) {
      setRms(prod.product.rms || [])
      setStages(prod.product.stages || [])
      setOutputs(prod.product.outputs || [])
    }
    setLoading(false)
  }, [batchId])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  const rmDefById = useMemo(() => new Map(rms.map((r) => [r.id, r])), [rms])
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])
  const outputById = useMemo(
    () => new Map(outputs.map((o) => [o.id, o])),
    [outputs],
  )

  const orderedStageLogs = useMemo(() => {
    return [...stageLogs].sort((a, b) => {
      const ao = stageById.get(a.stage_id)?.sort_order ?? 0
      const bo = stageById.get(b.stage_id)?.sort_order ?? 0
      if (ao !== bo) return ao - bo
      return (a.lot_slot ?? 1) - (b.lot_slot ?? 1)
    })
  }, [stageLogs, stageById])

  const consumedRm = useMemo(
    () =>
      [...rmLines]
        .filter((l) => Number(l.qty) > 0)
        .sort((a, b) => {
          const ao = rmDefById.get(a.rm_def_id)?.sort_order ?? 0
          const bo = rmDefById.get(b.rm_def_id)?.sort_order ?? 0
          if (ao !== bo) return ao - bo
          return (a.lot_slot ?? 0) - (b.lot_slot ?? 0)
        }),
    [rmLines, rmDefById],
  )

  const progressLabel = useMemo(() => {
    if (status === 'completed') return 'Completed'
    if (!batchNo.trim() || !vessel.trim()) return 'Header'
    if (consumedRm.length === 0) return 'Raw materials'
    for (const log of orderedStageLogs) {
      const stage = stageById.get(log.stage_id)
      if (!isStartComplete(log, stage) || !isEndComplete(log, stage)) {
        const lotSlot = log.lot_slot ?? 1
        const showLot =
          Boolean(stage?.lot_rm_def_id) ||
          orderedStageLogs.filter((l) => l.stage_id === log.stage_id).length > 1
        return `${stage?.name || 'Stage'}${showLot ? ` · Lot ${lotSlot}` : ''}`
      }
    }
    const required = outputRows.filter((row) => {
      const field = outputById.get(row.output_field_id)
      return field && !field.is_computed
    })
    if (required.some((row) => !(Number(row.qty) > 0))) return 'Semi-finished product'
    return 'Review'
  }, [
    status,
    batchNo,
    vessel,
    consumedRm.length,
    orderedStageLogs,
    stageById,
    outputRows,
    outputById,
  ])

  const compactTable =
    'data-table min-w-full [&_th]:!px-3 [&_th]:!py-2 [&_td]:!px-3 [&_td]:!py-1.5'

  const body = loading ? (
    <SkeletonPanel className="m-4" rows={4} />
  ) : error ? (
    <p className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  ) : (
    <div>
            <section className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted">Status</span>
                <StatusBadge status={status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted">Process</span>
                <span className="text-sm font-medium text-primary">{progressLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted">Vessel</span>
                <span className="text-sm font-medium text-primary">{vessel || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted">Recorded by</span>
                <span className="text-sm font-medium text-primary">{createdBy || '—'}</span>
              </div>
            </section>

            <section className="border-b border-border">
              <h2 className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                Raw materials used
              </h2>
              {consumedRm.length === 0 ? (
                <p className="px-3 pb-3 text-sm text-muted">No consumption recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className={compactTable}>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Lot / GRN</th>
                        <th>Qty</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumedRm.map((line) => {
                        const def = rmDefById.get(line.rm_def_id)
                        return (
                          <tr key={line.id}>
                            <td>
                              {def?.material_name || 'Material'}
                              {line.lot_slot != null ? (
                                <span className="text-muted"> · Lot {line.lot_slot}</span>
                              ) : null}
                            </td>
                            <td>{line.lot_invoice || '—'}</td>
                            <td>
                              {Number(line.qty).toFixed(3)} {def?.unit || 'Kg'}
                            </td>
                            <td className="text-muted">{line.notes?.trim() || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="border-b border-border">
              <h2 className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                Process
              </h2>
              {orderedStageLogs.length === 0 ? (
                <p className="px-3 pb-3 text-sm text-muted">No process stages on this template.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className={compactTable}>
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Status</th>
                        <th>Start</th>
                        <th>End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedStageLogs.map((log, i) => {
                        const stage = stageById.get(log.stage_id)
                        const integrityOnly =
                          Boolean(stage?.capture_integrity) &&
                          stage?.capture_start_date === false &&
                          stage?.capture_end_date === false &&
                          stage?.capture_start_time === false &&
                          stage?.capture_end_time === false
                        const washMaterials = isCrudeWashStage(stage?.name)
                          ? crudeWashMaterials(rms, stage?.process)
                          : []
                        const washSteps = washMaterials.length
                          ? alignCrudeWashSteps(log.wash_steps, washMaterials)
                          : []
                        const st = integrityOnly
                          ? log.integrity_ok === true || log.integrity_ok === false
                            ? 'done'
                            : 'pending'
                          : washSteps.length
                            ? washSteps.every(washEndFilled)
                              ? 'done'
                              : washSteps.some(washStartFilled)
                                ? 'running'
                                : 'pending'
                            : stageStatus(log, stage)
                        const lotSlot = log.lot_slot ?? 1
                        const showLot =
                          Boolean(stage?.lot_rm_def_id) ||
                          orderedStageLogs.filter((l) => l.stage_id === log.stage_id).length > 1
                        return (
                          <Fragment key={log.id}>
                          <tr>
                            <td>
                              <span className="inline-flex items-center gap-1.5">
                                {st === 'done' ? (
                                  <Check size={14} className="shrink-0 text-owner" />
                                ) : st === 'running' ? (
                                  <CircleDot size={14} className="shrink-0 text-owner" />
                                ) : (
                                  <Circle size={14} className="shrink-0 text-muted" />
                                )}
                                {i + 1}. {stage?.name || 'Stage'}
                                {showLot ? ` · Lot ${lotSlot}` : ''}
                              </span>
                            </td>
                            <td className="capitalize text-muted">
                              {st === 'done' ? 'Complete' : st === 'running' ? 'In progress' : 'Not started'}
                            </td>
                            <td>
                              {washSteps.length > 0 || integrityOnly
                                ? '—'
                                : st === 'pending'
                                  ? '—'
                                  : formatStamp(
                                      log.start_date,
                                      log.start_time,
                                      log.start_temp,
                                      stage?.capture_start_temp !== false,
                                    )}
                            </td>
                            <td>
                              {integrityOnly
                                ? log.integrity_ok === true
                                  ? 'Ok'
                                  : log.integrity_ok === false
                                    ? 'Not Ok'
                                    : '—'
                                : washSteps.length > 0
                                  ? '—'
                                  : st === 'done'
                                    ? formatStamp(
                                        log.end_date,
                                        log.end_time,
                                        log.end_temp,
                                        stage?.capture_end_temp !== false,
                                      )
                                    : st === 'running'
                                      ? 'Still running'
                                      : '—'}
                            </td>
                          </tr>
                          {washSteps.map((step) => {
                            const washStatus = washEndFilled(step)
                              ? 'done'
                              : washStartFilled(step)
                                ? 'running'
                                : 'pending'
                            return (
                              <tr key={`${log.id}-${step.material_name}`}>
                                <td className="pl-8 text-muted">{step.material_name}</td>
                                <td className="capitalize text-muted">
                                  {washStatus === 'done'
                                    ? 'Complete'
                                    : washStatus === 'running'
                                      ? 'In progress'
                                      : 'Not started'}
                                </td>
                                <td>
                                  {washStatus === 'pending'
                                    ? '—'
                                    : formatStamp(step.start_date, step.start_time, null, false)}
                                </td>
                                <td>
                                  {washStatus === 'done'
                                    ? formatStamp(step.end_date, step.end_time, null, false)
                                    : washStatus === 'running'
                                      ? 'Still running'
                                      : '—'}
                                </td>
                              </tr>
                            )
                          })}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                Semi-finished product
              </h2>
              {outputRows.length === 0 ? (
                <p className="px-3 pb-3 text-sm text-muted">No finished outputs on this template.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className={compactTable}>
                    <thead>
                      <tr>
                        <th>Output</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputRows.map((row) => {
                        const field = outputById.get(row.output_field_id)
                        return (
                          <tr key={row.id}>
                            <td>
                              {field?.name || 'Output'}
                              {(field?.is_computed || (field?.sum_of?.length ?? 0) > 0) &&
                              field?.sum_of?.length ? (
                                <span className="text-muted"> · = {field.sum_of.join(' + ')}</span>
                              ) : field?.is_computed ? (
                                <span className="text-muted"> · computed</span>
                              ) : null}
                            </td>
                            <td className="font-medium">
                              {Number(row.qty) > 0 ? `${Number(row.qty).toFixed(3)} Kg` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
  )

  return onClose ? (
    <>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <p className="text-xs uppercase tracking-wider text-muted">Production batch</p>
        <h2 className="mt-0.5 text-base font-bold text-primary">{batchNo || 'Batch'}</h2>
        {(productCode || productName) && (
          <p className="mt-1 text-sm text-muted">
            {productCode}
            {productName ? ` · ${productName}` : ''}
          </p>
        )}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">{body}</div>
      <div className="flex justify-end gap-2 border-t border-border px-4 py-4 sm:px-6">
        <button type="button" onClick={onClose} className="btn btn-ghost">
          Close
        </button>
        <ProductionRecordExportButton
          factoryId={factoryId}
          productId={productId}
          disabled={loading || !productId}
        />
      </div>
    </>
  ) : (
    body
  )
}
