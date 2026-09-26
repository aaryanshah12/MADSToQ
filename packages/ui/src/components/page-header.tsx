import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  accent?: 'owner' | 'inputer' | 'chemist'
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 mb-6 md:mb-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-[0.14em] mb-1">
            {subtitle ?? 'Overview'}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-primary">
            {title}
          </h1>
        </div>
        {actions && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}