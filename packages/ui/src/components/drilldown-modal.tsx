import clsx from 'clsx'
import { X } from 'lucide-react'

export type DrilldownRow = {
  supplier: string
  product: string
  quantity: number
  unit?: string
}

interface DrilldownModalProps {
  open: boolean
  title: string
  subtitle?: string
  rows: DrilldownRow[]
  loading?: boolean
  onClose: () => void
}

export default function DrilldownModal({ open, title, subtitle, rows, loading, onClose }: DrilldownModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-panel border border-border rounded-2xl shadow-2xl w-full max-w-3xl mx-auto mt-10">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <div className="font-display text-xl text-primary">{title}</div>
            {subtitle && <div className="text-sm text-muted mt-1">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-layer text-muted hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center text-muted py-12">No data available.</div>
        ) : (
          <div className="p-5">
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Product</th>
                    <th className="text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={`${r.supplier}-${r.product}-${idx}`}>
                      <td className="text-primary">{r.supplier}</td>
                      <td className="text-muted">{r.product}</td>
                      <td className="font-mono text-right text-owner">{r.quantity.toFixed(2)} {r.unit ?? 'KGS'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden data-card-list">
              {rows.map((r, idx) => (
                <div key={`${r.supplier}-${r.product}-${idx}`} className="data-card">
                  <div className="data-card-header">
                    <span className="data-card-title text-primary">{r.supplier}</span>
                    <span className="data-card-meta">{r.product}</span>
                  </div>
                  <div className="text-right font-mono text-owner text-lg">
                    {r.quantity.toFixed(2)} {r.unit ?? 'KGS'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
