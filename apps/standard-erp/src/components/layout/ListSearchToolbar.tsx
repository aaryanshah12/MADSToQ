'use client'

import clsx from 'clsx'
import { Search } from 'lucide-react'

export function ListSearchToolbar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={clsx('list-search-toolbar', className)}>{children}</div>
}

type ListSearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputClassName?: string
}

export function ListSearchField({
  value,
  onChange,
  placeholder,
  inputClassName,
}: ListSearchFieldProps) {
  return (
    <div className="input list-search-field">
      <Search size={14} className="text-muted shrink-0" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className={clsx(
          'flex-1 min-w-0 bg-transparent outline-none text-sm text-primary placeholder:text-muted',
          inputClassName
        )}
        aria-label="Search list"
      />
    </div>
  )
}

export function listSearchBtnClass(variant: string) {
  return clsx('btn list-search-action', variant)
}
