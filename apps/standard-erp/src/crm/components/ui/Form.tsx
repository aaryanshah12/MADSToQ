import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

export function Card({
  children,
  className = '',
  title,
  description,
  action,
}: {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_0_rgba(21,36,31,0.04)] ${className}`}
    >
      {(title || description || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div>
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className = '',
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-ink-faint">{hint}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  )
}

const controlClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${controlClass} min-h-[100px] resize-y ${props.className ?? ''}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${controlClass} ${props.className ?? ''}`} />
  )
}

export type ComboboxOption = {
  value: string
  label: string
}

/** Type-to-filter dropdown — pick from options by typing a name. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Type to search…',
  disabled,
  emptyMessage = 'No matches',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  disabled?: boolean
  emptyMessage?: string
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const selected = options.find((o) => o.value === value)
  const [query, setQuery] = useState(selected?.label || '')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    if (!open) setQuery(selected?.label || '')
  }, [selected?.label, value, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const pick = (opt: ComboboxOption) => {
    onChange(opt.value)
    setQuery(opt.label)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else if (filtered.length)
        setHighlight((h) => Math.min(h + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered[highlight]) pick(filtered[highlight])
      else setOpen(true)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery(selected?.label || '')
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="combobox-list"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        className={controlClass}
        onFocus={() => {
          if (!disabled) setOpen(true)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value && e.target.value !== selected?.label) {
            // Clear selection while typing a new filter
            onChange('')
          }
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && (
        <ul
          id="combobox-list"
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-ink-muted">
              {emptyMessage}
            </li>
          ) : (
            filtered.map((opt, i) => {
              const active = opt.value === value
              const hi = i === highlight
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`flex w-full px-3.5 py-2 text-left text-sm transition ${
                      hi || active
                        ? 'bg-brand/10 font-medium text-ink'
                        : 'text-ink hover:bg-surface-2'
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt)}
                  >
                    {opt.label}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}) {
  const variants = {
    primary:
      'bg-brand text-brand-ink hover:brightness-110 active:brightness-95 shadow-sm',
    secondary: 'bg-surface-2 text-ink hover:bg-line',
    ghost: 'bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
    danger: 'bg-danger text-white hover:brightness-110',
    outline:
      'border border-line-strong bg-surface text-ink hover:bg-surface-2',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-sm',
  }

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  labelYes = 'Yes',
  labelNo = 'No',
}: {
  checked: boolean
  onChange: (value: boolean) => void
  labelYes?: string
  labelNo?: string
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          checked
            ? 'bg-surface text-ink shadow-sm'
            : 'text-ink-muted hover:text-ink'
        }`}
      >
        {labelYes}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          !checked
            ? 'bg-surface text-ink shadow-sm'
            : 'text-ink-muted hover:text-ink'
        }`}
      >
        {labelNo}
      </button>
    </div>
  )
}

export function CheckboxCard({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
        checked
          ? 'border-brand bg-brand-soft text-ink'
          : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
          checked
            ? 'border-brand bg-brand text-brand-ink'
            : 'border-line-strong bg-surface'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}

export function MultiSelectDropdown<T extends string>({
  label,
  options,
  values,
  onChange,
  allLabel = 'All',
  className = '',
}: {
  label: string
  options: { value: T; label: string; count?: number; disabled?: boolean }[]
  values: T[]
  onChange: (next: T[]) => void
  allLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (value: T) => {
    const opt = options.find((o) => o.value === value)
    if (opt?.disabled && !values.includes(value)) return
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    )
  }

  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label || '1 selected'
        : `${values.length} selected`

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-w-[140px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
          values.length > 0
            ? 'border-brand/40 bg-brand-soft/50 text-ink'
            : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          <span className="text-ink-faint">{label}</span>
          <span className="mx-1.5 text-ink-faint">·</span>
          <span className="text-ink">{summary}</span>
        </span>
        <span className="text-[10px] text-ink-faint">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 z-30 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          role="listbox"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-xs font-semibold text-ink">{label}</p>
            {values.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-brand hover:underline"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            )}
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.map((opt) => {
              const checked = values.includes(opt.value)
              const disabled = Boolean(opt.disabled) && !checked
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    aria-disabled={disabled}
                    disabled={disabled}
                    onClick={() => toggle(opt.value)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                      disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:bg-surface-2'
                    } ${checked ? 'text-ink' : 'text-ink-muted'}`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                        checked
                          ? 'border-brand bg-brand text-brand-ink'
                          : 'border-line-strong bg-surface'
                      }`}
                    >
                      {checked ? '✓' : ''}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {typeof opt.count === 'number' && (
                      <span className="text-[11px] tabular-nums text-ink-faint">
                        {opt.count}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function StatPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  )
}
