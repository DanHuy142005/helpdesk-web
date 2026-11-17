import { usePortalData, useActions, useWrite } from "@/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, BookOpen, CheckCircle2, Paperclip, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared";
import { cn } from "@/shared";
import { PageHeader, PriorityBadge, SectionCard, StatusBadge, UserAvatar } from "@/shared";
import { quickFixes } from "../data";

export function HelpdeskResolvePage() {
  const { kbSuggestions, queue, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const list = queue.filter(
    (t) => t.assignee_id === workspace.user.id && ["Đang xử lý", "Chờ phản hồi"].includes(t.status),
  );
  const [selectedId, setSelectedId] = useState(list[0]?.id || "");
  const ticket = list.find((t) => t.id === selectedId) ?? list[0];
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [reply, setReply] = useState(""),
    [pending, setPending] = useState(false);
  if (!ticket)
    return (
      <SectionCard title="Xử lý sự cố tuyến 1">
        <p className="text-sm text-muted-foreground">Chưa có Ticket đang phụ trách.</p>
        <Button className="mt-4" variant="brand" asChild>
          <Link to="/helpdesk/queue">Mở hàng đợi tiếp nhận</Link>
        </Button>
      </SectionCard>
    );
  const steps = quickFixes[ticket.category] ?? quickFixes["default"]!;
  async function send(resolve = false) {
    setPending(true);
    const checkedSteps = Object.keys(done).filter((step) => done[step]);
    const body =
      reply +
      (checkedSteps.length
        ? "\nCác bước đã thực hiện:\n" + checkedSteps.map((step) => "• " + step).join("\n")
        : "");
    try {
      await write(
        resolve ? "/tickets/" + ticket!.id + "/actions" : "/tickets/" + ticket!.id + "/comments",
        resolve ? { action: "resolve", version: ticket!.version, note: body } : { body },
      );
      toast.success(resolve ? "Đã lưu kết quả. Đang chờ người gửi xác nhận." : "Đã gửi phản hồi.");
      setReply("");
      setDone({});
    } catch {
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Tiếp nhận"
        title="Xử lý sự cố tuyến 1"
        description="Xử lý nhanh các sự cố đơn giản. Nếu vượt khả năng, chuyển cho Technician."
        actions={
          <Button variant="outline" onClick={() => actions.openTicket(ticket.id)}>
            Chi tiết & lịch sử Ticket
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Đang xử lý"
          description={`${list.length} Ticket`}
          className="xl:col-span-4"
        >
          <ul className="space-y-2">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(t.id);
                    setDone({});
                  }}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all",
                    t.id === ticket.id
                      ? "border-primary/30 bg-primary-soft shadow-soft"
                      : "border-border/70 hover:bg-surface",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{t.id}</span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.requester} · chờ {t.waiting}
                  </p>
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
                  <span className="text-xs text-muted-foreground">{ticket.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-surface p-2 pr-4">
                <UserAvatar name={ticket.requester} size="md" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{ticket.requester}</p>
                  <p className="text-xs text-muted-foreground">{ticket.department}</p>
                </div>
              </div>
            </div>
            <p className="mt-4 rounded-xl border border-border/70 bg-surface/60 p-4 text-sm leading-relaxed text-foreground/85">
              {ticket.description}
            </p>
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard
              title="Các bước xử lý nhanh"
              description={`${Object.values(done).filter(Boolean).length}/${steps.length} hoàn thành`}
            >
              <ul className="space-y-2">
                {steps.map((s) => (
                  <li key={s}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-surface">
                      <input
                        type="checkbox"
                        checked={!!done[s]}
                        onChange={(e) => setDone((d) => ({ ...d, [s]: e.target.checked }))}
                        className="mt-0.5 size-4 accent-primary"
                      />
                      <span
                        className={cn("text-sm", done[s] && "text-muted-foreground line-through")}
                      >
                        {s}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Gợi ý từ kho giải pháp">
              <ul className="space-y-2">
                {kbSuggestions.map((k) => (
                  <li
                    key={k.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => actions.openDocument(k.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") actions.openDocument(k.id);
                    }}
                    className="flex items-center gap-3 rounded-xl border border-border/70 p-3"
                  >
                    <BookOpen className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{k.title}</p>
                      <p className="text-[11px] text-muted-foreground">{k.views} lượt xem</p>
                    </div>
                    <span className="text-xs font-bold text-success">Đọc</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Phản hồi người dùng">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              aria-label="Nội dung phản hồi hoặc kết quả"
              rows={3}
              placeholder="Nhập nội dung phản hồi hoặc hướng dẫn cho người dùng..."
              className="field h-auto resize-none py-3"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => actions.openTicket(ticket.id)}>
                <Paperclip /> Đính kèm
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link to="/helpdesk/escalate">
                    <ArrowRightLeft /> Chuyển Technician
                  </Link>
                </Button>
                <Button
                  variant="soft"
                  disabled={pending || !reply.trim()}
                  onClick={() => void send()}
                >
                  <Send /> Gửi
                </Button>
                <Button
                  variant="brand"
                  disabled={pending || reply.trim().length < 10}
                  onClick={() => void send(true)}
                >
                  <CheckCircle2 /> Đã giải quyết
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
