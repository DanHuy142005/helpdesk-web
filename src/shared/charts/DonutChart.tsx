import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";
import { ChartTooltip } from "./ChartTooltip";

export interface ChartDatum {
  name: string;
  value: number;
  color: string;
}

/** Thick rounded donut with gaps between slices + dot legend. */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
  layout = "row",
  size = 200,
}: {
  data: ChartDatum[];
  centerValue?: string;
  centerLabel?: string;
  layout?: "row" | "column";
  size?: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-6",
        layout === "row" ? "flex-col sm:flex-row" : "flex-col",
      )}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="96%"
              paddingAngle={4}
              cornerRadius={10}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {centerValue && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-2xl font-bold text-foreground">{centerValue}</p>
              {centerLabel && <p className="text-[11px] text-muted-foreground">{centerLabel}</p>}
            </div>
          </div>
        )}
      </div>
      <ul
        className={cn(
          "grid w-full gap-x-5 gap-y-3 text-[13px]",
          layout === "row" ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="truncate text-foreground/80">{d.name}</span>
            <span className="ml-auto font-semibold text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
