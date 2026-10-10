import type { ReactNode } from "react";

export type ErpAccent = "owner" | "inputer" | "chemist" | "accountant";

export type ErpPageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  accent?: ErpAccent;
};

const accentColors: Record<ErpAccent, string> = {
  owner: "text-owner",
  inputer: "text-inputer",
  chemist: "text-chemist",
  accountant: "text-pmc",
};

/** Inventory / ERP shell header (owner–inputer–chemist accents). */
export default function ErpPageHeader({
  title,
  subtitle,
  actions,
  accent = "inputer",
}: ErpPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {subtitle ?? "Overview"}
          </div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-primary md:text-3xl">
            {title}
          </h1>
          <div className={`mt-2 h-0.5 w-16 rounded-full bg-current ${accentColors[accent]}`} />
        </div>
        {actions ? <div className="flex flex-shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
