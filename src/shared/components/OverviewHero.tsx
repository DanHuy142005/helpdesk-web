import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OverviewStat {
  value: string;
  note?: string;
  label: string;
}

/** Large gradient "Quick overview" panel with glass stat tiles. */
export function OverviewHero({
  title,
  subtitle,
  stats,
  actions,
}: {
  title: string;
  subtitle?: string;
  stats: OverviewStat[];
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-card border border-card bg-dashboard p-5 shadow-card sm:p-6">
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>

      <div
        className={cn(
          "relative mt-5 grid grid-cols-2 gap-3",
          stats.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3 xl:grid-cols-5",
        )}
      >
        {stats.map((s) => (
          <div key={s.label} className="glass-tile px-4 py-3.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-bold text-foreground">{s.value}</span>
              {s.note && <span className="text-[11px] text-muted-foreground">({s.note})</span>}
            </div>
            <p className="mt-0.5 text-sm font-medium text-foreground/80">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
