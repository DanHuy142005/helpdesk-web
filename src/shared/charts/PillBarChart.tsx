import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "./ChartTooltip";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

interface PillShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}

/** Each stacked segment becomes a separate rounded pill with a small gap. */
function PillShape({ x = 0, y = 0, width = 0, height = 0, fill }: PillShapeProps) {
  if (height <= 0) return null;
  const gap = height > 8 ? 2.5 : 0;
  return (
    <rect
      x={x}
      y={y + gap}
      width={width}
      height={Math.max(0, height - gap * 2)}
      rx={width / 2}
      fill={fill}
    />
  );
}

export function PillBarChart({
  data,
  xKey,
  series,
  height = 260,
  stacked = true,
  barSize = 10,
  showYAxis = false,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: BarSeries[];
  height?: number;
  stacked?: boolean;
  barSize?: number;
  showYAxis?: boolean;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: showYAxis ? -16 : 4, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="4 6" stroke="var(--border)" />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            dy={6}
          />
          {showYAxis && (
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
          )}
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface)", radius: 10 }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              {...(stacked ? { stackId: "stack" } : {})}
              fill={s.color}
              barSize={barSize}
              shape={<PillShape />}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
