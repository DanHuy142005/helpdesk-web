import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { toneSoft, type Tone } from "../lib/tones";

export function IconTile({
  icon: Icon,
  tone = "primary",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  const s = size === "sm" ? "size-8 [&_svg]:size-4" : size === "lg" ? "size-12 [&_svg]:size-6" : "size-10 [&_svg]:size-5";
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl", toneSoft[tone], s)}>
      <Icon />
    </span>
  );
}
