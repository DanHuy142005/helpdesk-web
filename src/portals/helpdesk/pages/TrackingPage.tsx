import { usePortalData, useActions, useWrite } from "@/shared";
import { Clock3, MessageSquare } from "lucide-react";

import { cn } from "@/shared";
import {
  PageHeader,
  PriorityBadge,
  UserAvatar,
  statusTone,
  toneDot,
  type TicketPriority,
  type TicketStatus,
} from "@/shared";

interface Card {
  id: string;
  title: string;
  owner: string;
  priority: TicketPriority;
  time: string;
  comments: number;
}

export function HelpdeskTrackingPage() {
  const { queue, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const columns = (
    ["Mới", "Đang xử lý", "Chờ phản hồi", "Đã chuyển", "Đã giải quyết", "Đã đóng"] as TicketStatus[]
  ).map((status) => ({
    status,
    cards: queue
      .filter((t) => t.status === status)
      .map((t) => ({
        id: t.id,
        title: t.title,
        owner: t.assignee,
        priority: t.priority,
        time: t.updatedAt,
        comments: t.comment_count,
      })),
  }));
  return (
    <div>
      <PageHeader
        eyebrow="Điều phối"
        title="Theo dõi công việc"
        description="Bảng theo dõi tiến độ mọi Ticket do bạn tiếp nhận, kể cả Ticket đã chuyển cho Technician."
      />
      <div className="scrollbar-thin -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {columns.map((col) => (
          <div key={col.status} className="w-[280px] shrink-0 rounded-card bg-surface/80 p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", toneDot[statusTone[col.status]])} />
                <h3 className="text-sm font-bold">{col.status}</h3>
              </div>
              <span className="rounded-md bg-card px-2 py-0.5 text-xs font-bold text-muted-foreground">
                {col.cards.length}
              </span>
            </div>
            <div className="space-y-3">
              {col.cards.map((card) => (
                <article
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => actions.openTicket(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") actions.openTicket(card.id);
                  }}
                  className="card-surface p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{card.id}</span>
                    <PriorityBadge priority={card.priority} />
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug">{card.title}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <UserAvatar name={card.owner} className="size-6 rounded-lg text-[9px]" />
                      {card.owner.split(" ").slice(-1)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3.5" /> {card.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="size-3.5" /> {card.time}
                      </span>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
