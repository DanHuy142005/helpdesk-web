import { AlarmClock, TriangleAlert } from "lucide-react";
import { useWorkspace } from "../api/client";
import { useActions } from "../api/Actions";
import type { ApiTicket } from "../api/types";
import { isOpenTicketStatus } from "../lib/ticket";

export function isOverdue(ticket: ApiTicket, now: string | number = Date.now()) {
  return (
    isOpenTicketStatus(ticket.status) && new Date(ticket.due_at).getTime() < new Date(now).getTime()
  );
}
export function isResolvedLate(ticket: ApiTicket) {
  return !!ticket.resolved_at && new Date(ticket.resolved_at) > new Date(ticket.due_at);
}
export function SlaWarning({ ticket }: { ticket: ApiTicket }) {
  const { data } = useWorkspace();
  if (!isOverdue(ticket, data?.serverTime)) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger"
    >
      <TriangleAlert className="size-5 shrink-0" />
      <div>
        <p className="text-sm font-bold">Đã quá hạn SLA</p>
        <p className="mt-1 text-xs">
          Hạn xử lý: {new Date(ticket.due_at).toLocaleString("vi-VN")}. Vui lòng ưu tiên xử lý yêu
          cầu này.
        </p>
      </div>
    </div>
  );
}
export function AutoCloseNotice({ ticket }: { ticket: ApiTicket }) {
  if (ticket.closed_automatically)
    return (
      <p className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
        Hệ thống đã tự động đóng yêu cầu lúc {new Date(ticket.closed_at!).toLocaleString("vi-VN")}{" "}
        sau thời gian chờ xác nhận.
      </p>
    );
  if (ticket.status !== "Đã giải quyết" || !ticket.auto_close_at) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
      <AlarmClock className="size-4 shrink-0" />
      <span>
        Yêu cầu sẽ tự động đóng lúc {new Date(ticket.auto_close_at).toLocaleString("vi-VN")} nếu
        người yêu cầu chưa xác nhận hoặc yêu cầu xử lý tiếp.
      </span>
    </p>
  );
}
export function OverdueNotice() {
  const { data } = useWorkspace(),
    actions = useActions();
  if (!data || !["helpdesk", "technician"].includes(data.user.role)) return null;
  const count = data.tickets.filter((ticket) => isOverdue(ticket, data.serverTime)).length;
  if (!count) return null;
  return (
    <button
      onClick={() => actions.openPanel({ type: "overdue" })}
      className="mb-5 flex w-full items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-left text-sm text-danger"
      aria-label="Xem Ticket quá hạn SLA"
    >
      <TriangleAlert className="size-5 shrink-0" />
      <span>
        <b>{count} Ticket đã quá hạn SLA</b>
        <span className="mt-1 block text-xs">
          Xem danh sách và ưu tiên xử lý các yêu cầu đang trễ hạn.
        </span>
      </span>
    </button>
  );
}
