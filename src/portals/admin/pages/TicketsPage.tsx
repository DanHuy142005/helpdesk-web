import { usePortalData, useActions, useWrite } from "@/shared";
import { AlarmClock, CheckCircle2, Filter, Inbox, Plus, Ticket } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared";
import { DataTable, KpiCard, PageHeader, PillTabs, SectionCard } from "@/shared";
import { ticketColumns } from "../columns";

export function AdminTicketsPage() {
  const { tickets, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const [tab, setTab] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priority, setPriority] = useState(""),
    [assignee, setAssignee] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const baseRows =
    tab === "all"
      ? tickets
      : tab === "open"
        ? tickets.filter((t) =>
            ["Mới", "Đang xử lý", "Chờ phản hồi", "Đã chuyển"].includes(t.status),
          )
        : tickets.filter((t) => ["Đã giải quyết", "Đã đóng"].includes(t.status));
  const rows = baseRows.filter(
    (t) =>
      (!priority || t.priority === priority) &&
      (!assignee || t.assignee_id === assignee) &&
      (!from || t.created_at.slice(0, 10) >= from) &&
      (!to || t.created_at.slice(0, 10) <= to),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Vận hành"
        title="Quản lý Ticket"
        description="Theo dõi toàn bộ yêu cầu hỗ trợ, mức ưu tiên và người phụ trách."
        actions={
          <>
            <Button variant="outline" onClick={() => setFiltersOpen((v) => !v)}>
              <Filter /> Bộ lọc
            </Button>
            <Button variant="brand" onClick={() => actions.newTicket()}>
              <Plus /> Tạo Ticket
            </Button>
          </>
        }
      />
      <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng Ticket" value={stats.total} icon={Ticket} />
        <KpiCard label="Đang mở" value={stats.active} trend="down" icon={Inbox} tone="info" />
        <KpiCard
          label="Quá hạn SLA"
          value={
            workspace.tickets.filter(
              (t) =>
                !["Đã đóng", "Đã giải quyết"].includes(t.status) &&
                Date.parse(t.due_at) < Date.now(),
            ).length
          }
          trend="down"
          icon={AlarmClock}
          tone="danger"
        />
        <KpiCard label="Đã giải quyết" value={stats.resolved} icon={CheckCircle2} tone="success" />
      </div>
      <SectionCard>
        {filtersOpen && (
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <select
              aria-label="Lọc ưu tiên"
              className="field"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">Mọi mức ưu tiên</option>
              {["Khẩn cấp", "Cao", "Trung bình", "Thấp"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              aria-label="Lọc người xử lý"
              className="field"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Mọi người xử lý</option>
              {workspace.users
                .filter((u) => ["helpdesk", "technician"].includes(u.role))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <input
              aria-label="Từ ngày"
              type="date"
              className="field"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              aria-label="Đến ngày"
              type="date"
              className="field"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        )}
        <DataTable
          onRowClick={(t) => actions.openTicket(t.id)}
          columns={ticketColumns}
          rows={rows}
          getRowKey={(t) => t.id}
          searchText={(t) => `${t.id} ${t.title} ${t.requester} ${t.category}`}
          searchPlaceholder="Tìm theo mã, tiêu đề, người yêu cầu..."
          totalLabel="bản ghi"
          toolbar={
            <PillTabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "all", label: "Tất cả", count: tickets.length },
                { value: "open", label: "Đang mở", count: stats.active },
                { value: "done", label: "Hoàn tất", count: stats.solved },
              ]}
            />
          }
        />
      </SectionCard>
    </div>
  );
}
