type StatusBadgeProps = {
  status: string
  className?: string
}

function variantFor(status: string) {
  const key = status.trim().toLowerCase().replace(/\s+/g, '_')
  if (key === 'completed') return 'badge-success'
  if (key === 'in_progress' || key === 'in-progress') return 'badge-warning'
  return 'badge-neutral'
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={`badge ${variantFor(status)} ${className ?? ''}`.trim()}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}
