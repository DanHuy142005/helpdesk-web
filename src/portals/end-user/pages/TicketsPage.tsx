import { usePortalData, useActions, useWrite } from "@/shared";
import { Link } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared";
import {
  DataTable,
  PageHeader,
  PillTabs,
  PriorityBadge,
  ProgressBar,
  SectionCard,
  StatusBadge,
  UserAvatar,
  type Column,
} from "@/shared";
import { type MyTicket } from "../data";

const columns: Column<MyTicket>[] = [
  {
    key: "id",
    header: "Ticket",
    cell: (t) => (
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">{t.id}</p>
        <p className="max-w-[280px] truncate font-semibold">{t.title}</p>
      </div>
    ),
  },
  {
    key: "category",
    header: "Loại",
    cell: (t) => <span className="text-muted-foreground">{t.category}</span>,
  },
  { key: "priority", header: "Mức độ", cell: (t) => <PriorityBadge priority={t.priority} /> },
  { key: "status", header: "Trạng thái", cell: (t) => <StatusBadge status={t.status} /> },
  {
    key: "progress",
    header: "Tiến độ",
    cell: (t) => (
      <div className="flex w-28 items-center gap-2">
        <ProgressBar value={t.progress} tone={t.progress === 100 ? "success" : "primary"} />
        <span className="text-[11px] text-muted-foreground">{t.progress}%</span>
      </div>
    ),
  },
  {
    key: "assignee",
    header: "Người xử lý",
    cell: (t) => (
      <div className="flex items-center gap-2">
        <UserAvatar name={t.assignee} />
        <span className="whitespace-nowrap">{t.assignee}</span>
      </div>
    ),
  },
  {
    key: "created",
    header: "Ngày tạo",
    cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{t.createdAt}</span>,
  },
];

const open = (t: MyTicket) => t.progress < 100;

export function EndUserTicketsPage() {
  const { myTickets, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const [tab, setTab] = useState("all");
  const rows = myTickets.filter((t) =>
    tab === "open" ? open(t) : tab === "done" ? !open(t) : true,
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
      <SectionCard>
        <DataTable
          onRowClick={(t) => actions.openTicket(t.id)}
          columns={columns}
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
                  count: myTickets.filter((t) => !open(t)).length,
                },
              ]}
            />
          }
        />
      </SectionCard>
    </div>
  );
}
