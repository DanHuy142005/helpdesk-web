import { usePortalData, useActions, useWrite } from "@/shared";
import { Boxes, Laptop, Plus, ShieldAlert, Wrench } from "lucide-react";

import { Button } from "@/shared";
import {
  Badge,
  DataTable,
  DonutChart,
  KpiCard,
  PageHeader,
  ProgressList,
  SectionCard,
  type Column,
  type Tone,
} from "@/shared";
import { type Asset } from "../data";

const statusTone: Record<Asset["status"], Tone> = {
  "Đang sử dụng": "success",
  "Trong kho": "info",
  "Bảo trì": "warning",
  "Thanh lý": "muted",
};

const columns: Column<Asset>[] = [
  {
    key: "code",
    header: "Mã tài sản",
    cell: (a) => <span className="font-semibold text-primary">{a.code}</span>,
  },
  {
    key: "name",
    header: "Thiết bị",
    cell: (a) => (
      <div className="leading-tight">
        <p className="font-semibold">{a.name}</p>
        <p className="text-xs text-muted-foreground">{a.type}</p>
      </div>
    ),
  },
  { key: "owner", header: "Người sử dụng", cell: (a) => a.owner },
  { key: "department", header: "Phòng ban", cell: (a) => a.department },
  {
    key: "warranty",
    header: "Bảo hành đến",
    cell: (a) => <span className="text-muted-foreground">{a.warranty}</span>,
  },
  {
    key: "status",
    header: "Tình trạng",
    cell: (a) => <Badge tone={statusTone[a.status]}>{a.status}</Badge>,
  },
];

export function AdminAssetsPage() {
  const { assets, assetsByType, locationUsage, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tài nguyên CNTT"
        title="Tài sản CNTT"
        description="Quản lý vòng đời thiết bị phần cứng: cấp phát, bảo trì, bảo hành và thanh lý."
        actions={
          <Button variant="brand" onClick={() => actions.editEntity("assets")}>
            <Plus /> Thêm tài sản
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng thiết bị" value={assets.length} icon={Boxes} />
        <KpiCard
          label="Đang sử dụng"
          value={assets.filter((a) => a.status === "Đang sử dụng").length}
          icon={Laptop}
          tone="success"
        />
        <KpiCard
          label="Đang bảo trì"
          value={assets.filter((a) => a.status === "Bảo trì").length}
          trend="down"
          icon={Wrench}
          tone="warning"
        />
        <KpiCard
          label="Sắp hết bảo hành"
          value={
            workspace.assets.filter(
              (a) =>
                a.warranty &&
                Date.parse(a.warranty) >= Date.now() &&
                Date.parse(a.warranty) <= Date.now() + 30 * 86400000,
            ).length
          }
          trend="down"
          icon={ShieldAlert}
          tone="danger"
        />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard title="Cơ cấu theo loại thiết bị" className="xl:col-span-7">
          <DonutChart
            data={assetsByType}
            centerValue={String(assets.length)}
            centerLabel="Thiết bị"
            size={200}
          />
        </SectionCard>
        <SectionCard title="Tỷ lệ sử dụng theo khu vực" className="xl:col-span-5">
          <ProgressList rows={locationUsage} />
        </SectionCard>
      </div>
      <SectionCard title="Danh sách tài sản">
        <DataTable
          onRowClick={(a) => actions.editEntity("assets", a.id)}
          columns={columns}
          rows={assets}
          getRowKey={(a) => a.code}
          searchText={(a) => `${a.code} ${a.name} ${a.owner} ${a.type}`}
          searchPlaceholder="Tìm mã, tên thiết bị, người dùng..."
          totalLabel="bản ghi"
        />
      </SectionCard>
    </div>
  );
}
