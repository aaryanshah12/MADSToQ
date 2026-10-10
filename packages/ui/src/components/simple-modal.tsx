"use client";

import { cn } from "@madstoq/shared-utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export type SimpleModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
};

export default function SimpleModal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = "md:max-w-2xl",
}: SimpleModalProps) {
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
        aria-labelledby="simple-modal-title"
        className={cn(
          "flex w-full flex-col overflow-hidden bg-panel shadow-2xl max-md:h-auto max-md:max-h-[88dvh] max-md:rounded-t-2xl md:h-full md:border-l md:border-border",
          widthClass,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div id="simple-modal-title" className="font-display text-xl text-primary">
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">{children}</div>

        {footer ? (
          <div className="border-t border-border bg-layer-sm px-5 py-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
