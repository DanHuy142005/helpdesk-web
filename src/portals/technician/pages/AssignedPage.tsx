import { usePortalData, useActions, useWrite } from "@/shared";
import { MapPin, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared";
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

const columnsFor = (act: (job: Job) => void): Column<Job>[] => [
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
  {
    key: "action",
    header: "",
    align: "right",
    cell: (j) => (
      <Button
        size="sm"
        variant="soft"
        onClick={(e) => {
          e.stopPropagation();
          act(j);
        }}
      >
        <Play /> {j.status === "Đã chuyển" ? "Bắt đầu" : "Chi tiết"}
      </Button>
    ),
  },
];

export function TechnicianAssignedPage() {
  const { jobs, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const columns = columnsFor((j) => {
    if (j.status === "Đã chuyển")
      void write("/tickets/" + j.id + "/actions", { action: "start", version: j.version })
        .then(() => {
          toast.success("Đã bắt đầu " + j.id);
          actions.openTicket(j.id);
        })
        .catch(() => {});
    else actions.openTicket(j.id);
  });
  const [tab, setTab] = useState("all");
  const rows =
    tab === "all" ? jobs : jobs.filter((j) => j.priority === "Khẩn cấp" || j.priority === "Cao");
  return (
    <div>
      <PageHeader
        eyebrow="Công việc"
        title="Công việc được giao"
        description="Các Ticket được Helpdesk hoặc quản trị viên giao cho bạn."
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
