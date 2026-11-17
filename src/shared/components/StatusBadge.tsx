import { cn } from "@/lib/utils";
import { priorityTone, statusTone, type TicketPriority, type TicketStatus } from "../lib/ticket";
import { toneDot, toneSoft, type Tone } from "../lib/tones";

export function Badge({
  tone = "muted",
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold",
        toneSoft[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", toneDot[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge tone={statusTone[status]}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge tone={priorityTone[priority]} dot={false} className="rounded-md px-2 py-0.5 text-[11px]">
      {priority}
    </Badge>
  );
}
