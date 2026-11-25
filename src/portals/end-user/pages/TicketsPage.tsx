import { usePortalData, useActions } from "@/shared";
import { Link } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared";
import {
  DataTable,
  isFinalTicketStatus,
  PageHeader,
  PillTabs,
  PriorityBadge,
  TicketCompletionButton,
  TicketFeedbackAction,
  SectionCard,
  StatusBadge,
  type Column,
} from "@/shared";
import { type MyTicket } from "../data";

function TicketStatus({ ticket }: { ticket: MyTicket }) {
  return (
    <div className="space-y-1">
      <StatusBadge status={ticket.status} />
      {ticket.assignee !== "—" && (
        <p className="break-words text-xs text-muted-foreground">{ticket.assignee}</p>
      )}
      {ticket.closed_automatically && <p className="text-xs text-muted-foreground">Tự động đóng</p>}
    </div>
  );
}

const columns: Column<MyTicket>[] = [
  {
    key: "id",
    header: "Ticket",
    className: "px-2 sm:px-4",
    cell: (t) => (
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">{t.id}</p>
        <p className="line-clamp-2 break-words font-semibold" title={t.title}>
          {t.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{t.category}</span>
          <PriorityBadge priority={t.priority} />
          <span className="whitespace-nowrap" title="Ngày tạo">
            {t.createdAt}
          </span>
        </div>
        <div className="mt-2 @min-[43rem]:hidden">
          <TicketStatus ticket={t} />
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: "Trạng thái",
    className: "hidden w-[28%] @min-[43rem]:table-cell",
    cell: (ticket) => <TicketStatus ticket={ticket} />,
  },
  {
    key: "actions",
    header: "Thao tác / Đánh giá",
    align: "center",
    className: "w-28 px-2 @min-[43rem]:w-44 @min-[43rem]:px-4",
    cell: (ticket) =>
      ticket.status === "Đã giải quyết" ? (
        <TicketCompletionButton
          ticket={ticket}
          className="h-auto min-h-8 max-w-full whitespace-normal px-2 py-1.5"
        />
      ) : ticket.status === "Đã đóng" ? (
        <TicketFeedbackAction ticket={ticket} />
      ) : null,
  },
];

const open = (t: MyTicket) => !isFinalTicketStatus(t.status);

export function EndUserTicketsPage() {
  const { myTickets } = usePortalData();
  const actions = useActions();
  const [tab, setTab] = useState("all");
  const rows = myTickets.filter((t) =>
    tab === "open"
      ? open(t)
      : tab === "done"
        ? t.status === "Đã đóng"
        : tab === "withdrawn"
          ? t.status === "Đã thu hồi"
          : true,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Cá nhân"
        title="Ticket của tôi"
        description="Tất cả yêu cầu hỗ trợ bạn đã gửi tới phòng CNTT."
        actions={
          <Button variant="brand" asChild>
            <Link to="/end-user/new-request">
              <PlusCircle /> Tạo yêu cầu
            </Link>
          </Button>
        }
      />
      <SectionCard className="p-3 sm:p-5" bodyClassName="@container">
        <DataTable
          onRowClick={(t) => actions.openTicket(t.id)}
          columns={columns}
          tableClassName="min-w-0 table-fixed"
          rows={rows}
          getRowKey={(t) => t.id}
          searchText={(t) => `${t.id} ${t.title} ${t.category}`}
          searchPlaceholder="Tìm theo mã hoặc tiêu đề..."
          totalLabel={`${myTickets.length} Ticket`}
          toolbar={
            <PillTabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "all", label: "Tất cả", count: myTickets.length },
                { value: "open", label: "Đang mở", count: myTickets.filter(open).length },
                {
                  value: "done",
                  label: "Đã xong",
                  count: myTickets.filter((t) => t.status === "Đã đóng").length,
                },
                {
                  value: "withdrawn",
                  label: "Đã thu hồi",
                  count: myTickets.filter((t) => t.status === "Đã thu hồi").length,
                },
              ]}
            />
          }
        />
      </SectionCard>
    </div>
  );
}
