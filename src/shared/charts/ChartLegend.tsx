import type { LucideIcon } from "lucide-react";

export interface LegendStat {
  label: string;
  value: string;
  color: string;
  icon: LucideIcon;
}

/** Footer row under a chart: colored icon bubble + value + label. */
export function ChartLegendStats({ items }: { items: LegendStat[] }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
      {items.map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3">
          <span
            className="grid size-7 place-items-center rounded-full text-primary-foreground"
            style={{ background: color }}
          >
            <Icon className="size-3.5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
