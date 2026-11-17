import { usePortalData, useActions, useWrite } from "@/shared";
import { Star } from "lucide-react";

import { cn } from "@/shared";
import {
  DataTable,
  DonutChart,
  PageHeader,
  ProgressList,
  SectionCard,
  StatusBadge,
  type Column,
} from "@/shared";
import { type Result } from "../data";

const columns: Column<Result>[] = [
  {
    key: "id",
    header: "Mã",
    cell: (r) => <span className="font-semibold text-primary">{r.id}</span>,
  },
  {
    key: "title",
    header: "Sự cố / Giải pháp",
    cell: (r) => (
      <div className="max-w-[320px]">
        <p className="truncate font-semibold">{r.title}</p>
        <p className="truncate text-xs text-muted-foreground">{r.solution}</p>
      </div>
    ),
  },
  { key: "duration", header: "Thời gian", cell: (r) => r.duration },
  {
    key: "closedAt",
    header: "Hoàn tất",
    cell: (r) => <span className="text-muted-foreground">{r.closedAt}</span>,
  },
  {
    key: "rating",
    header: "Đánh giá",
    cell: (r) => (
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn("size-3.5", i <= r.rating ? "fill-warning text-warning" : "text-border")}
          />
        ))}
      </span>
    ),
  },
  { key: "status", header: "Trạng thái", cell: (r) => <StatusBadge status={r.status} /> },
];

export function TechnicianResultsPage() {
  const { resultCategories, results, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Kết quả & thiết bị"
        title="Kết quả xử lý"
        description="Lịch sử Ticket đã hoàn tất, giải pháp áp dụng và đánh giá từ người dùng."
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard title="Theo loại sự cố" className="xl:col-span-5">
          <DonutChart
            data={resultCategories}
            centerValue={String(results.length)}
            centerLabel="Đã hoàn tất"
            size={180}
          />
        </SectionCard>
        <SectionCard title="Chỉ số chất lượng" className="xl:col-span-7">
          <ProgressList
            rows={[
              {
                label: "Tỷ lệ hoàn tất",
                value: stats.total ? Math.round((stats.solved / stats.total) * 100) : 0,
                tone: "success",
              },
              { label: "Đúng hạn SLA", value: stats.sla, tone: "primary" },
              {
                label: "Đã xác nhận đóng",
                value: results.length
                  ? Math.round(
                      (results.filter((t) => t.status === "Đã đóng").length / results.length) * 100,
                    )
                  : 0,
                tone: "info",
              },
              {
                label: "Đánh giá 5 sao",
                value: results.filter((t) => t.rating > 0).length
                  ? Math.round(
                      (results.filter((t) => t.rating === 5).length /
                        results.filter((t) => t.rating > 0).length) *
                        100,
                    )
                  : 0,
                tone: "warning",
              },
            ]}
          />
        </SectionCard>
      </div>
      <SectionCard title="Ticket đã hoàn tất">
        <DataTable
          onRowClick={(t) => actions.openTicket(t.id)}
          columns={columns}
          rows={results}
          getRowKey={(r) => r.id}
          searchText={(r) => `${r.id} ${r.title} ${r.solution}`}
          searchPlaceholder="Tìm theo sự cố, giải pháp..."
          totalLabel="bản ghi"
        />
      </SectionCard>
    </div>
  );
}
