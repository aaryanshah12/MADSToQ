import { useMemo, useState } from 'react'
import { Link, useSearchParams } from '@/crm/router'
import { Map, Plus, Trash2, Upload } from 'lucide-react'
import { useSchemes } from '../context/SchemeContext'
import { usePlots } from '../context/PlotContext'
import { useAuth } from '../context/AuthContext'
import { useBookings } from '../context/BookingContext'
import { calculatePlotPrice, type PlotStatus } from '../lib/pricing'
import { formatCurrency, formatNumber } from '../lib/schemes'
import { ROAD_WIDTH_TIERS, type RoadWidthMeters } from '../types/scheme'
import { PlotDetailDialog } from '../components/plots/PlotDetailDialog'
import { Button, Card, Field, Input, Select } from '../components/ui/Form'

const STATUS_OPTIONS: PlotStatus[] = [
  'available',
  'reserved',
  'booked',
  'sold',
]

export function PlotsPage() {
  const { schemes } = useSchemes()
  const { user } = useAuth()
  const canManageSchemes = user?.role === 'admin'
  const canManagePlots = user?.role !== 'sales'
  const canDeletePlots = user?.role === 'admin'
  const {
    getPlotsByScheme,
    upsertPlot,
    updatePlot,
    deletePlot,
    importScottAvailability,
  } = usePlots()
  const { getActiveBookingForPlot } = useBookings()
  const [params, setParams] = useSearchParams()
  const schemeId = params.get('scheme') ?? schemes[0]?.id ?? ''
  const scheme = schemes.find((s) => s.id === schemeId)
  const plots = useMemo(
    () =>
      getPlotsByScheme(schemeId).sort((a, b) =>
        a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true }),
      ),
    [getPlotsByScheme, schemeId],
  )

  const [showAdd, setShowAdd] = useState(false)
  const [plotNumber, setPlotNumber] = useState('')
  const [sbu, setSbu] = useState('')
  const [carpet, setCarpet] = useState('')
  const [blockName, setBlockName] = useState('Phase 1')
  const [facing, setFacing] = useState<RoadWidthMeters | ''>('')
  const [toast, setToast] = useState<string | null>(null)
  const [viewPlotId, setViewPlotId] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const onSchemeChange = (id: string) => {
    setParams(id ? { scheme: id } : {})
  }

  const handleImport = () => {
    if (!schemeId) return
    const n = importScottAvailability(schemeId)
    flash(`Imported ${n} Scott Phase 1 plots — set facing road widths`)
  }

  const handleAdd = () => {
    if (!schemeId || !plotNumber.trim() || !sbu.trim()) {
      flash('Plot number and SBU area are required')
      return
    }
    upsertPlot({
      schemeId,
      blockName: blockName.trim() || 'Phase 1',
      plotNumber: plotNumber.trim(),
      carpetAreaSqM: carpet,
      sbuAreaSqYards: sbu,
      facingRoadWidth: facing === '' ? null : facing,
      isGardenFacing: false,
      status: 'available',
    })
    setPlotNumber('')
    setSbu('')
    setCarpet('')
    setFacing('')
    setShowAdd(false)
    flash('Plot added')
  }

  if (schemes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <div className="py-8 text-center">
            <Map className="mx-auto h-10 w-10 text-brand" />
            <h1 className="mt-3 font-display text-2xl">No schemes yet</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {canManageSchemes
                ? 'Create a scheme first, then add plots with facing road widths.'
                : 'Ask an admin to create a scheme before managing plots.'}
            </p>
            {canManageSchemes && (
              <Link to="/schemes/new" className="mt-5 inline-block">
                <Button>Create Scheme</Button>
              </Link>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Inventory
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
            Blocks & Plots
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Assign facing road width (13 / 12 / 9 m) per plot. Price uses scheme
            road-width premiums automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={schemeId}
            onChange={(e) => onSchemeChange(e.target.value)}
            className="min-w-[220px]"
          >
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.schemeName || s.schemeCode}
              </option>
            ))}
          </Select>
          {canManagePlots && (
            <>
              <Button type="button" variant="outline" onClick={handleImport}>
                <Upload className="h-4 w-4" />
                Import Scott Availability
              </Button>
              <Button type="button" onClick={() => setShowAdd((v) => !v)}>
                <Plus className="h-4 w-4" />
                Add Plot
              </Button>
            </>
          )}
        </div>
      </div>

      {scheme && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="!shadow-none">
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              Base rate
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(scheme.baseRatePerSqYard)}
              <span className="text-xs font-normal text-ink-muted"> /sq.yd</span>
            </p>
          </Card>
          <Card className="!shadow-none">
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              13 m premium
            </p>
            <p className="mt-1 text-lg font-semibold">
              {scheme.roadWidthPremiums.road13m || '—'}
            </p>
          </Card>
          <Card className="!shadow-none">
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              12 m premium
            </p>
            <p className="mt-1 text-lg font-semibold">
              {scheme.roadWidthPremiums.road12m || '—'}
            </p>
          </Card>
          <Card className="!shadow-none">
            <p className="text-xs uppercase tracking-wide text-ink-faint">
              9 m premium
            </p>
            <p className="mt-1 text-lg font-semibold">
              {scheme.roadWidthPremiums.road9m || '—'}
            </p>
          </Card>
        </div>
      )}

      {canManagePlots && showAdd && (
        <Card title="Add plot" description="SBU area drives pricing (sq. yards).">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Block">
              <Input
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
              />
            </Field>
            <Field label="Plot No." required>
              <Input
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
              />
            </Field>
            <Field label="Carpet (sq.m)">
              <Input
                type="number"
                value={carpet}
                onChange={(e) => setCarpet(e.target.value)}
              />
            </Field>
            <Field label="SBU (sq.yd)" required>
              <Input
                type="number"
                value={sbu}
                onChange={(e) => setSbu(e.target.value)}
              />
            </Field>
            <Field label="Facing road">
              <Select
                value={facing === '' ? '' : String(facing)}
                onChange={(e) =>
                  setFacing(
                    e.target.value === ''
                      ? ''
                      : (Number(e.target.value) as RoadWidthMeters),
                  )
                }
              >
                <option value="">Not set</option>
                {ROAD_WIDTH_TIERS.map((w) => (
                  <option key={w} value={w}>
                    {w} m
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={handleAdd}>
              Save plot
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2/70 text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-3 font-semibold">Plot</th>
                <th className="px-3 py-3 font-semibold">Block</th>
                <th className="px-3 py-3 font-semibold">Carpet</th>
                <th className="px-3 py-3 font-semibold">SBU</th>
                <th className="px-3 py-3 font-semibold">Facing road</th>
                <th className="px-3 py-3 font-semibold">Garden</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Est. price</th>
                <th className="px-3 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {plots.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-ink-muted"
                  >
                    {canManagePlots
                      ? 'No plots yet. Import Scott availability or add plots manually.'
                      : 'No plots yet for this scheme.'}
                  </td>
                </tr>
              ) : (
                plots.map((plot) => {
                  const price =
                    scheme && calculatePlotPrice(scheme, plot)
                  return (
                    <tr
                      key={plot.id}
                      className="border-b border-line last:border-0 hover:bg-surface-2/40"
                    >
                      <td className="px-3 py-2.5 font-semibold">
                        {plot.plotNumber}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {plot.blockName}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatNumber(plot.carpetAreaSqM)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatNumber(plot.sbuAreaSqYards)}
                      </td>
                      <td className="px-3 py-2.5">
                        {canManagePlots ? (
                          <Select
                            value={
                              plot.facingRoadWidth == null
                                ? ''
                                : String(plot.facingRoadWidth)
                            }
                            onChange={(e) =>
                              updatePlot(plot.id, {
                                facingRoadWidth:
                                  e.target.value === ''
                                    ? null
                                    : (Number(
                                        e.target.value,
                                      ) as RoadWidthMeters),
                              })
                            }
                            className="min-w-[100px] py-1.5"
                          >
                            <option value="">—</option>
                            {ROAD_WIDTH_TIERS.map((w) => (
                              <option key={w} value={w}>
                                {w} m
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-ink-muted">
                            {plot.facingRoadWidth != null
                              ? `${plot.facingRoadWidth} m`
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {canManagePlots ? (
                          <input
                            type="checkbox"
                            checked={plot.isGardenFacing}
                            onChange={(e) =>
                              updatePlot(plot.id, {
                                isGardenFacing: e.target.checked,
                              })
                            }
                            className="h-4 w-4 accent-[var(--brand)]"
                          />
                        ) : (
                          <span className="text-ink-muted">
                            {plot.isGardenFacing ? 'Yes' : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {canManagePlots ? (
                          <Select
                            value={plot.status}
                            onChange={(e) =>
                              updatePlot(plot.id, {
                                status: e.target.value as PlotStatus,
                              })
                            }
                            className="min-w-[110px] py-1.5 capitalize"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="capitalize text-ink-muted">
                            {plot.status}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {price ? (
                          <div>
                            <div className="font-semibold tabular-nums">
                              {formatCurrency(price.total)}
                            </div>
                            {plot.facingRoadWidth && (
                              <div className="text-[11px] text-ink-faint">
                                Road +
                                {formatCurrency(price.roadPremiumAmount)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-faint">Set base rate</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setViewPlotId(plot.id)}
                          >
                            View
                          </Button>
                          {canDeletePlots && (
                            <button
                              type="button"
                              className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-danger"
                              onClick={() => deletePlot(plot.id)}
                              aria-label={`Delete plot ${plot.plotNumber}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {scheme && (
        <p className="text-xs text-ink-muted">
          {canManageSchemes ? (
            <>
              Edit road premiums in{' '}
              <Link
                to={`/schemes/${scheme.id}/edit`}
                className="font-medium text-brand hover:underline"
              >
                Scheme Pricing
              </Link>
              . Absolute premiums (without %) are treated as ₹ per sq. yard.
            </>
          ) : (
            <>
              Road premiums come from scheme pricing. Absolute premiums (without
              %) are treated as ₹ per sq. yard.
            </>
          )}
        </p>
      )}

      {scheme &&
        viewPlotId &&
        (() => {
          const plot = plots.find((p) => p.id === viewPlotId)
          if (!plot) return null
          return (
            <PlotDetailDialog
              open
              onClose={() => setViewPlotId(null)}
              plot={plot}
              scheme={scheme}
              booking={getActiveBookingForPlot(plot.id)}
            />
          )
        })()}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
