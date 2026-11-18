import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toneSoft, type Tone } from "../lib/tones";

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "flat";
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

export function KpiCard({
  label,
  value,
  delta,
  trend = "up",
  hint = "Dữ liệu hiện tại",
  icon: Icon,
  tone = "primary",
  className,
}: KpiCardProps) {
  const positive = trend !== "down";
  return (
    <div
      data-kpi-tone={tone}
      className={cn(
        "card-surface kpi-background flex flex-col justify-between gap-4 p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[26px] font-bold leading-none text-foreground">
              {value}
            </span>
            {delta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-semibold",
                  trend === "flat"
                    ? "text-muted-foreground"
                    : positive
                      ? "text-success"
                      : "text-danger",
                )}
              >
                {delta}
                {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground/85">{label}</p>
        </div>
        {Icon && (
          <span className={cn("grid size-10 place-items-center rounded-xl", toneSoft[tone])}>
            <Icon className="size-5" />
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{hint}</span>
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full",
            positive ? "bg-success text-primary-foreground" : "bg-danger text-primary-foreground",
          )}
        >
          {positive ? (
            <ArrowUpRight className="size-3.5" />
          ) : (
            <ArrowDownRight className="size-3.5" />
          )}
        </span>
      </div>
    </div>
  );
}
