'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { bindComboMenuPositionListeners, comboMenuStyle, computeComboMenuPosition } from '@/components/io/combo-menu-position'
import { ioInputClass } from '@/components/io/io-form-styles'

export type OutwardRefMatch = {
  id: string
  outward_number: string
  outward_date: string
  supplier?: { company_name?: string }
  supplier_ref_no?: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  onFocus: () => void
  onBlur: (value: string) => void
  onSelect: (outwardNumber: string) => void
  matches: OutwardRefMatch[]
  searching: boolean
  invalid?: boolean
  placeholder?: string
}

export default function OutwardRefSearchInput({
  value,
  onChange,
  onFocus,
  onBlur,
  onSelect,
  matches,
  searching,
  invalid,
  placeholder = 'Type outward ref…',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [focused, setFocused] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  const query = value.trim()
  const showMenu = focused && (searching || matches.length > 0 || query.length > 0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!showMenu) {
      setMenuPosition(null)
      return
    }

    const updateMenuPosition = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      setMenuPosition(computeComboMenuPosition(rect, { preferredHeight: 260 }))
    }

    return bindComboMenuPositionListeners(updateMenuPosition)
  }, [showMenu, matches.length, searching, query])

  const menu =
    showMenu && menuPosition ? (
      <div
        data-combo-menu="1"
        className="fixed z-[200] overflow-hidden rounded-xl border border-border shadow-lg"
        style={{
          background: 'var(--color-panel)',
          ...comboMenuStyle(menuPosition),
        }}
      >
        {searching ? (
          <div className="px-3 py-2 text-xs text-muted">
            {query.length > 0 ? 'Searching outwards…' : 'Loading recent outwards…'}
          </div>
        ) : matches.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted">
            {query.length > 0 ? 'No outward records found' : 'No recent outward records'}
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: menuPosition.maxHeight }}>
            {!query && (
              <div className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Recent outward entries
              </div>
            )}
            {matches.map(o => (
              <button
                key={o.id}
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  onSelect(o.outward_number)
                }}
                className="w-full border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-layer-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-xs font-semibold text-inputer">{o.outward_number}</div>
                  <div className="text-[11px] text-muted">{o.outward_date}</div>
                </div>
                <div className="mt-0.5 text-xs text-primary">{o.supplier?.company_name ?? '—'}</div>
                {o.supplier_ref_no && (
                  <div className="mt-0.5 text-[11px] text-muted">Ref: {o.supplier_ref_no}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    ) : null

  return (
    <div className="relative min-w-0">
      <input
        ref={inputRef}
        value={value}
        onFocus={() => {
          setFocused(true)
          onFocus()
        }}
        onChange={e => onChange(e.target.value)}
        onBlur={e => {
          window.setTimeout(() => {
            setFocused(false)
            onBlur(e.target.value)
          }, 150)
        }}
        placeholder={placeholder}
        className={ioInputClass(invalid)}
        autoComplete="off"
      />
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
