import { Link } from '@/crm/router'
import {
  ArrowRight,
  Landmark,
  Map,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useSchemes } from '../context/SchemeContext'
import { usePlots } from '../context/PlotContext'
import { useAuth } from '../context/AuthContext'
import { formatNumber, statusBadgeClass } from '../lib/schemes'
import { Button, Card } from '../components/ui/Form'

export function SchemeListPage() {
  const { schemes, deleteScheme } = useSchemes()
  const { deletePlotsByScheme } = usePlots()
  const { user } = useAuth()
  const [menuId, setMenuId] = useState<string | null>(null)
  const canManage = user?.role === 'admin'

  const removeScheme = (id: string) => {
    deletePlotsByScheme(id)
    deleteScheme(id)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Master Data
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            Plotting Schemes
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Schemes are the parent entity for blocks, plots, customers, bookings,
            and payments.
          </p>
        </div>
        {canManage && (
          <Link to="/schemes/new">
            <Button>
              <Plus className="h-4 w-4" />
              Create Scheme
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="!p-0">
          <div className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Total Schemes
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {schemes.length}
            </p>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Published
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {schemes.filter((s) => s.publishStatus === 'published').length}
            </p>
          </div>
        </Card>
        <Card className="!p-0">
          <div className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Drafts
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {schemes.filter((s) => s.publishStatus === 'draft').length}
            </p>
          </div>
        </Card>
      </div>

      {schemes.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Landmark className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">No schemes yet</h2>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              {canManage
                ? 'Create your first plotting scheme to unlock blocks, plot inventory, pricing, and lead management.'
                : 'Ask an admin to create a scheme before you can take bookings or collect payments.'}
            </p>
            {canManage && (
              <Link to="/schemes/new" className="mt-5">
                <Button>
                  Start Scheme Wizard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2/70 text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Scheme</th>
                  <th className="px-4 py-3 font-semibold">Developer</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Plots</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Publish</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {schemes.map((scheme) => (
                  <tr
                    key={scheme.id}
                    className="border-b border-line last:border-0 hover:bg-surface-2/40"
                  >
                    <td className="px-4 py-3">
                      {canManage ? (
                        <Link
                          to={`/schemes/${scheme.id}/edit`}
                          className="font-semibold text-ink hover:text-brand"
                        >
                          {scheme.schemeName || 'Untitled'}
                        </Link>
                      ) : (
                        <span className="font-semibold text-ink">
                          {scheme.schemeName || 'Untitled'}
                        </span>
                      )}
                      <div className="font-mono text-xs text-ink-faint">
                        {scheme.schemeCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {scheme.developerCompany || '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {[scheme.district, scheme.state].filter(Boolean).join(', ') ||
                        '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {scheme.totalNumberOfPlots
                        ? formatNumber(scheme.totalNumberOfPlots)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium">
                        {scheme.projectStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-semibold capitalize ${statusBadgeClass(scheme.publishStatus)}`}
                      >
                        {scheme.publishStatus}
                      </span>
                    </td>
                    <td className="relative px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-ink-muted hover:bg-surface-2"
                        onClick={() =>
                          setMenuId((id) => (id === scheme.id ? null : scheme.id))
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuId === scheme.id && (
                        <div className="absolute right-4 z-10 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                          {canManage && (
                            <Link
                              to={`/schemes/${scheme.id}/edit`}
                              className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2"
                              onClick={() => setMenuId(null)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Link>
                          )}
                          <Link
                            to={`/plots?scheme=${scheme.id}`}
                            className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2"
                            onClick={() => setMenuId(null)}
                          >
                            <Map className="h-3.5 w-3.5" />
                            Plots
                          </Link>
                          {canManage && (
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-surface-2"
                              onClick={() => {
                                removeScheme(scheme.id)
                                setMenuId(null)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
