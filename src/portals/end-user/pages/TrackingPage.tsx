import { usePortalData, useActions, useWrite } from "@/shared";
import { Check, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { api, type TicketDetail } from "@/shared";

import { Button } from "@/shared";
import { cn } from "@/shared";
import {
  PageHeader,
  PriorityBadge,
  ProgressBar,
  SectionCard,
  StatusBadge,
  UserAvatar,
} from "@/shared";

export function EndUserTrackingPage() {
  const { myTickets, timelines, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const list = myTickets.filter((t) => timelines[t.id]);
  const [selectedId, setSelectedId] = useState(list[0]?.id || "");
  const ticket = list.find((t) => t.id === selectedId) ?? list[0];
  const details = useQuery({
    queryKey: ["ticket", ticket?.id],
    queryFn: () => api<TicketDetail>("/tickets/" + ticket!.id),
    enabled: !!ticket,
    refetchInterval: 3000,
  });
  const steps = ticket ? (timelines[ticket.id] ?? []) : [];
  const chat = (details.data?.comments || []).map((c) => ({
    from: c.author,
    me: c.author_id === workspace.user.id,
    time: new Date(c.created_at).toLocaleTimeString("vi-VN"),
    text: c.body,
  }));
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  if (!ticket)
    return <SectionCard title="Theo dõi trạng thái">Bạn chưa gửi yêu cầu hỗ trợ.</SectionCard>;

  return (
    <div>
      <PageHeader
        eyebrow="Cá nhân"
        title="Theo dõi trạng thái"
        description="Xem từng bước xử lý và trao đổi trực tiếp với người hỗ trợ."
        actions={
          <Button variant="brand" onClick={() => actions.openTicket(ticket.id)}>
            Chi tiết / xác nhận kết quả
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Yêu cầu đang mở"
          description={`${list.length} Ticket`}
          className="xl:col-span-4"
        >
          <ul className="space-y-2">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all",
                    t.id === ticket.id
                      ? "border-primary/30 bg-primary-soft shadow-soft"
                      : "border-border/70 hover:bg-surface",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{t.id}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold">{t.title}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={t.progress} />
                    <span className="text-[11px] text-muted-foreground">{t.progress}%</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-5 xl:col-span-8">
          <SectionCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-primary">{ticket.id}</p>
                <h2 className="mt-1 font-display text-xl font-bold">{ticket.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                  <span className="text-xs text-muted-foreground">Gửi lúc {ticket.createdAt}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface p-2 pr-4">
                <UserAvatar name={ticket.assignee} size="md" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{ticket.assignee}</p>
                  <p className="text-xs text-muted-foreground">Người phụ trách</p>
                </div>
              </div>
            </div>

            <ol className="mt-6 grid gap-4 sm:grid-cols-5">
              {steps.map((s, i) => (
                <li key={i} className="relative">
                  {i < steps.length - 1 && (
                    <span
                      className={cn(
                        "absolute left-8 top-4 hidden h-0.5 w-[calc(100%-1rem)] sm:block",
                        s.state === "done" ? "bg-brand" : "bg-border",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative grid size-8 place-items-center rounded-full text-xs font-bold",
                      s.state === "done" && "bg-brand text-primary-foreground shadow-glow",
                      s.state === "current" &&
                        "bg-card text-primary ring-4 ring-primary/20 border-2 border-primary",
                      s.state === "todo" && "bg-surface text-muted-foreground",
                    )}
                  >
                    {s.state === "done" ? <Check className="size-4" /> : i + 1}
                  </span>
                  <p
                    className={cn(
                      "mt-2 text-sm font-semibold",
                      s.state === "todo" && "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  {s.time && (
                    <p className="text-[11px] text-muted-foreground">
                      {s.time} · {s.by}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <SectionCard title="Nhật ký xử lý" className="lg:col-span-2">
              <ul className="space-y-4 border-l border-border pl-4">
                {steps
                  .filter((s) => s.state !== "todo")
                  .reverse()
                  .map((s) => (
                    <li key={s.label} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[21px] top-1 size-2.5 rounded-full",
                          s.state === "current"
                            ? "bg-primary ring-4 ring-primary/20"
                            : "bg-success",
                        )}
                      />
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.time} · {s.by}
                      </p>
                      {s.note && <p className="mt-1 text-xs text-foreground/80">{s.note}</p>}
                    </li>
                  ))}
              </ul>
            </SectionCard>

            <SectionCard title="Trao đổi" className="lg:col-span-3">
              <ul className="space-y-3">
                {chat.map((m, i) => (
                  <li key={i} className={cn("flex gap-2", m.me && "flex-row-reverse")}>
                    {!m.me && <UserAvatar name={m.from} />}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm",
                        m.me
                          ? "rounded-tr-sm bg-brand text-primary-foreground"
                          : "rounded-tl-sm bg-surface",
                      )}
                    >
                      <p>{m.text}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.me ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {m.from} · {m.time}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <form
                className="mt-4 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  setPending(true);
                  try {
                    await write("/tickets/" + ticket.id + "/comments", { body: reply });
                    setReply("");
                    toast.success("Đã gửi phản hồi.");
                  } catch {
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <input
                  value={reply}
                  disabled={pending || ticket.status === "Đã đóng"}
                  aria-label="Nội dung tin nhắn"
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  className="field"
                />
                <Button
                  type="submit"
                  variant="brand"
                  size="icon"
                  disabled={pending || ticket.status === "Đã đóng"}
                  aria-label="Gửi tin nhắn"
                  className="size-11 shrink-0"
                >
                  <Send />
                </Button>
              </form>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
