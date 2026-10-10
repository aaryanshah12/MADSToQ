'use client'
import { useState, useEffect, useRef, useMemo, useId, useLayoutEffect } from 'react'
import { bindComboMenuPositionListeners, comboMenuStyle, computeComboMenuPosition } from '@/components/io/combo-menu-position'
import { createPortal } from 'react-dom'
import type { IOCompany } from '@madstoq/io-system/types'
import { ChevronDown } from 'lucide-react'

interface Props {
  companies: IOCompany[]
  value: string
  onChange: (companyId: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}

export default function CompanyComboSearch({ companies, value, onChange, placeholder = '— Select Customer —', className = '', inputClassName = '' }: Props) {
  const [query, setQuery] = useState(() => companies.find(c => c.id === value)?.company_name ?? '')
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listboxId = useId()

  useEffect(() => {
    if (!focused) {
      const company = companies.find(c => c.id === value)
      setQuery(company?.company_name ?? '')
    }
  }, [value, companies, focused])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies.slice(0, 40)
    return companies
      .map(company => {
        const name = company.company_name.toLowerCase()
        const matchIndex = name.indexOf(q)
        return { company, matchIndex, startsWith: name.startsWith(q) }
      })
      .filter(entry => entry.matchIndex !== -1)
      .sort((a, b) => {
        if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1
        if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex
        return a.company.company_name.localeCompare(b.company.company_name)
      })
      .slice(0, 40)
      .map(entry => entry.company)
  }, [companies, query])

  function select(company: IOCompany) {
    setQuery(company.company_name)
    onChange(company.id)
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
      const matched = companies.find(c => c.company_name.toLowerCase() === query.trim().toLowerCase())
      if (matched) {
        onChange(matched.id)
        setQuery(matched.company_name)
      } else if (!companies.find(c => c.id === value)) {
        setQuery('')
        onChange('')
      } else {
        const current = companies.find(c => c.id === value)
        setQuery(current?.company_name ?? '')
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
    if (!open) return

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
        filtered.map((company, index) => (
          <button
            key={company.id}
            id={`${listboxId}-option-${company.id}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={() => select(company)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors sm:py-1.5 sm:text-xs ${index === activeIndex ? 'bg-layer text-primary' : 'text-primary hover:bg-layer'}`}
          >
            {company.company_name}
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-muted sm:text-xs">No companies found</div>
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
