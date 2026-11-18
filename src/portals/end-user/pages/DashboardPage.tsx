import { usePortalData, useActions, useWrite } from "@/shared";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Megaphone,
  PlusCircle,
  Smile,
  Ticket,
} from "lucide-react";

import { Button } from "@/shared";
import { cn } from "@/shared";
import {
  AreaTrendChart,
  DonutChart,
  KpiCard,
  OverviewHero,
  ProgressBar,
  SectionCard,
  StatusBadge,
  chartColors as c,
  toneDot,
} from "@/shared";

export function EndUserDashboardPage() {
  const { announcements, articles, monthlyRequests, myCategories, myTickets, stats, workspace } =
    usePortalData();
  const actions = useActions();
  const write = useWrite();
  const active = myTickets.filter((t) => t.progress < 100);

  return (
    <div className="space-y-5">
      <OverviewHero
        title="Yêu cầu hỗ trợ của bạn"
        subtitle={new Date(workspace.serverTime).toLocaleString("vi-VN")}
        actions={
          <Button variant="brand" size="sm" asChild>
            <Link to="/end-user/new-request">
              <PlusCircle /> Tạo yêu cầu mới
            </Link>
          </Button>
        }
        stats={[
          { value: String(stats.active), label: "Chưa giải quyết" },
          { value: String(stats.waiting), label: "Chờ phản hồi" },
          { value: String(stats.solved), label: "Đã giải quyết" },
          { value: String(stats.response + " phút"), label: "Thời gian chờ TB" },
          { value: String(stats.rating), label: "Bạn đánh giá" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ticket đang mở"
          value={active.length}
          icon={Ticket}
          hint="Dữ liệu hiện tại"
          trend="flat"
        />
        <KpiCard
          label="Giải quyết tháng này"
          value={stats.monthSolved}
          icon={CheckCircle2}
          tone="success"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Phản hồi đầu tiên (phút)"
          value={stats.response}
          icon={Clock3}
          tone="info"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Mức hài lòng"
          value={stats.csat}
          icon={Smile}
          tone="warning"
          hint="Dữ liệu hiện tại"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Yêu cầu đang theo dõi"
          className="xl:col-span-7"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/end-user/tracking">
                Theo dõi <ArrowRight />
              </Link>
            </Button>
          }
        >
          <ul className="space-y-3">
            {active.map((t) => (
              <li
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => actions.openTicket(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") actions.openTicket(t.id);
                }}
                className="rounded-xl border border-border/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary">
                      {t.id} · <span className="text-muted-foreground">{t.category}</span>
                    </p>
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={t.progress} />
                  <span className="shrink-0 text-[11px] text-muted-foreground">{t.assignee}</span>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard
          title="Loại yêu cầu của bạn"
          description="12 tháng gần nhất"
          className="xl:col-span-5"
        >
          <DonutChart data={myCategories} centerValue={String(stats.total)} centerLabel="Yêu cầu" />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard title="Yêu cầu theo tháng" className="xl:col-span-7">
          <AreaTrendChart
            data={monthlyRequests}
            xKey="month"
            height={240}
            series={[
              { key: "daGui", label: "Đã gửi", color: c.primary },
              { key: "daXong", label: "Đã giải quyết", color: c.cyan },
            ]}
          />
        </SectionCard>
        <div className="space-y-5 xl:col-span-5">
          <SectionCard
            title="Thông báo từ phòng CNTT"
            actions={<Megaphone className="size-4 text-primary" />}
          >
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneDot[a.tone])} />
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard
            title="Hướng dẫn phổ biến"
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/end-user/knowledge">
                  Tất cả <ArrowRight />
                </Link>
              </Button>
            }
          >
            <ul className="space-y-2">
              {articles
                .filter((a) => a.popular)
                .map((a) => (
                  <li
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => actions.openDocument(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") actions.openDocument(a.id);
                    }}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface"
                  >
                    <BookOpen className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                    <span className="text-[11px] text-muted-foreground">{a.minutes} phút</span>
                  </li>
                ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
