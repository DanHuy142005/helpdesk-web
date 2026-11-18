import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import {
  api,
  useWrite,
  useWorkspace,
  useActions,
  PageHeader,
  SectionCard,
  KpiCard,
  DataTable,
  PriorityBadge,
  StatusBadge,
  Field,
  Button,
  isOverdue,
  isResolvedLate,
  type ApiTicket,
  type TicketPolicy,
  type Column,
} from "@/shared";

const columns: Column<ApiTicket>[] = [
  {
    key: "ticket",
    header: "Yêu cầu",
    cell: (t) => (
      <div>
        <b className="text-primary">{t.id}</b>
        <p className="mt-1 max-w-xs truncate">{t.title}</p>
        <p className="text-xs text-muted-foreground">{t.requester}</p>
      </div>
    ),
  },
  {
    key: "priority",
    header: "Mức ưu tiên",
    cell: (t) => (
      <div>
        <PriorityBadge priority={t.priority} />
        {!t.classified_by && <p className="mt-1 text-xs text-muted-foreground">Chờ Admin duyệt</p>}
      </div>
    ),
  },
  { key: "assignee", header: "Người xử lý", cell: (t) => t.assignee || "Chưa phân công" },
  { key: "status", header: "Trạng thái", cell: (t) => <StatusBadge status={t.status} /> },
  { key: "due", header: "Hạn SLA", cell: (t) => new Date(t.due_at).toLocaleString("vi-VN") },
  {
    key: "auto",
    header: "Thời điểm tự đóng",
    cell: (t) =>
      t.closed_automatically && t.closed_at
        ? new Date(t.closed_at).toLocaleString("vi-VN")
        : t.auto_close_at
          ? new Date(t.auto_close_at).toLocaleString("vi-VN")
          : "—",
  },
];
function PolicyForm({ policy, saved }: { policy: TicketPolicy; saved: () => void }) {
  const write = useWrite(),
    [pending, setPending] = useState(false),
    [enabled, setEnabled] = useState(policy.autoCloseEnabled);
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        try {
          await write(
            "/settings/tickets",
            {
              autoCloseEnabled: enabled,
              autoCloseMinutes: Number(form.get("duration")) * Number(form.get("unit")),
              version: policy.version,
            },
            "PUT",
          );
          saved();
          toast.success("Đã lưu chính sách Ticket.");
        } catch {
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-4 accent-primary"
        />
        Tự động đóng khi End User chưa xác nhận
      </label>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <Field label="Thời gian chờ">
          <input
            name="duration"
            aria-label="Thời gian chờ"
            type="number"
            min={1}
            max={525600}
            step={1}
            required
            defaultValue={policy.autoCloseMinutes}
            className="field"
          />
        </Field>
        <Field label="Đơn vị">
          <select name="unit" aria-label="Đơn vị thời gian" defaultValue="1" className="field">
            <option value="1">Phút</option>
            <option value="60">Giờ</option>
            <option value="1440">Ngày</option>
          </select>
        </Field>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Thời gian tính từ lúc Helpdesk hoặc Technician xác nhận đã giải quyết. Cấu hình áp dụng cho
        cả yêu cầu đang chờ xác nhận. End User có thể yêu cầu xử lý tiếp trước thời điểm tự đóng. Hệ
        thống kiểm tra mỗi 15 giây khi máy chủ đang chạy.
      </p>
      <Button variant="brand" disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu cấu hình"}
      </Button>
    </form>
  );
}
export function AdminSlaPage() {
  const { data } = useWorkspace(),
    actions = useActions(),
    [tab, setTab] = useState("overdue");
  const policy = useQuery({
    queryKey: ["ticket-policy"],
    queryFn: () => api<TicketPolicy>("/settings/tickets"),
    refetchOnWindowFocus: true,
  });
  if (!data) return null;
  const groups = [
    {
      id: "overdue",
      label: "Đang quá hạn SLA",
      tickets: data.tickets.filter((t) => isOverdue(t, data.serverTime)),
      icon: TriangleAlert,
      tone: "danger" as const,
    },
    {
      id: "late",
      label: "Đã xử lý trễ hạn",
      tickets: data.tickets.filter(isResolvedLate),
      icon: Clock3,
      tone: "warning" as const,
    },
    {
      id: "waiting",
      label: "Chờ xác nhận đóng",
      tickets: data.tickets.filter((t) => t.status === "Đã giải quyết"),
      icon: AlarmClock,
      tone: "primary" as const,
    },
    {
      id: "closed",
      label: "Đã tự động đóng",
      tickets: data.tickets.filter((t) => t.closed_automatically),
      icon: CheckCircle2,
      tone: "success" as const,
    },
  ];
  const chosen = groups.find((group) => group.id === tab)!;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Vận hành"
        title="SLA & tự đóng Ticket"
        description="Theo dõi yêu cầu quá hạn, mở Ticket để phân loại hoặc điều phối người xử lý và cấu hình thời gian chờ xác nhận."
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <KpiCard
            key={group.id}
            label={group.label}
            value={group.tickets.length}
            icon={group.icon}
            tone={group.tone}
          />
        ))}
      </div>
      <SectionCard title="Theo dõi thời hạn">
        <div role="tablist" aria-label="Nhóm Ticket SLA" className="mb-4 flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              role="tab"
              aria-selected={tab === group.id}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === group.id ? "bg-primary text-white" : "bg-surface text-muted-foreground"}`}
              onClick={() => setTab(group.id)}
            >
              {group.label} ({group.tickets.length})
            </button>
          ))}
        </div>
        <DataTable
          columns={columns}
          rows={[...chosen.tickets].sort((a, b) => a.due_at.localeCompare(b.due_at))}
          getRowKey={(t) => t.id}
          searchText={(t) => `${t.id} ${t.title} ${t.requester} ${t.assignee || ""}`}
          onRowClick={(t) => actions.openTicket(t.id)}
          totalLabel="Ticket"
        />
      </SectionCard>
      <SectionCard
        title="Chính sách tự động đóng"
        description="Chỉ Admin được thay đổi cấu hình này."
      >
        {policy.error ? (
          <p role="alert" className="text-danger">
            {policy.error.message}
          </p>
        ) : policy.data ? (
          <PolicyForm
            key={policy.data.version}
            policy={policy.data}
            saved={() => void policy.refetch()}
          />
        ) : (
          <p>Đang tải cấu hình…</p>
        )}
      </SectionCard>
    </div>
  );
}
