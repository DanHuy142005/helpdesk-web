import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, useWorkspace, useWrite } from "../api/client";
import { TicketClassification } from "./TicketClassification";
import { SlaWarning, AutoCloseNotice } from "./TicketSla";
import type { TicketDetail } from "../api/types";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import { AttachmentGallery } from "./Attachments";
import { TicketHistory } from "./TicketHistory";
import { ReturnToHelpdesk, TicketLifecycleAction } from "./TicketOutcomes";

export function TicketDetailPanel({ id }: { id: string }) {
  const { data: workspace } = useWorkspace(),
    write = useWrite();
  const query = useQuery({
    queryKey: ["ticket", id],
    queryFn: ({ signal }) => api<TicketDetail>("/tickets/" + encodeURIComponent(id), { signal }),
    refetchInterval: 3000,
    retry: false,
  });
  const [comment, setComment] = useState(""),
    [pending, setPending] = useState(false);
  if (query.error)
    return (
      <p role="alert" className="text-danger">
        {query.error.message}
      </p>
    );
  const ticket = query.data;
  if (!ticket || !workspace) return <p>Đang tải…</p>;
  const user = workspace.user,
    owner = ticket.assignee_id === user.id;
  const staff = ["helpdesk", "technician"].includes(user.role);
  const canWithdraw =
    user.role === "end-user" &&
    ticket.requester_id === user.id &&
    ticket.status === "Mới" &&
    !ticket.assignee_id &&
    !ticket.assigned_by &&
    !ticket.accepted_at &&
    !ticket.queue_role;
  const canDelete = user.role === "admin" && ticket.status === "Đã đóng";
  return (
    <div className="space-y-5">
      <SlaWarning ticket={ticket} />
      <AutoCloseNotice ticket={ticket} />
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{ticket.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-sm text-muted-foreground">{ticket.category}</span>
        </div>
        <p className="whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm">
          {ticket.description}
        </p>
        <p className="text-sm text-muted-foreground">
          {ticket.requester} · {ticket.department} · Phụ trách:{" "}
          {ticket.assignee ||
            (ticket.status === "Đã thu hồi"
              ? "—"
              : ticket.queue_role === "helpdesk"
                ? "Chờ Admin phân công Helpdesk"
                : "Chờ Admin phân công")}
        </p>
        <p className="text-xs text-muted-foreground">
          Ngày gửi: {new Date(ticket.created_at).toLocaleString("vi-VN")}
        </p>
        {!staff && (
          <p className="text-sm text-muted-foreground">
            Thiết bị được liên kết:{" "}
            {ticket.asset_name
              ? `${ticket.asset_id} · ${ticket.asset_name}`
              : "Không liên quan thiết bị"}
          </p>
        )}
        {ticket.solution && (
          <div className="rounded-xl border border-success/30 bg-success/10 p-4">
            <h3 className="font-bold">Kết quả xử lý</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.solution}</p>
          </div>
        )}
      </section>
      {canWithdraw && <TicketLifecycleAction ticket={ticket} action="withdraw" />}
      {canDelete && <TicketLifecycleAction ticket={ticket} action="delete" />}
      <TicketClassification key={ticket.id + ticket.version} ticket={ticket} />
      {user.role === "technician" && owner && (
        <>
          <ReturnToHelpdesk ticket={ticket} compact />
          <section className="space-y-3">
            <h3 className="font-bold">Ghi chú nội bộ</h3>
            <ul className="space-y-2">
              {ticket.comments.map((item) => (
                <li key={item.id} className="rounded-xl bg-surface p-3 text-sm">
                  <b>{item.author}</b>
                  <p className="whitespace-pre-wrap">{item.body}</p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("vi-VN")}
                  </time>
                </li>
              ))}
            </ul>
            {ticket.status !== "Đã đóng" && (
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPending(true);
                  try {
                    await write("/tickets/" + id + "/comments", { body: comment, internal: true });
                    setComment("");
                    toast.success("Đã lưu ghi chú.");
                  } catch {
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <textarea
                  aria-label="Nội dung ghi chú nội bộ"
                  required
                  maxLength={10000}
                  className="field h-auto py-3"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
                <Button variant="brand" disabled={pending || !comment.trim()}>
                  Lưu ghi chú
                </Button>
              </form>
            )}
          </section>
        </>
      )}
      {user.role !== "end-user" && <AttachmentGallery files={ticket.attachments} />}
      {!staff && <TicketHistory events={ticket.events} statusOnly={user.role === "end-user"} />}
    </div>
  );
}
