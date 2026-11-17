import { usePortalData, useActions, useWrite } from "@/shared";
import { AlarmClock, Globe, Hand, Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared";
import {
  DataTable,
  PageHeader,
  PillTabs,
  PriorityBadge,
  SectionCard,
  StatusBadge,
  UserAvatar,
  type Column,
} from "@/shared";
import { type Channel, type QueueTicket } from "../data";

const channelIcon: Record<Channel, typeof Mail> = {
  Email: Mail,
  "Điện thoại": Phone,
  "Cổng web": Globe,
  Chat: MessageCircle,
};

const columnsFor = (act: (ticket: QueueTicket) => void): Column<QueueTicket>[] => [
  {
    key: "id",
    header: "Mã",
    cell: (t) => <span className="font-semibold text-primary">{t.id}</span>,
  },
  {
    key: "title",
    header: "Sự cố",
    cell: (t) => (
      <div className="max-w-[260px]">
        <p className="truncate font-semibold">{t.title}</p>
        <p className="text-xs text-muted-foreground">{t.category}</p>
      </div>
    ),
  },
  {
    key: "requester",
    header: "Người yêu cầu",
    cell: (t) => (
      <div className="flex items-center gap-2">
        <UserAvatar name={t.requester} />
        <div className="leading-tight">
          <p className="font-medium">{t.requester}</p>
          <p className="text-xs text-muted-foreground">{t.department}</p>
        </div>
      </div>
    ),
  },
  {
    key: "channel",
    header: "Kênh",
    cell: (t) => {
      const Icon = channelIcon[t.channel];
      return (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-4" /> {t.channel}
        </span>
      );
    },
  },
  { key: "priority", header: "Ưu tiên", cell: (t) => <PriorityBadge priority={t.priority} /> },
  {
    key: "sla",
    header: "SLA còn lại",
    cell: (t) => (
      <span
        className={
          t.slaRisk
            ? "inline-flex items-center gap-1 font-bold text-danger"
            : "text-muted-foreground"
        }
      >
        {t.slaRisk && <AlarmClock className="size-3.5" />} {t.slaLeft}
      </span>
    ),
  },
  { key: "status", header: "Trạng thái", cell: (t) => <StatusBadge status={t.status} /> },
  {
    key: "action",
    header: "",
    align: "right",
    cell: (t) => (
      <Button
        size="sm"
        variant="soft"
        onClick={(e) => {
          e.stopPropagation();
          act(t);
        }}
      >
        <Hand /> {t.status === "Mới" ? "Nhận" : "Chi tiết"}
      </Button>
    ),
  },
];

export function HelpdeskQueuePage() {
  const { queue, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const columns = columnsFor((t) => {
    if (t.status === "Mới")
      void write("/tickets/" + t.id + "/actions", { action: "accept", version: t.version })
        .then(() => toast.success("Đã nhận " + t.id))
        .catch(() => {});
    else actions.openTicket(t.id);
  });
  const [tab, setTab] = useState("new");
  const rows =
    tab === "new"
      ? queue.filter((t) => t.status === "Mới")
      : tab === "risk"
        ? queue.filter((t) => t.slaRisk)
        : queue;

  return (
    <div>
      <PageHeader
        eyebrow="Tiếp nhận"
        title="Tiếp nhận Ticket"
        description="Phân loại, xác định mức ưu tiên và nhận xử lý các yêu cầu mới từ mọi kênh."
      />
      <SectionCard>
        <DataTable
          onRowClick={(t) => actions.openTicket(t.id)}
          columns={columns}
          rows={rows}
          getRowKey={(t) => t.id}
          searchText={(t) => `${t.id} ${t.title} ${t.requester}`}
          searchPlaceholder="Tìm trong hàng đợi..."
          toolbar={
            <PillTabs
              value={tab}
              onChange={setTab}
              tabs={[
                {
                  value: "new",
                  label: "Mới",
                  count: queue.filter((t) => t.status === "Mới").length,
                },
                {
                  value: "risk",
                  label: "Sắp quá hạn",
                  count: queue.filter((t) => t.slaRisk).length,
                },
                { value: "all", label: "Tất cả", count: queue.length },
              ]}
            />
          }
        />
      </SectionCard>
    </div>
  );
}
