import { usePortalData, useActions, useWrite } from "@/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardList, Gauge, MapPin, Timer } from "lucide-react";

import { Button } from "@/shared";
import { cn } from "@/shared";
import {
  KpiCard,
  OverviewHero,
  PillBarChart,
  PriorityBadge,
  ProgressBar,
  SectionCard,
  SegmentRing,
  chartColors as c,
  toneDot,
} from "@/shared";

export function TechnicianDashboardPage() {
  const { jobs, schedule, weekly, resultCategories, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  return (
    <div className="space-y-5">
      <OverviewHero
        title="Công việc của bạn"
        subtitle="Tổng hợp theo thời gian thực · cập nhật 1 phút trước"
        actions={
          <Button variant="brand" size="sm" asChild>
            <Link to="/technician/assigned">
              Xem công việc <ArrowRight />
            </Link>
          </Button>
        }
        stats={[
          { value: String(stats.active), label: "Được giao" },
          { value: String(stats.processing), label: "Đang xử lý" },
          { value: String(stats.solved), label: "Đã hoàn thành" },
          { value: String(stats.duration + " phút"), label: "Thời gian xử lý TB" },
          { value: String(stats.rating), label: "Đánh giá" },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Việc được giao"
          value={stats.active}
          icon={ClipboardList}
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Hoàn thành tuần"
          value={stats.weekSolved}
          icon={CheckCircle2}
          tone="success"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Đúng hạn SLA"
          value={stats.sla + "%"}
          icon={Gauge}
          tone="info"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Thời gian xử lý (phút)"
          value={stats.duration}
          icon={Timer}
          tone="warning"
          hint="Dữ liệu hiện tại"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard title="Khối lượng công việc trong tuần" className="xl:col-span-8">
          <PillBarChart
            data={weekly}
            xKey="day"
            barSize={14}
            series={[
              { key: "hoanThanh", label: "Hoàn thành", color: c.cyan },
              { key: "dangXuLy", label: "Đang xử lý", color: c.blue },
              { key: "moi", label: "Mới", color: c.violet },
            ]}
          />
        </SectionCard>
        <SectionCard title="Lịch hôm nay" className="xl:col-span-4">
          <ol className="space-y-3">
            {schedule.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-xl border border-border/70 p-3">
                <div className="w-12 shrink-0 text-center">
                  <p className="font-display text-sm font-bold">{s.time}</p>
                  <span
                    className={cn("mx-auto mt-1 block h-6 w-1 rounded-full", toneDot[s.tone])}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {s.place}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Ưu tiên xử lý"
          description="Sắp xếp theo mức độ & SLA"
          className="xl:col-span-7"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/technician/assigned">
                Tất cả <ArrowRight />
              </Link>
            </Button>
          }
        >
          <ul className="space-y-3">
            {jobs.slice(0, 4).map((j) => (
              <li
                key={j.id}
                role="button"
                tabIndex={0}
                onClick={() => actions.openTicket(j.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") actions.openTicket(j.id);
                }}
                className="rounded-xl border border-border/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary">
                      {j.id} · <span className="text-muted-foreground">{j.device}</span>
                    </p>
                    <p className="truncate text-sm font-semibold">{j.title}</p>
                  </div>
                  <PriorityBadge priority={j.priority} />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar
                    value={j.slaPct}
                    tone={j.slaPct > 80 ? "danger" : j.slaPct > 50 ? "warning" : "primary"}
                  />
                  <span className="shrink-0 text-[11px] text-muted-foreground">Hạn {j.due}</span>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Phân loại sự cố đã xử lý" className="xl:col-span-5">
          <SegmentRing
            centerValue={String(stats.solved)}
            centerLabel="Ticket đã xử lý"
            data={resultCategories.map((c) => ({ ...c, change: "", trend: "up" as const }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
