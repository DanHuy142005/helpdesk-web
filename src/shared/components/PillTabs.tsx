import { cn } from "@/lib/utils";

export interface PillTab {
  value: string;
  label: string;
  count?: number;
}

export function PillTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: PillTab[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            value === t.value
              ? "bg-card text-primary shadow-soft"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "rounded-md px-1.5 text-[10px]",
                value === t.value ? "bg-primary/10" : "bg-card",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
