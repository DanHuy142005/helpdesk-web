import { usePortalData, useActions, useWrite } from "@/shared";
import { ArrowRightLeft, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared";
import { cn } from "@/shared";
import {
  Badge,
  Field,
  PageHeader,
  ProgressBar,
  SectionCard,
  StatusBadge,
  UserAvatar,
} from "@/shared";

export function HelpdeskEscalatePage() {
  const { escalations, queue, technicians, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const candidates = queue.filter(
    (t) => t.assignee_id === workspace.user.id && ["Đang xử lý", "Chờ phản hồi"].includes(t.status),
  );
  const [ticketId, setTicketId] = useState(candidates[0]?.id || "");
  const [tech, setTech] = useState(technicians[0]?.name || "");
  const [pending, setPending] = useState(false);
  const selected = candidates.find((t) => t.id === ticketId) || candidates[0];

  return (
    <div>
      <PageHeader
        eyebrow="Điều phối"
        title="Chuyển Ticket cho Technician"
        description="Khi sự cố vượt quá khả năng xử lý tuyến 1, chuyển kèm ghi chú để Technician tiếp tục."
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard title="Thông tin chuyển giao" className="xl:col-span-7">
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selected) {
                toast.error("Bạn chưa có Ticket để chuyển. Hãy tiếp nhận trước.");
                return;
              }
              const form = new FormData(e.currentTarget),
                assignee = technicians.find((t) => t.name === tech);
              if (!assignee) {
                toast.error("Chọn Technician.");
                return;
              }
              setPending(true);
              try {
                await write("/tickets/" + selected.id + "/actions", {
                  action: "escalate",
                  version: selected.version,
                  assigneeId: assignee.id,
                  note: String(form.get("reason")) + ": " + String(form.get("note")),
                });
                toast.success("Đã chuyển " + selected.id);
                setTicketId("");
              } catch {
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Ticket cần chuyển">
                <select
                  value={selected?.id || ""}
                  onChange={(e) => setTicketId(e.target.value)}
                  className="field"
                  required
                >
                  {!candidates.length && <option value="">Chưa có Ticket đang phụ trách</option>}
                  {candidates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} — {t.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lý do chuyển">
                <select name="reason" className="field" defaultValue="Cần chuyên môn sâu">
                  <option value="Cần chuyên môn sâu">Cần chuyên môn sâu</option>
                  <option value="onsite">Cần hỗ trợ tại chỗ</option>
                  <option value="hardware">Lỗi phần cứng / thay thế linh kiện</option>
                  <option value="access">Cần quyền quản trị hệ thống</option>
                </select>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Chọn Technician</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {technicians.map((t) => {
                  const on = tech === t.name;
                  const off = false;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      disabled={off}
                      onClick={() => setTech(t.name)}
                      className={cn(
                        "relative rounded-xl border p-3 text-left transition-all disabled:opacity-50",
                        on
                          ? "border-primary/40 bg-primary-soft shadow-soft"
                          : "border-border hover:bg-surface",
                      )}
                    >
                      {on && (
                        <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={t.name} />
                        <div className="leading-tight">
                          <p className="text-sm font-semibold">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground">{t.skill}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{t.active} việc đang làm</span>
                        <span className="font-semibold text-foreground">{t.load}%</span>
                      </div>
                      <ProgressBar
                        value={t.load}
                        className="mt-1 h-1.5"
                        tone={t.load > 80 ? "danger" : t.load > 60 ? "warning" : "primary"}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Ghi chú cho Technician" hint="Dữ liệu hiện tại">
              <textarea
                name="note"
                required
                minLength={10}
                rows={4}
                className="field h-auto resize-none py-3"
                placeholder="Mô tả các bước đã thử, ít nhất 10 ký tự..."
              />
            </Field>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="brand"
                size="lg"
                disabled={pending || !selected || !technicians.length}
              >
                <ArrowRightLeft /> Chuyển Ticket
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Lịch sử chuyển gần đây" className="xl:col-span-5">
          <ol className="relative space-y-5 border-l border-border pl-5">
            {escalations.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-card bg-primary ring-4 ring-primary/15" />
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="text-xs font-bold text-primary"
                    onClick={() => actions.openTicket(e.ticketId)}
                  >
                    {e.ticketId}
                  </button>
                  <span className="text-[11px] text-muted-foreground">{e.time}</span>
                </div>
                <p className="mt-0.5 text-sm font-semibold">{e.title}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <Badge tone="muted" dot={false} className="px-2 py-0.5 text-[11px]">
                    → {e.technician}
                  </Badge>
                  <StatusBadge status={e.status} />
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}
