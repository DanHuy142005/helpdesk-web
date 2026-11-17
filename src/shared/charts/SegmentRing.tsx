import { ArrowDown, ArrowUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export interface RingCategory {
  name: string;
  value: number;
  color: string;
  change?: string;
  trend?: "up" | "down";
  share?: number;
}

/** Ring made of many small rounded segments, colored by category share. */
export function SegmentRing({
  data,
  centerValue,
  centerLabel,
  segments = 34,
}: {
  data: RingCategory[];
  centerValue: string;
  centerLabel: string;
  segments?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cells: { key: string; color: string }[] = [];
  data.forEach((d) => {
    const count = Math.max(1, Math.round((d.value / total) * segments));
    for (let i = 0; i < count; i++) cells.push({ key: `${d.name}-${i}`, color: d.color });
  });
  const pieData = cells.map((c) => ({ ...c, value: 1 }));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              innerRadius="70%"
              outerRadius="97%"
              paddingAngle={3}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((c) => (
                <Cell key={c.key} fill={c.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-3xl font-bold text-foreground">{centerValue}</p>
            <p className="text-xs text-muted-foreground">{centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-3.5">
        {data.map((d) => (
          <li key={d.name}>
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/85">
              <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
              {d.name}
            </div>
            {d.change && (
              <p
                className={
                  d.trend === "down"
                    ? "mt-0.5 flex items-center gap-1 pl-[18px] text-xs font-semibold text-success"
                    : "mt-0.5 flex items-center gap-1 pl-[18px] text-xs font-semibold text-danger"
                }
              >
                {d.trend === "down" ? (
                  <ArrowDown className="size-3" />
                ) : (
                  <ArrowUp className="size-3" />
                )}
                {d.change}
              </p>
            )}
            {d.share !== undefined && (
              <p className="mt-0.5 pl-[18px] text-xs font-semibold text-muted-foreground">
                {d.share}% tổng số
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
