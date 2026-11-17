import { MoreHorizontal } from "lucide-react";

import { PriorityBadge, StatusBadge, UserAvatar, type Column, useActions } from "@/shared";
import type { AdminTicket } from "./data";

export const ticketColumns: Column<AdminTicket>[] = [
  {
    key: "id",
    header: "Mã Ticket",
    cell: (t) => <span className="font-semibold text-primary">{t.id}</span>,
  },
  {
    key: "title",
    header: "Tiêu đề",
    cell: (t) => (
      <div className="max-w-[260px]">
        <p className="truncate font-semibold text-foreground">{t.title}</p>
        <p className="text-xs text-muted-foreground">{t.category}</p>
      </div>
    ),
  },
  {
    key: "requester",
    header: "Người yêu cầu",
    cell: (t) => (
      <div className="flex items-center gap-2.5">
        <UserAvatar name={t.requester} />
        <div className="leading-tight">
          <p className="font-medium">{t.requester}</p>
          <p className="text-xs text-muted-foreground">{t.department}</p>
        </div>
      </div>
    ),
  },
  { key: "priority", header: "Ưu tiên", cell: (t) => <PriorityBadge priority={t.priority} /> },
  {
    key: "assignee",
    header: "Phụ trách",
    cell: (t) => <span className="text-sm">{t.assignee}</span>,
  },
  {
    key: "createdAt",
    header: "Ngày tạo",
    cell: (t) => <span className="text-muted-foreground">{t.createdAt}</span>,
  },
  { key: "status", header: "Trạng thái", cell: (t) => <StatusBadge status={t.status} /> },
  {
    key: "actions",
    header: "",
    align: "right",
    cell: (t) => <TicketActions id={t.id} />,
  },
];
function TicketActions({ id }: { id: string }) {
  const actions = useActions();
  return (
    <button
      type="button"
      aria-label="Thao tác"
      onClick={(e) => {
        e.stopPropagation();
        actions.openTicket(id);
      }}
      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface"
    >
      <MoreHorizontal className="size-4" />
    </button>
  );
}
