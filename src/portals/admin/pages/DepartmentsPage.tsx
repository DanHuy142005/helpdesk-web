import { usePortalData, useActions, useWrite } from "@/shared";
import { Building2, Laptop, Plus, Ticket, Users } from "lucide-react";

import { Button } from "@/shared";
import {
  IconTile,
  PageHeader,
  PillBarChart,
  ProgressBar,
  SectionCard,
  UserAvatar,
  chartColors as c,
} from "@/shared";

export function AdminDepartmentsPage() {
  const { departments, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const chartData = departments.map((d) => ({
    name: d.code,
    nhanVien: d.staff,
    taiSan: d.assets,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Vận hành"
        title="Phòng ban"
        description="Cơ cấu tổ chức, quy mô nhân sự và mức độ sử dụng dịch vụ CNTT của từng phòng ban."
        actions={
          <Button variant="brand" onClick={() => actions.editEntity("departments")}>
            <Plus /> Thêm phòng ban
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => (
          <div
            key={d.code}
            role="button"
            tabIndex={0}
            onClick={() => actions.editEntity("departments", d.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") actions.editEntity("departments", d.id);
            }}
            className="card-surface p-5 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between">
              <IconTile icon={Building2} />
              <span className="rounded-lg bg-surface px-2 py-1 text-[11px] font-bold text-muted-foreground">
                {d.code}
              </span>
            </div>
            <h3 className="mt-4 text-base font-bold">{d.name}</h3>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <UserAvatar name={d.head} className="size-6 rounded-lg text-[9px]" /> Trưởng phòng:{" "}
              <span className="font-semibold text-foreground">{d.head}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center">
              <Stat icon={Users} value={d.staff} label="Nhân sự" />
              <Stat icon={Ticket} value={d.openTickets} label="Ticket mở" />
              <Stat icon={Laptop} value={d.assets} label="Tài sản" />
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground">Mức hài lòng</span>
                <span className="font-bold">{d.satisfaction}%</span>
              </div>
              <ProgressBar value={d.satisfaction} />
            </div>
          </div>
        ))}
      </div>

      <SectionCard title="Nhân sự & tài sản theo phòng ban">
        <PillBarChart
          data={chartData}
          xKey="name"
          stacked={false}
          barSize={14}
          showYAxis
          series={[
            { key: "nhanVien", label: "Nhân sự", color: c.violet },
            { key: "taiSan", label: "Tài sản", color: c.cyan },
          ]}
        />
      </SectionCard>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div>
      <Icon className="mx-auto size-4 text-primary" />
      <p className="mt-1 font-display text-base font-bold">{value}</p>
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
    </div>
  );
}
