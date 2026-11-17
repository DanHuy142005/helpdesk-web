import { cn } from "@/lib/utils";

const palettes = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/25 text-info",
  "bg-chart-4/20 text-warning",
  "bg-chart-5/15 text-success",
  "bg-chart-7/15 text-chart-7",
];

const sizes = { sm: "size-8 text-[11px]", md: "size-10 text-xs", lg: "size-14 text-base" };

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts.at(-2)?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

export function UserAvatar({
  name,
  initials,
  size = "sm",
  className,
}: {
  name: string;
  initials?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-bold",
        palettes[hash % palettes.length],
        sizes[size],
        className,
      )}
    >
      {initials ?? initialsOf(name)}
    </span>
  );
}
