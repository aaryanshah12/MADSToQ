import { cn } from "@madstoq/shared-utils";
import type { ReactNode } from "react";

export type StatCardColor = "owner" | "inputer" | "chemist" | "muted";

export type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  color?: StatCardColor;
  trend?: "up" | "down" | "neutral";
  onClick?: () => void;
  actionLabel?: string;
};

const colorMap: Record<
  StatCardColor,
  { border: string; bg: string; text: string; icon: string }
> = {
  owner: {
    border: "border-owner/25",
    bg: "bg-owner/8",
    text: "text-owner",
    icon: "bg-owner/10",
  },
  inputer: {
    border: "border-inputer/25",
    bg: "bg-inputer/8",
    text: "text-inputer",
    icon: "bg-inputer/10",
  },
  chemist: {
    border: "border-chemist/25",
    bg: "bg-chemist/8",
    text: "text-chemist",
    icon: "bg-chemist/10",
  },
  muted: {
    border: "border-border",
    bg: "bg-panel",
    text: "text-primary",
    icon: "bg-layer",
  },
};

export default function StatCard({
  label,
  value,
  sub,
  icon,
  color = "muted",
  trend,
  onClick,
  actionLabel = "Drill down",
}: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className={cn(
        "card w-full overflow-hidden border p-4 transition-all hover:scale-[1.01] sm:p-5",
        c.border,
        onClick
          ? "cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
          : "",
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">{label}</div>
          <div className={cn("font-display text-2xl font-bold leading-tight sm:text-3xl", c.text)}>
            {value}
          </div>
          {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "grid size-10 flex-shrink-0 place-items-center rounded-xl border border-border shadow-inner sm:size-12",
              c.icon,
              c.text,
            )}
          >
            <div className="scale-100 sm:scale-110">{icon}</div>
          </div>
        ) : null}
      </div>
      {trend || onClick ? (
        <div className="mt-3 flex items-center justify-between">
          {trend ? (
            <div
              className={cn(
                "font-mono text-xs",
                trend === "up" ? "text-chemist" : trend === "down" ? "text-red-400" : "text-muted",
              )}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} vs last month
            </div>
          ) : null}
          {onClick ? (
            <div className="flex items-center gap-1 font-mono text-[11px] text-primary">
              <span>{actionLabel}</span>
              <span aria-hidden>→</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
