import type { ReactNode } from "react";

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
    <section className="relative overflow-hidden rounded-card border border-card bg-hero p-5 shadow-card sm:p-6">
      <div className="animate-blob pointer-events-none absolute -right-10 -top-24 size-72 rounded-full bg-cyan/50 blur-3xl" />
      <div className="pointer-events-none absolute right-[22%] top-6 size-56 rounded-full border-[28px] border-card/50" />
      <div className="pointer-events-none absolute -bottom-20 left-10 size-56 rounded-full bg-lavender/30 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
