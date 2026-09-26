import { Link, Navigate, useParams } from '@/crm/router'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LayoutGrid,
  Map,
  Tag,
  Upload,
  Users,
  Sparkles,
} from 'lucide-react'
import { useSchemes } from '../context/SchemeContext'
import { Button, Card } from '../components/ui/Form'

const NEXT_STEPS = [
  {
    title: 'Create Blocks',
    detail: 'Define block layout under this scheme',
    icon: LayoutGrid,
  },
  {
    title: 'Import Plot Inventory',
    detail: 'Bulk upload or add plots with sizes & rates',
    icon: Map,
  },
  {
    title: 'Upload Layout Map',
    detail: 'Attach interactive site / CAD layout',
    icon: Upload,
  },
  {
    title: 'Configure Pricing Rules',
    detail: 'Refine premiums, PLC, and payment plans',
    icon: Tag,
  },
  {
    title: 'Assign Sales Team',
    detail: 'Map agents and targets to this scheme',
    icon: Users,
  },
  {
    title: 'Start Lead Management',
    detail: 'Begin capturing and converting enquiries',
    icon: Sparkles,
  },
]

export function SchemeSuccessPage() {
  const { id } = useParams()
  const { getScheme } = useSchemes()
  const scheme = id ? getScheme(id) : undefined

  if (!scheme) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Card>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-4 font-display text-3xl tracking-tight text-ink">
            Scheme published
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink">{scheme.schemeName}</span>
            {' · '}
            <span className="font-mono">{scheme.schemeCode}</span>
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface-2/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Setup checklist
          </p>
          <ul className="mt-3 space-y-2">
            <li className="flex items-center gap-3 text-sm font-medium text-success">
              <CheckCircle2 className="h-5 w-5" />
              Scheme Created
            </li>
          </ul>
        </div>
      </Card>

      <Card
        title="Next Steps"
        description="Complete these to start selling under this scheme."
      >
        <ul className="space-y-3">
          {NEXT_STEPS.map((item) => {
            const Icon = item.icon
            return (
              <li
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink-muted">{item.detail}</p>
                </div>
                <Circle className="mt-2 h-4 w-4 shrink-0 text-ink-faint" />
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={`/plots?scheme=${scheme.id}`}>
            <Button>Open Plot Inventory</Button>
          </Link>
          <Link to={`/schemes/${scheme.id}/edit`}>
            <Button variant="outline">Edit Scheme</Button>
          </Link>
          <Link to="/">
            <Button variant="ghost">
              Back to Schemes
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
