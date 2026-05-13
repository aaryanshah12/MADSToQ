import clsx from 'clsx'
import { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  color?: 'owner' | 'inputer' | 'chemist' | 'muted'
  trend?: 'up' | 'down' | 'neutral'
  onClick?: () => void
  actionLabel?: string
}

const colorMap = {
  owner:   { border: 'border-owner/25',   bg: 'bg-owner/8',   text: 'text-owner',   icon: 'bg-owner/10'   },
  inputer: { border: 'border-inputer/25', bg: 'bg-inputer/8', text: 'text-inputer', icon: 'bg-inputer/10' },
  chemist: { border: 'border-chemist/25', bg: 'bg-chemist/8', text: 'text-chemist', icon: 'bg-chemist/10' },
  muted:   { border: 'border-border',     bg: 'bg-panel',     text: 'text-primary',   icon: 'bg-layer'    },
}

export default function StatCard({
  label,
  value,
  sub,
  icon,
  color = 'muted',
  trend,
  onClick,
  actionLabel = 'Drill down',
}: StatCardProps) {
  const c = colorMap[color]
  return (
    <div
      className={clsx(
        'card border p-4 sm:p-5 transition-all hover:scale-[1.01] w-full overflow-hidden',
        c.border,
        onClick ? 'cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40' : ''
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() }}}
    >
      <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-muted uppercase tracking-widest mb-2">{label}</div>
          <div className={clsx('font-display text-2xl sm:text-3xl font-bold leading-tight', c.text)}>{value}</div>
          {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
        </div>
        {icon && (
          <div
            className={clsx(
              'size-10 sm:size-12 rounded-xl grid place-items-center flex-shrink-0 shadow-inner border border-border',
              c.icon,
              c.text
            )}
          >
            <div className="scale-100 sm:scale-110">{icon}</div>
          </div>
        )}
      </div>
      {(trend || onClick) && (
        <div className="mt-3 flex items-center justify-between">
          {trend && (
            <div className={clsx('text-xs font-mono',
              trend === 'up' ? 'text-chemist' : trend === 'down' ? 'text-red-400' : 'text-muted'
            )}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} vs last month
            </div>
          )}
          {onClick && (
            <div className="text-[11px] font-mono text-primary flex items-center gap-1">
              <span>{actionLabel}</span>
              <span aria-hidden>→</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
