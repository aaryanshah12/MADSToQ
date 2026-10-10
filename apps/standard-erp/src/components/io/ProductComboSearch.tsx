'use client'
import { useState, useEffect, useRef, useMemo, useId, useLayoutEffect } from 'react'
import { bindComboMenuPositionListeners, comboMenuStyle, computeComboMenuPosition } from '@/components/io/combo-menu-position'
import { createPortal } from 'react-dom'
import type { IOProduct } from '@madstoq/io-system/types'
import { ChevronDown } from 'lucide-react'

interface Props {
  products: IOProduct[]
  value: string
  onChange: (productId: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}

export default function ProductComboSearch({ products, value, onChange, placeholder = '— Product —', className = '', inputClassName = '' }: Props) {
  const [query, setQuery] = useState(() => products.find(p => p.id === value)?.product_name ?? '')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listboxId = useId()

  // Sync display when value changes externally (e.g. row reset or edit open)
  useEffect(() => {
    if (!focused) {
      const p = products.find(p => p.id === value)
      setQuery(p?.product_name ?? '')
    }
  }, [value, products, focused])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.slice(0, 40)
    return products
      .map(product => {
        const name = product.product_name.toLowerCase()
        const matchIndex = name.indexOf(q)
        return { product, matchIndex, startsWith: name.startsWith(q) }
      })
      .filter(entry => entry.matchIndex !== -1)
      .sort((a, b) => {
        if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1
        if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex
        return a.product.product_name.localeCompare(b.product.product_name)
      })
      .slice(0, 40)
      .map(entry => entry.product)
  }, [products, query])

  function select(p: IOProduct) {
    setQuery(p.product_name)
    onChange(p.id)
    setActiveIndex(0)
    setOpen(false)
  }

  function handleFocus() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setFocused(true)
    setActiveIndex(0)
    setOpen(true)
  }

  function handleBlur() {
    closeTimer.current = setTimeout(() => {
      setFocused(false)
      setOpen(false)
      // If typed text doesn't match a product, clear selection
      const matched = products.find(p => p.product_name.toLowerCase() === query.trim().toLowerCase())
      if (matched) {
        onChange(matched.id)
        setQuery(matched.product_name)
      } else if (!products.find(p => p.id === value)) {
        setQuery('')
        onChange('')
      } else {
        // Revert to current selected product name
        const current = products.find(p => p.id === value)
        setQuery(current?.product_name ?? '')
      }
    }, 150)
  }

  useEffect(() => {
    if (!open) return
    setActiveIndex(current => Math.min(current, Math.max(filtered.length - 1, 0)))
  }, [filtered.length, open])

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }

    const updateMenuPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition(computeComboMenuPosition(rect))
    }

    return bindComboMenuPositionListeners(updateMenuPosition)
  }, [open, filtered.length])

  const listbox = open && menuPosition ? (
    <div
      id={listboxId}
      role="listbox"
      className="fixed z-[100] rounded-lg border border-border shadow-lg overflow-y-auto"
      style={{
        background: 'var(--color-panel)',
        ...comboMenuStyle(menuPosition),
      }}
    >
      {filtered.length > 0 ? (
        filtered.map((p, index) => (
          <button
            key={p.id}
            id={`${listboxId}-option-${p.id}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={() => select(p)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors sm:py-1.5 sm:text-xs ${index === activeIndex ? 'bg-layer text-primary' : 'text-primary hover:bg-layer'}`}
          >
            {p.product_name}
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-muted sm:text-xs">No products found</div>
      )}
    </div>
  ) : null

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setActiveIndex(0)
          setOpen(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActiveIndex(current => Math.min(current + 1, Math.max(filtered.length - 1, 0)))
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
            setActiveIndex(current => Math.max(current - 1, 0))
            return
          }
          if (e.key === 'Enter' && open && filtered[activeIndex]) {
            e.preventDefault()
            select(filtered[activeIndex])
            return
          }
          if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        className={`input w-full py-2 pr-10 text-sm sm:py-1.5 ${inputClassName}`}
        autoComplete="off"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-option-${filtered[activeIndex].id}` : undefined}
      />
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`}/>
      </div>
      {mounted && listbox ? createPortal(listbox, document.body) : null}
    </div>
  )
}
