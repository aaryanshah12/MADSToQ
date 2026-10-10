'use client'

import {
  bindComboMenuPositionListeners,
  comboMenuStyle,
  computeComboMenuPosition,
} from '@/components/io/combo-menu-position'
import { ChevronDown, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  min: string
  max: string
  sliderMax: number
  onMinChange: (value: string) => void
  onMaxChange: (value: string) => void
  onClear: () => void
}

export function RateRangeChip({ min, max, sliderMax, onMinChange, onMaxChange, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<ReturnType<typeof computeComboMenuPosition> | null>(null)
  const chipRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const minVal = min ? Number(min) : 0
  const maxVal = max ? Number(max) : sliderMax
  const active = Boolean(min || max)
  const label = active ? `Rate: ₹${min || '0'} – ₹${max || '∞'}` : 'Rate / Kg'

  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }
    return bindComboMenuPositionListeners(() => {
      const el = chipRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const fake = new DOMRect(rect.left, rect.top, 320, rect.height)
      setMenuPosition(computeComboMenuPosition(fake, { preferredHeight: 220, gap: 8, minHeight: 160 }))
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
            role="dialog"
            aria-label="Filter by rate per kg"
            className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-border bg-panel p-4 shadow-xl"
            style={comboMenuStyle(menuPosition)}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Rate / Kg (₹)
              </span>
              {active ? (
                <button type="button" onClick={onClear} className="text-[11px] text-owner hover:underline">
                  Clear
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">Min</span>
                <input
                  type="number"
                  min={0}
                  max={sliderMax}
                  value={min}
                  placeholder="0"
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      onMinChange('')
                      return
                    }
                    const n = Number(v)
                    if (Number.isNaN(n) || n < 0) return
                    onMinChange(String(n))
                  }}
                  className="input-field owner-focus h-9 font-mono text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted">Max</span>
                <input
                  type="number"
                  min={0}
                  max={sliderMax}
                  value={max}
                  placeholder="Any"
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      onMaxChange('')
                      return
                    }
                    const n = Number(v)
                    if (Number.isNaN(n) || n < 0) return
                    onMaxChange(String(n))
                  }}
                  className="input-field owner-focus h-9 font-mono text-sm"
                />
              </label>
            </div>
            <div className="relative mt-4 flex h-5 items-center">
              <div className="absolute h-[3px] w-full rounded-full bg-border" />
              <div
                className="pointer-events-none absolute h-[3px] rounded-full bg-owner"
                style={{
                  left: `${(minVal / sliderMax) * 100}%`,
                  right: `${100 - (maxVal / sliderMax) * 100}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={sliderMax}
                step={100}
                value={minVal}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v <= maxVal) onMinChange(v === 0 ? '' : String(v))
                }}
                className="pointer-events-none absolute h-full w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-owner [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                style={{ zIndex: minVal >= sliderMax ? 5 : 3 }}
              />
              <input
                type="range"
                min={0}
                max={sliderMax}
                step={100}
                value={maxVal}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v >= minVal) onMaxChange(v >= sliderMax ? '' : String(v))
                }}
                className="pointer-events-none absolute h-full w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-owner [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
                style={{ zIndex: 4 }}
              />
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex h-8 max-w-[18rem] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium shadow-sm transition-colors ${
          active
            ? 'border-owner bg-owner/15 text-owner'
            : 'border-border bg-panel text-muted hover:border-owner/40 hover:text-owner'
        } ${open && !active ? 'border-border bg-layer-sm text-primary' : ''}`}
      >
        <span className="truncate">{label}</span>
        {active ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onClear()
              }
            }}
            className="rounded-full p-0.5 opacity-70 transition-opacity hover:bg-panel/80 hover:opacity-100"
            aria-label="Clear rate filter"
          >
            <X size={12} strokeWidth={2.5} />
          </span>
        ) : null}
        <ChevronDown size={13} className={`shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </>
  )
}
