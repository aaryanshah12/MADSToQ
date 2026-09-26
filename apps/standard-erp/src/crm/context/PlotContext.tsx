import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PlotFormInput, PlotRecord } from '../lib/pricing'
import { buildScottPlots, loadPlots, savePlots } from '../lib/plots'
import { uid } from '../lib/schemes'

interface PlotContextValue {
  plots: PlotRecord[]
  getPlotsByScheme: (schemeId: string) => PlotRecord[]
  upsertPlot: (input: PlotFormInput, id?: string) => PlotRecord
  updatePlot: (id: string, patch: Partial<PlotRecord>) => void
  deletePlot: (id: string) => void
  deletePlotsByScheme: (schemeId: string) => void
  importScottAvailability: (schemeId: string) => number
}

const PlotContext = createContext<PlotContextValue | null>(null)

export function PlotProvider({ children }: { children: ReactNode }) {
  const [plots, setPlots] = useState<PlotRecord[]>([])

  useEffect(() => {
    setPlots(loadPlots())
  }, [])

  const persist = useCallback((next: PlotRecord[]) => {
    setPlots(next)
    savePlots(next)
  }, [])

  const getPlotsByScheme = useCallback(
    (schemeId: string) => plots.filter((p) => p.schemeId === schemeId),
    [plots],
  )

  const upsertPlot = useCallback(
    (input: PlotFormInput, id?: string): PlotRecord => {
      const now = new Date().toISOString()
      const existing = id ? plots.find((p) => p.id === id) : undefined
      const record: PlotRecord = {
        ...input,
        id: existing?.id ?? uid(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      const next = existing
        ? plots.map((p) => (p.id === existing.id ? record : p))
        : [record, ...plots]
      persist(next)
      return record
    },
    [persist, plots],
  )

  const updatePlot = useCallback(
    (id: string, patch: Partial<PlotRecord>) => {
      persist(
        plots.map((p) =>
          p.id === id
            ? { ...p, ...patch, updatedAt: new Date().toISOString() }
            : p,
        ),
      )
    },
    [persist, plots],
  )

  const deletePlot = useCallback(
    (id: string) => persist(plots.filter((p) => p.id !== id)),
    [persist, plots],
  )

  const deletePlotsByScheme = useCallback(
    (schemeId: string) =>
      persist(plots.filter((p) => p.schemeId !== schemeId)),
    [persist, plots],
  )

  const importScottAvailability = useCallback(
    (schemeId: string) => {
      const imported = buildScottPlots(schemeId)
      const withoutScheme = plots.filter((p) => p.schemeId !== schemeId)
      persist([...imported, ...withoutScheme])
      return imported.length
    },
    [persist, plots],
  )

  const value = useMemo(
    () => ({
      plots,
      getPlotsByScheme,
      upsertPlot,
      updatePlot,
      deletePlot,
      deletePlotsByScheme,
      importScottAvailability,
    }),
    [
      plots,
      getPlotsByScheme,
      upsertPlot,
      updatePlot,
      deletePlot,
      deletePlotsByScheme,
      importScottAvailability,
    ],
  )

  return <PlotContext.Provider value={value}>{children}</PlotContext.Provider>
}

export function usePlots() {
  const ctx = useContext(PlotContext)
  if (!ctx) throw new Error('usePlots must be used within PlotProvider')
  return ctx
}
