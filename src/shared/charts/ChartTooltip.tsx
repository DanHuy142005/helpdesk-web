import type { TooltipProps } from "recharts";

type Props = TooltipProps<number, string>;

/** Card-styled tooltip shared by every chart. */
export function ChartTooltip({ active, payload, label }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
      {label !== undefined && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: (p.payload?.color as string) ?? p.color }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold text-foreground">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
