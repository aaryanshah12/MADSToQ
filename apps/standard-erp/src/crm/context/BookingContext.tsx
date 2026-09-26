import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BookingFormInput, BookingRecord } from '../types/sales'
import {
  bookingPlotIds,
  bookingStatusToPlotStatus,
  normalizeBookingRecord,
} from '../types/sales'
import { generateBookingCode, loadBookings, saveBookings } from '../lib/sales'
import { uid } from '../lib/schemes'
import { usePlots } from './PlotContext'

interface BookingContextValue {
  bookings: BookingRecord[]
  getBooking: (id: string) => BookingRecord | undefined
  /** Active (non-cancelled) booking that currently holds this plot, if any */
  getActiveBookingForPlot: (
    plotId: string,
    exceptBookingId?: string,
  ) => BookingRecord | undefined
  saveBooking: (input: BookingFormInput, id?: string) => BookingRecord
  updateBooking: (id: string, patch: Partial<BookingRecord>) => void
  deleteBooking: (id: string) => void
}

const BookingContext = createContext<BookingContextValue | null>(null)

function sameIdSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<BookingRecord[]>([])

  useEffect(() => {
    setBookings(loadBookings())
  }, [])
  const { updatePlot } = usePlots()

  const persist = useCallback((next: BookingRecord[]) => {
    setBookings(next)
    saveBookings(next)
  }, [])

  const syncPlot = useCallback(
    (plotId: string, status: BookingRecord['status']) => {
      const plotStatus = bookingStatusToPlotStatus(status)
      if (plotStatus) updatePlot(plotId, { status: plotStatus })
    },
    [updatePlot],
  )

  const syncPlots = useCallback(
    (plotIds: string[], status: BookingRecord['status']) => {
      for (const plotId of plotIds) syncPlot(plotId, status)
    },
    [syncPlot],
  )

  const freePlots = useCallback(
    (plotIds: string[]) => {
      for (const plotId of plotIds) {
        updatePlot(plotId, { status: 'available' })
      }
    },
    [updatePlot],
  )

  const getBooking = useCallback(
    (id: string) => bookings.find((b) => b.id === id),
    [bookings],
  )

  const getActiveBookingForPlot = useCallback(
    (plotId: string, exceptBookingId?: string) =>
      bookings.find(
        (b) =>
          b.id !== exceptBookingId &&
          b.status !== 'cancelled' &&
          bookingPlotIds(b).includes(plotId),
      ),
    [bookings],
  )

  const assertPlotsFree = useCallback(
    (plotIds: string[], exceptBookingId?: string) => {
      for (const plotId of plotIds) {
        const holder = getActiveBookingForPlot(plotId, exceptBookingId)
        if (holder) {
          throw new Error(
            `Plot is already on booking ${holder.bookingCode} (${holder.customerName}). Cancel or edit that booking first, or pick another plot.`,
          )
        }
      }
    },
    [getActiveBookingForPlot],
  )

  const saveBooking = useCallback(
    (input: BookingFormInput, id?: string): BookingRecord => {
      const now = new Date().toISOString()
      const existing = id ? bookings.find((b) => b.id === id) : undefined
      const normalized = normalizeBookingRecord({
        ...input,
        id: existing?.id ?? uid(),
        bookingCode: existing?.bookingCode ?? generateBookingCode(bookings),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      const record = normalized as BookingRecord
      const nextIds = bookingPlotIds(record)
      if (nextIds.length === 0) throw new Error('Select at least one plot')

      assertPlotsFree(nextIds, existing?.id)

      const prevIds = existing ? bookingPlotIds(existing) : []
      if (
        existing &&
        existing.status !== 'cancelled' &&
        !sameIdSet(prevIds, nextIds)
      ) {
        const removed = prevIds.filter((pid) => !nextIds.includes(pid))
        freePlots(removed)
      }

      persist(
        existing
          ? bookings.map((b) => (b.id === existing.id ? record : b))
          : [record, ...bookings],
      )
      if (record.status !== 'cancelled') {
        syncPlots(nextIds, record.status)
      } else {
        freePlots(nextIds)
      }
      return record
    },
    [assertPlotsFree, bookings, freePlots, persist, syncPlots],
  )

  const updateBooking = useCallback(
    (id: string, patch: Partial<BookingRecord>) => {
      const existing = bookings.find((b) => b.id === id)
      if (!existing) return
      const next = normalizeBookingRecord({
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      }) as BookingRecord
      const prevIds = bookingPlotIds(existing)
      const nextIds = bookingPlotIds(next)

      if (!sameIdSet(prevIds, nextIds)) {
        assertPlotsFree(nextIds, id)
        const removed = prevIds.filter((pid) => !nextIds.includes(pid))
        if (existing.status !== 'cancelled') freePlots(removed)
      }

      persist(bookings.map((b) => (b.id === id ? next : b)))
      if (next.status === 'cancelled') freePlots(nextIds)
      else syncPlots(nextIds, next.status)
    },
    [assertPlotsFree, bookings, freePlots, persist, syncPlots],
  )

  const deleteBooking = useCallback(
    (id: string) => {
      const existing = bookings.find((b) => b.id === id)
      if (existing && existing.status !== 'cancelled') {
        freePlots(bookingPlotIds(existing))
      }
      persist(bookings.filter((b) => b.id !== id))
    },
    [bookings, freePlots, persist],
  )

  const value = useMemo(
    () => ({
      bookings,
      getBooking,
      getActiveBookingForPlot,
      saveBooking,
      updateBooking,
      deleteBooking,
    }),
    [
      bookings,
      getBooking,
      getActiveBookingForPlot,
      saveBooking,
      updateBooking,
      deleteBooking,
    ],
  )

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  )
}

export function useBookings() {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBookings must be used within BookingProvider')
  return ctx
}
