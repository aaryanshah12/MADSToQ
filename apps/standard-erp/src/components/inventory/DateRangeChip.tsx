'use client'

import {
  bindComboMenuPositionListeners,
  comboMenuStyle,
  computeComboMenuPosition,
} from '@/components/io/combo-menu-position'
import { ChevronDown, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function toYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fyStartYear(now: Date) {
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

export function datePresetRange(id: 'month' | '30d' | 'fy', now = new Date()): { from: string; to: string } {
  const to = toYmd(now)
  if (id === 'month') return { from: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  if (id === '30d') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    start.setDate(start.getDate() - 29)
    return { from: toYmd(start), to }
  }
  return { from: toYmd(new Date(fyStartYear(now), 3, 1)), to }
}

export function inDateRange(iso: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  if (from) {
    const start = new Date(`${from}T00:00:00`)
    if (d < start) return false
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`)
    if (d > end) return false
  }
  return true
}

function formatWhen(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function matchingDatePreset(from: string, to: string, now = new Date()) {
  return (['month', '30d', 'fy'] as const).find((id) => {
    const r = datePresetRange(id, now)
    return r.from === from && r.to === to
  })
}

export function dateRangeLabel(from: string, to: string, now = new Date()) {
  if (!from && !to) return 'Date'
  const preset = matchingDatePreset(from, to, now)
  return preset === 'month'
    ? 'Date: This month'
    : preset === '30d'
      ? 'Date: Last 30 days'
      : preset === 'fy'
        ? 'Date: This FY'
        : `Date: ${from ? formatWhen(from) : '…'} – ${to ? formatWhen(to) : '…'}`
}

export function DateRangeChip({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<ReturnType<typeof computeComboMenuPosition> | null>(
    null,
  )
  const chipRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const now = useMemo(() => new Date(), [])
  const active = Boolean(from || to)
  const matchingPreset = matchingDatePreset(from, to, now)
  const chipLabel = dateRangeLabel(from, to, now)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }
    return bindComboMenuPositionListeners(() => {
      const el = chipRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const fake = new DOMRect(rect.left, rect.top, Math.max(rect.width, 280), rect.height)
      setMenuPosition(
        computeComboMenuPosition(fake, { preferredHeight: 360, gap: 8, minHeight: 180 }),
      )
    })
  }, [open])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (chipRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onDoc)
      document.addEventListener('keydown', onKey)
    }
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const menu =
    mounted && open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
            style={comboMenuStyle(menuPosition)}
          >
            <div className="flex shrink-0 items-center justify-between px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">Date</span>
              {active ? (
                <button
                  type="button"
                  onClick={() => onChange('', '')}
                  className="text-[11px] text-owner hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-1 border-t border-border p-1.5">
              {(
                [
                  { id: 'month', label: 'This month' },
                  { id: '30d', label: 'Last 30 days' },
                  { id: 'fy', label: 'This FY' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const r = datePresetRange(opt.id, now)
                    onChange(r.from, r.to)
                  }}
                  className={`rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    matchingPreset === opt.id
                      ? 'bg-owner/10 text-primary'
                      : 'text-muted hover:bg-layer-sm hover:text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted">
                  From
                </span>
                <input
                  type="date"
                  className="input-field owner-focus h-9 !px-2 text-xs"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => {
                    const nextFrom = e.target.value
                    onChange(nextFrom, to && nextFrom && to < nextFrom ? nextFrom : to)
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted">
                  To
                </span>
                <input
                  type="date"
                  className="input-field owner-focus h-9 !px-2 text-xs"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => {
                    const nextTo = e.target.value
                    onChange(from && nextTo && from > nextTo ? nextTo : from, nextTo)
                  }}
                />
              </label>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        ref={chipRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex h-8 max-w-[18rem] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium shadow-sm transition-colors ${
          active
            ? 'border-owner bg-owner/15 text-owner'
            : 'border-border bg-panel text-muted hover:border-owner/40 hover:text-owner'
        } ${open && !active ? 'border-border bg-layer-sm text-primary' : ''}`}
      >
        <span className="truncate">{chipLabel}</span>
        {active ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onChange('', '')
              setOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onChange('', '')
              }
            }}
            className="rounded-full p-0.5 opacity-70 transition-opacity hover:bg-panel/80 hover:opacity-100"
            aria-label="Clear date filter"
          >
            <X size={12} strokeWidth={2.5} />
          </span>
        ) : null}
        <ChevronDown
          size={13}
          className={`shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </>
  )
}
