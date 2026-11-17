import { cn } from "@/lib/utils";
import { toneBar, type Tone } from "../lib/tones";

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface", className)}>
      <div
        className={cn("h-full rounded-full transition-all", toneBar[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export interface ProgressRow {
  label: string;
  value: number;
  display?: string;
  tone?: Tone;
}

export function ProgressList({ rows }: { rows: ProgressRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground/85">{r.label}</span>
            <span className="font-semibold text-foreground">{r.display ?? `${r.value}%`}</span>
          </div>
          <ProgressBar value={r.value} tone={r.tone ?? "primary"} />
        </li>
      ))}
    </ul>
  );
}
