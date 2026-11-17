import { usePortalData, useActions, useWrite } from "@/shared";
import { AppWindow, CalendarClock, KeyRound, Plus, ShieldCheck } from "lucide-react";

import { Button } from "@/shared";
import {
  Badge,
  DataTable,
  IconTile,
  KpiCard,
  PageHeader,
  ProgressBar,
  SectionCard,
  type Column,
} from "@/shared";
import { type SoftwareLicense } from "../data";

const columns: Column<SoftwareLicense>[] = [
  {
    key: "name",
    header: "Phần mềm",
    cell: (s) => (
      <div className="flex items-center gap-3">
        <IconTile icon={AppWindow} size="sm" />
        <div className="leading-tight">
          <p className="font-semibold">{s.name}</p>
          <p className="text-xs text-muted-foreground">
            {s.vendor} · v{s.version}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "type",
    header: "Loại license",
    cell: (s) => (
      <Badge
        tone={s.type === "Thuê bao" ? "info" : s.type === "Vĩnh viễn" ? "primary" : "success"}
        dot={false}
      >
        {s.type}
      </Badge>
    ),
  },
  {
    key: "usage",
    header: "Sử dụng",
    cell: (s) => {
      const pct = Math.round((s.used / s.total) * 100);
      return (
        <div className="w-40">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold">
              {s.used}/{s.total}
            </span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <ProgressBar value={pct} tone={pct > 95 ? "danger" : pct > 85 ? "warning" : "primary"} />
        </div>
      );
    },
  },
  {
    key: "expires",
    header: "Hết hạn",
    cell: (s) => <span className="text-muted-foreground">{s.expires}</span>,
  },
];

export function AdminSoftwarePage() {
  const { software, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tài nguyên CNTT"
        title="Phần mềm & License"
        description="Theo dõi bản quyền, số lượng license đã cấp và lịch gia hạn."
        actions={
          <Button variant="brand" onClick={() => actions.editEntity("software")}>
            <Plus /> Thêm phần mềm
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Phần mềm quản lý" value={software.length} icon={AppWindow} />
        <KpiCard
          label="License đang cấp"
          value={software.reduce((n, s) => n + s.used, 0)}
          icon={KeyRound}
          tone="info"
        />
        <KpiCard
          label="Sắp hết hạn (30 ngày)"
          value={
            workspace.software.filter(
              (s) =>
                s.expires &&
                Date.parse(s.expires) >= Date.now() &&
                Date.parse(s.expires) <= Date.now() + 30 * 86400000,
            ).length
          }
          trend="down"
          icon={CalendarClock}
          tone="warning"
        />
        <KpiCard
          label="Tuân thủ bản quyền"
          value={
            (software.length
              ? Math.round(
                  (workspace.software.filter(
                    (s) =>
                      s.used <= s.seats &&
                      (!s.used ||
                        !s.expires ||
                        Date.parse(s.expires) >= new Date().setHours(0, 0, 0, 0)),
                  ).length /
                    software.length) *
                    100,
                )
              : 0) + "%"
          }
          icon={ShieldCheck}
          tone="success"
        />
      </div>
      <SectionCard title="Danh mục phần mềm">
        <DataTable
          onRowClick={(s) => actions.editEntity("software", s.id)}
          columns={columns}
          rows={software}
          getRowKey={(s) => s.name}
          searchText={(s) => `${s.name} ${s.vendor}`}
          searchPlaceholder="Tìm phần mềm, nhà cung cấp..."
          totalLabel="bản ghi"
        />
      </SectionCard>
    </div>
  );
}
