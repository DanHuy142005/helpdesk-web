import { usePortalData, useActions, useWrite } from "@/shared";
import { Mail, Plus, UserCheck, UserMinus, Users, UserX } from "lucide-react";

import { Button } from "@/shared";
import {
  Badge,
  DataTable,
  KpiCard,
  PageHeader,
  SectionCard,
  UserAvatar,
  type Column,
  type Tone,
} from "@/shared";
import { type Employee } from "../data";

const roleTone: Record<Employee["role"], Tone> = {
  Admin: "primary",
  Helpdesk: "info",
  Technician: "cyan",
  "End User": "muted",
};
const statusTone: Record<Employee["status"], Tone> = {
  "Đang làm việc": "success",
  "Tạm khóa": "danger",
};

const columns: Column<Employee>[] = [
  {
    key: "name",
    header: "Nhân viên",
    cell: (e) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={e.name} size="md" />
        <div className="leading-tight">
          <p className="font-semibold">{e.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="size-3" /> {e.email}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "id",
    header: "Mã NV",
    cell: (e) => <span className="text-muted-foreground">{e.id}</span>,
  },
  { key: "department", header: "Phòng ban", cell: (e) => e.department },
  { key: "phone", header: "Số điện thoại", cell: (e) => e.phone || "Chưa liên kết" },
  { key: "position", header: "Chức vụ", cell: (e) => e.position },
  {
    key: "role",
    header: "Vai trò hệ thống",
    cell: (e) => (
      <Badge tone={roleTone[e.role]} dot={false}>
        {e.role}
      </Badge>
    ),
  },
  { key: "devices", header: "Thiết bị", align: "center", cell: (e) => <b>{e.devices}</b> },
  {
    key: "status",
    header: "Trạng thái",
    cell: (e) => <Badge tone={statusTone[e.status]}>{e.status}</Badge>,
  },
];

export function AdminEmployeesPage() {
  const { employees, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  return (
    <div>
      <PageHeader
        eyebrow="Vận hành"
        title="Quản lý nhân viên"
        description="Danh sách nhân sự, vai trò trong hệ thống Helpdesk và thiết bị được cấp."
        actions={
          <Button variant="brand" onClick={() => actions.editEntity("users")}>
            <Plus /> Thêm nhân viên
          </Button>
        }
      />
      <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng nhân viên" value={employees.length} icon={Users} />
        <KpiCard
          label="Đang làm việc"
          value={employees.filter((e) => e.status === "Đang làm việc").length}
          icon={UserCheck}
          tone="success"
        />
        <KpiCard
          label="Thiết bị đang cấp"
          value={workspace.assets.filter((a) => a.owner_id).length}
          trend="flat"
          icon={UserMinus}
          tone="warning"
        />
        <KpiCard
          label="Tạm khóa"
          value={employees.filter((e) => e.status === "Tạm khóa").length}
          trend="down"
          icon={UserX}
          tone="danger"
        />
      </div>
      <SectionCard title="Danh sách nhân viên">
        <DataTable
          onRowClick={(e) => actions.editEntity("users", e.key)}
          columns={columns}
          rows={employees}
          getRowKey={(e) => e.id}
          searchText={(e) => `${e.name} ${e.email} ${e.phone || ""} ${e.department} ${e.position}`}
          searchPlaceholder="Tìm nhân viên..."
          totalLabel="bản ghi"
        />
      </SectionCard>
    </div>
  );
}
