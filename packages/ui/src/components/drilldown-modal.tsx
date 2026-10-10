"use client";

import { cn } from "@madstoq/shared-utils";
import { X } from "lucide-react";
import { useEffect } from "react";

export type DrilldownRow = {
  supplier: string;
  product: string;
  quantity: number;
  unit?: string;
};

export type DrilldownModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  rows: DrilldownRow[];
  loading?: boolean;
  onClose: () => void;
};

export default function DrilldownModal({
  open,
  title,
  subtitle,
  rows,
  loading,
  onClose,
}: DrilldownModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/60 max-md:items-end max-md:overflow-hidden md:justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drilldown-modal-title"
        className="flex w-full max-w-3xl flex-col overflow-hidden bg-panel shadow-2xl max-md:h-auto max-md:max-h-[88dvh] max-md:rounded-t-2xl md:h-full md:border-l md:border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div id="drilldown-modal-title" className="font-display text-xl text-primary">
              {title}
            </div>
            {subtitle ? <div className="mt-1 text-sm text-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-layer hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 py-12 text-center text-muted">No data available.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
            <div className="hidden overflow-x-auto md:block">
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
                      <td className="text-right font-mono text-owner">
                        {r.quantity.toFixed(2)} {r.unit ?? "KGS"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={cn("data-card-list md:hidden")}>
              {rows.map((r, idx) => (
                <div key={`${r.supplier}-${r.product}-${idx}`} className="data-card">
                  <div className="data-card-header">
                    <span className="data-card-title text-primary">{r.supplier}</span>
                    <span className="data-card-meta">{r.product}</span>
                  </div>
                  <div className="text-right font-mono text-lg text-owner">
                    {r.quantity.toFixed(2)} {r.unit ?? "KGS"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
