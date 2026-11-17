import { usePortalData, useActions, useWrite } from "@/shared";
import {
  CheckCircle2,
  CircleDot,
  Download,
  FolderOpen,
  Hourglass,
  Inbox,
  Lock,
  Ticket,
} from "lucide-react";

import { Button } from "@/shared";
import {
  ChartLegendStats,
  DataTable,
  DonutChart,
  KpiCard,
  OverviewHero,
  PillBarChart,
  SectionCard,
  SegmentRing,
  chartColors as c,
} from "@/shared";
import { ticketColumns } from "../columns";

export function AdminDashboardPage() {
  const actions = useActions();
  const { monthlyTickets, tickets, ticketsByCategory, ticketsByDepartment, stats, workspace } =
    usePortalData({ from: actions.from, to: actions.to });
  const write = useWrite();
  return (
    <div className="space-y-5">
      <OverviewHero
        title="Tổng quan nhanh"
        subtitle="Toàn bộ số liệu vận hành Helpdesk của doanh nghiệp"
        stats={[
          { value: String(stats.total), label: "Tổng Ticket" },
          { value: String(stats.users), label: "Nhân viên" },
          { value: String(stats.departments), label: "Phòng ban" },
          { value: String(stats.assets), label: "Tài sản CNTT" },
          { value: String(stats.views), label: "Lượt xem tài liệu" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard title="Ticket theo phòng ban" className="xl:col-span-5">
          <DonutChart data={ticketsByDepartment} size={190} />
        </SectionCard>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:col-span-7">
          <KpiCard label="Tổng Ticket tháng này" value={stats.month} icon={Ticket} />
          <KpiCard
            label="Đang chờ xử lý"
            value={stats.new}
            trend="down"
            icon={Hourglass}
            tone="warning"
          />
          <KpiCard
            label="Đã giải quyết"
            value={stats.resolved}
            icon={CheckCircle2}
            tone="success"
          />
          <KpiCard label="Đã đóng" value={stats.closed} trend="flat" icon={Lock} tone="info" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Ticket theo tháng"
          description="12 tháng gần nhất"
          className="xl:col-span-7"
        >
          <PillBarChart
            data={monthlyTickets}
            xKey="month"
            series={[
              { key: "daGiaiQuyet", label: "Đã giải quyết", color: c.green },
              { key: "dangXuLy", label: "Đang xử lý", color: c.violet },
              { key: "moi", label: "Mới", color: c.orange },
            ]}
          />
          <ChartLegendStats
            items={[
              { label: "Tổng Ticket", value: String(stats.total), color: c.green, icon: Inbox },
              { label: "Đang mở", value: String(stats.active), color: c.violet, icon: CircleDot },
              { label: "Ticket mới", value: String(stats.new), color: c.orange, icon: FolderOpen },
            ]}
          />
        </SectionCard>
        <SectionCard title="Ticket theo danh mục" className="xl:col-span-5">
          <SegmentRing
            data={ticketsByCategory}
            centerValue={String(stats.total)}
            centerLabel="Ticket"
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Ticket gần đây"
        actions={
          <>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Tải xuống"
              onClick={() => actions.exportReport()}
            >
              <Download />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.openPanel({ type: "report" })}
            >
              Tất cả thời gian
            </Button>
          </>
        }
      >
        <DataTable
          onRowClick={(t) => actions.openTicket(t.id)}
          columns={ticketColumns}
          rows={tickets.slice(0, 6)}
          getRowKey={(t) => t.id}
        />
      </SectionCard>
    </div>
  );
}
