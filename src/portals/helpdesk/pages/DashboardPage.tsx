import { usePortalData, useActions, useWrite } from "@/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowRightLeft, CheckCheck, Clock3, Inbox, Smile } from "lucide-react";

import { Button } from "@/shared";
import {
  AreaTrendChart,
  Badge,
  DonutChart,
  KpiCard,
  OverviewHero,
  PriorityBadge,
  ProgressBar,
  SectionCard,
  UserAvatar,
  chartColors as c,
} from "@/shared";

export function HelpdeskDashboardPage() {
  const { channels, hourly, queue, technicians, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  return (
    <div className="space-y-5">
      <OverviewHero
        title="Ca trực hôm nay"
        subtitle={new Date(workspace.serverTime).toLocaleDateString("vi-VN")}
        actions={
          <Button variant="brand" size="sm" asChild>
            <Link to="/helpdesk/queue">
              Tiếp nhận ngay <ArrowRight />
            </Link>
          </Button>
        }
        stats={[
          { value: String(stats.new), label: "Ticket mới" },
          { value: String(stats.processing), label: "Đang xử lý" },
          { value: String(stats.solved), label: "Đã giải quyết" },
          { value: String(stats.escalated), label: "Đã chuyển Technician" },
          { value: String(stats.rating), label: "Đánh giá" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Chờ tiếp nhận"
          value={stats.new}
          trend="down"
          icon={Inbox}
          tone="info"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Thời gian phản hồi (phút)"
          value={stats.response}
          icon={Clock3}
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Giải quyết tuyến 1"
          value={
            workspace.tickets.filter(
              (t) =>
                t.assignee_id === workspace.user.id &&
                ["Đã đóng", "Đã giải quyết"].includes(t.status),
            ).length
          }
          icon={CheckCheck}
          tone="success"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Hài lòng"
          value={stats.csat}
          icon={Smile}
          tone="warning"
          hint="Dữ liệu hiện tại"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Lưu lượng Ticket theo giờ"
          description="Tiếp nhận so với đã xử lý"
          className="xl:col-span-8"
        >
          <AreaTrendChart
            data={hourly}
            xKey="hour"
            series={[
              { key: "tiepNhan", label: "Tiếp nhận", color: c.blue },
              { key: "xuLy", label: "Đã xử lý", color: c.cyan },
            ]}
          />
        </SectionCard>
        <SectionCard title="Kênh tiếp nhận" className="xl:col-span-4">
          <DonutChart
            data={channels}
            layout="column"
            size={180}
            centerValue={String(stats.total)}
            centerLabel="Ticket"
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Ticket chờ tiếp nhận"
          className="xl:col-span-7"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/helpdesk/queue">
                Xem tất cả <ArrowRight />
              </Link>
            </Button>
          }
        >
          <ul className="space-y-2">
            {queue
              .filter((t) => t.status === "Mới")
              .slice(0, 5)
              .map((t) => (
                <li
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => actions.openTicket(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") actions.openTicket(t.id);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:bg-surface"
                >
                  <UserAvatar name={t.requester} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.id} · {t.requester} · {t.channel}
                    </p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                  <span
                    className={
                      t.slaRisk ? "text-xs font-bold text-danger" : "text-xs text-muted-foreground"
                    }
                  >
                    {t.slaLeft}
                  </span>
                </li>
              ))}
          </ul>
        </SectionCard>
        <SectionCard
          title="Technician sẵn sàng"
          className="xl:col-span-5"
          actions={
            <Button variant="soft" size="sm" asChild>
              <Link to="/helpdesk/escalate">
                <ArrowRightLeft /> Chuyển Ticket
              </Link>
            </Button>
          }
        >
          <ul className="space-y-4">
            {technicians.map((t) => (
              <li key={t.name} className="flex items-center gap-3">
                <UserAvatar name={t.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <Badge
                      tone={
                        t.status === "Sẵn sàng"
                          ? "success"
                          : t.status === "Bận"
                            ? "warning"
                            : "muted"
                      }
                      className="px-2 py-0.5 text-[11px]"
                    >
                      {t.status}
                    </Badge>
                  </div>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">{t.skill}</p>
                  <ProgressBar
                    value={t.load}
                    tone={t.load > 80 ? "danger" : t.load > 60 ? "warning" : "primary"}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
