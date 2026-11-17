import { usePortalData, useActions, useWrite } from "@/shared";
import {
  Cpu,
  HardDrive,
  History,
  Laptop,
  MapPin,
  MemoryStick,
  Monitor,
  Server,
} from "lucide-react";

import { Badge, PageHeader, ProgressBar, type Tone } from "@/shared";

const typeIcon: Record<string, typeof Server> = { "Máy chủ": Server, Laptop: Laptop, PC: Monitor };

export function TechnicianDevicesPage() {
  const { devices, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  return (
    <div>
      <PageHeader
        eyebrow="Kết quả & thiết bị"
        title="Thiết bị liên quan"
        description="Thông tin cấu hình, tình trạng và lịch sử sự cố của thiết bị gắn với Ticket của bạn."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {devices.map((d) => {
          const Icon = typeIcon[d.type] ?? Monitor;
          const tone: Tone = d.health < 50 ? "danger" : d.health < 70 ? "warning" : "success";
          return (
            <article key={d.code} className="card-surface overflow-hidden">
              <div className="flex items-center gap-4 bg-hero p-5">
                <span className="grid size-14 place-items-center rounded-2xl bg-card text-primary shadow-soft">
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary">{d.code}</p>
                  <h3 className="truncate text-base font-bold">{d.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {d.location} · {d.owner}
                  </p>
                </div>
                <Badge tone={tone}>{d.health}%</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5 text-sm">
                <Spec icon={Cpu} label="CPU" value={d.cpu} />
                <Spec icon={MemoryStick} label="RAM" value={d.ram} />
                <Spec icon={HardDrive} label="Lưu trữ" value={d.storage} />
                <Spec icon={Monitor} label="Hệ điều hành" value={d.os} />
              </div>
              <div className="border-t border-border px-5 py-4">
                <ProgressBar value={d.health} tone={tone} />
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <History className="size-3.5" /> {d.tickets} sự cố · gần nhất{" "}
                    <button
                      className="text-primary underline"
                      disabled={!d.tickets}
                      onClick={() => actions.openTicket(d.lastTicket)}
                    >
                      {d.lastTicket}
                    </button>
                  </span>
                  <span>Bảo hành đến {d.warranty}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-0.5 truncate font-semibold">{value}</p>
    </div>
  );
}
