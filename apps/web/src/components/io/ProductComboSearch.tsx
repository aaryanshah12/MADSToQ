'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import type { IOProduct } from '@/lib/io/types'

interface Props {
  products: IOProduct[]
  value: string
  onChange: (productId: string) => void
  placeholder?: string
  className?: string
}

export default function ProductComboSearch({ products, value, onChange, placeholder = '— Product —', className = '' }: Props) {
  const [query, setQuery] = useState(() => products.find(p => p.id === value)?.product_name ?? '')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    return products.filter(p => p.product_name.toLowerCase().startsWith(q)).slice(0, 40)
  }, [products, query])

  function select(p: IOProduct) {
    setQuery(p.product_name)
    onChange(p.id)
    setOpen(false)
  }

  function handleFocus() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setFocused(true)
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

  return (
    <div className={`relative ${className}`}>
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="input w-full text-xs py-1.5"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-0.5 rounded-lg border border-border shadow-lg overflow-y-auto"
          style={{ background: 'var(--color-panel)', maxHeight: '180px' }}
        >
          {filtered.map(p => (
            <button
              key={p.id}
              onMouseDown={() => select(p)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-layer text-primary transition-colors"
            >
              {p.product_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
