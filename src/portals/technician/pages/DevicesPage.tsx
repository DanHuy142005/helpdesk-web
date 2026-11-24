import { Badge, PageHeader, useActions, usePortalData } from "@/shared";
import { History, Laptop, MapPin, Monitor, Server } from "lucide-react";

const typeIcon: Record<string, typeof Server> = { "Máy chủ": Server, Laptop: Laptop, PC: Monitor };

export function TechnicianDevicesPage() {
  const { devices } = usePortalData();
  const actions = useActions();
  return (
    <div>
      <PageHeader
        eyebrow="Kết quả & thiết bị"
        title="Thiết bị liên quan"
        description="Tình trạng, bảo hành và lịch sử sự cố của thiết bị gắn với Ticket của bạn."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {devices.map((d) => {
          const Icon = typeIcon[d.type] ?? Monitor;
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
                <Badge tone={d.status === "Bảo trì" ? "warning" : "info"}>{d.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4 text-xs text-muted-foreground">
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
            </article>
          );
        })}
      </div>
    </div>
  );
}
