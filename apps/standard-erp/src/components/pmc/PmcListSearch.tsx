'use client'

import { Search } from 'lucide-react'

type PmcListSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function PmcListSearch({ value, onChange, placeholder, className }: PmcListSearchProps) {
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      <div className="input flex items-center gap-2 w-full sm:max-w-md">
        <Search size={14} className="text-muted shrink-0" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Search…'}
          className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted pmc-focus"
          aria-label="Search list"
        />
      </div>
    </div>
  )
}
