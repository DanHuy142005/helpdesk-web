import { usePortalData, useActions, useWrite } from "@/shared";
import { CalendarRange, Clock, Download, Gauge, Smile, Timer } from "lucide-react";

import { Button } from "@/shared";
import {
  AreaTrendChart,
  DonutChart,
  KpiCard,
  PageHeader,
  PillBarChart,
  ProgressList,
  SectionCard,
  chartColors as c,
} from "@/shared";

export function AdminReportsPage() {
  const actions = useActions();
  const { slaTrend, technicianPerformance, priorities, categorySla, stats, workspace } =
    usePortalData({ from: actions.from, to: actions.to });
  const write = useWrite();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tổng quan"
        title="Báo cáo & phân tích"
        description="Hiệu suất xử lý, mức độ tuân thủ SLA và mức độ hài lòng của người dùng."
        actions={
          <>
            <Button variant="outline" onClick={() => actions.openPanel({ type: "report" })}>
              <CalendarRange /> Kỳ báo cáo
            </Button>
            <Button variant="brand" onClick={() => actions.exportReport()}>
              <Download /> Xuất báo cáo
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Thời gian phản hồi TB (phút)"
          value={stats.response}
          icon={Clock}
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Thời gian xử lý TB"
          value={stats.duration + " phút"}
          icon={Timer}
          tone="info"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Tuân thủ SLA"
          value={stats.sla + "%"}
          icon={Gauge}
          tone="success"
          hint="Dữ liệu hiện tại"
        />
        <KpiCard
          label="Mức hài lòng (CSAT)"
          value={stats.rating + "/5"}
          icon={Smile}
          tone="warning"
          hint="Dữ liệu hiện tại"
        />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Xu hướng thời gian phản hồi & xử lý"
          description="Đơn vị: phút"
          className="xl:col-span-8"
        >
          <AreaTrendChart
            data={slaTrend}
            xKey="week"
            series={[
              { key: "xuLy", label: "Xử lý", color: c.violet },
              { key: "phanHoi", label: "Phản hồi", color: c.cyan },
            ]}
          />
        </SectionCard>
        <SectionCard title="Ticket theo mức ưu tiên" className="xl:col-span-4">
          <DonutChart
            layout="column"
            size={180}
            centerValue={String(stats.total)}
            centerLabel="Trong kỳ"
            data={priorities}
          />
        </SectionCard>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard title="Hiệu suất Technician" className="xl:col-span-7">
          <PillBarChart
            data={technicianPerformance}
            xKey="name"
            barSize={16}
            showYAxis
            series={[
              { key: "hoanThanh", label: "Hoàn thành", color: c.blue },
              { key: "dangXuLy", label: "Đang xử lý", color: c.orange },
            ]}
          />
        </SectionCard>
        <SectionCard title="SLA theo danh mục" className="xl:col-span-5">
          <ProgressList rows={categorySla} />
        </SectionCard>
      </div>
    </div>
  );
}
