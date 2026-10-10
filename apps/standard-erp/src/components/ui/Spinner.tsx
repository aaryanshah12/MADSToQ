'use client'

import clsx from 'clsx'

/** Role accents defined as CSS variables in globals.css. */
export type Accent = 'owner' | 'inputer' | 'chemist' | 'pmc' | 'muted'

const accentBorder: Record<Accent, string> = {
  owner: 'border-owner',
  inputer: 'border-inputer',
  chemist: 'border-chemist',
  pmc: 'border-pmc',
  muted: 'border-muted',
}

const sizeClass = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
} as const

export type SpinnerProps = {
  accent?: Accent
  size?: keyof typeof sizeClass
  className?: string
  /** Announced to screen readers. */
  label?: string
}

export function Spinner({ accent = 'muted', size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={clsx(
        'inline-block shrink-0 rounded-full border-t-transparent animate-spin align-middle',
        sizeClass[size],
        accentBorder[accent],
        className,
      )}
    />
  )
}

/** Centered spinner for a panel or modal body that has no content yet. */
export function SpinnerBlock({
  accent = 'muted',
  size = 'lg',
  className,
  label,
}: SpinnerProps) {
  return (
    <div className={clsx('flex items-center justify-center py-16', className)}>
      <Spinner accent={accent} size={size} label={label} />
    </div>
  )
}
