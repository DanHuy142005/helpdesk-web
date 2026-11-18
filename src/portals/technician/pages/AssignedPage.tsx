import { usePortalData, useActions } from "@/shared";
import { MapPin } from "lucide-react";
import { useState } from "react";

import {
  DataTable,
  PageHeader,
  PillTabs,
  PriorityBadge,
  ProgressBar,
  SectionCard,
  StatusBadge,
  type Column,
} from "@/shared";
import { type Job } from "../data";

const columns: Column<Job>[] = [
  {
    key: "id",
    header: "Mã",
    cell: (j) => <span className="font-semibold text-primary">{j.id}</span>,
  },
  {
    key: "title",
    header: "Công việc",
    cell: (j) => (
      <div className="max-w-[260px]">
        <p className="truncate font-semibold">{j.title}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" /> {j.location}
        </p>
      </div>
    ),
  },
  {
    key: "device",
    header: "Thiết bị",
    cell: (j) => (
      <code className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-semibold">{j.device}</code>
    ),
  },
  {
    key: "from",
    header: "Giao bởi",
    cell: (j) => <span className="text-muted-foreground">{j.from}</span>,
  },
  { key: "priority", header: "Ưu tiên", cell: (j) => <PriorityBadge priority={j.priority} /> },
  {
    key: "sla",
    header: "SLA",
    cell: (j) => (
      <div className="w-28">
        <p className="mb-1 text-[11px] text-muted-foreground">Hạn {j.due}</p>
        <ProgressBar
          value={j.slaPct}
          className="h-1.5"
          tone={j.slaPct > 80 ? "danger" : j.slaPct > 50 ? "warning" : "primary"}
        />
      </div>
    ),
  },
  { key: "status", header: "Trạng thái", cell: (j) => <StatusBadge status={j.status} /> },
];

export function TechnicianAssignedPage() {
  const { jobs } = usePortalData();
  const actions = useActions();
  const [tab, setTab] = useState("all");
  const rows =
    tab === "all" ? jobs : jobs.filter((j) => j.priority === "Khẩn cấp" || j.priority === "Cao");
  return (
    <div>
      <PageHeader
        eyebrow="Công việc"
        title="Công việc được giao"
        description="Nhấn vào Ticket để xem thông tin. Trò chuyện với End User và xác nhận kết quả tại Xử lý sự cố."
      />
      <SectionCard>
        <DataTable
          onRowClick={(j) => actions.openTicket(j.id)}
          columns={columns}
          rows={rows}
          getRowKey={(j) => j.id}
          searchText={(j) => `${j.id} ${j.title} ${j.device}`}
          searchPlaceholder="Tìm công việc, thiết bị..."
          toolbar={
            <PillTabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "all", label: "Tất cả", count: jobs.length },
                {
                  value: "urgent",
                  label: "Ưu tiên cao",
                  count: jobs.filter((j) => j.priority === "Khẩn cấp" || j.priority === "Cao")
                    .length,
                },
              ]}
            />
          }
        />
      </SectionCard>
    </div>
  );
}
