import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, useWorkspace, useWrite } from "../api/client";
import type { ApiMessage, ApiTicket } from "../api/types";

const roleNames = {
  admin: "Admin",
  helpdesk: "Helpdesk",
  technician: "Technician",
  "end-user": "End User",
};

export function TicketConversation({ ticket, actions, expanded = false }: { ticket: ApiTicket; actions?: ReactNode; expanded?: boolean }) {
  const { data: workspace } = useWorkspace();
  const user = workspace?.user;
  const allowed =
    !!user &&
    ((user.role === "end-user" && ticket.requester_id === user.id) ||
      (["helpdesk", "technician"].includes(user.role) && ticket.assignee_id === user.id));
  const query = useQuery({
    queryKey: ["ticket", ticket.id, "messages", user?.id],
    queryFn: () => api<ApiMessage[]>(`/tickets/${encodeURIComponent(ticket.id)}/messages`),
    enabled: allowed,
    refetchInterval: 3000,
    retry: false,
  });
  const write = useWrite();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const lastMessage = query.data?.at(-1)?.id;
  useEffect(() => {
    if (lastMessage) end.current?.scrollIntoView({ block: "nearest" });
  }, [lastMessage]);
  if (!allowed) return null;
  const writable = ticket.status !== "Đã đóng" && !!ticket.assignee_id;
  return (
    <section aria-label="Hội thoại Ticket" className={`space-y-4 rounded-xl border bg-card p-4 sm:p-6 ${expanded ? "flex min-h-[600px] flex-col" : ""}`}>
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-primary" />
        <h3 className="font-bold">
          Hội thoại với {user?.role === "end-user" ? ticket.assignee || "người xử lý" : "End User"}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {ticket.requester} · {ticket.assignee || "Chờ Admin phân công"}. Lịch sử trao đổi được giữ
        lại khi đổi người xử lý.
      </p>
      {query.error ? (
        <p role="alert" className="text-sm text-danger">
          {query.error.message}
        </p>
      ) : (
        <ol
          aria-live="polite"
          aria-relevant="additions"
          className={`${expanded ? "min-h-80 max-h-[65vh] flex-1" : "max-h-80"} space-y-3 overflow-y-auto rounded-xl bg-surface/50 p-3`}
        >
          {query.isPending && (
            <li className="text-sm text-muted-foreground">Đang tải hội thoại…</li>
          )}
          {query.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">Chưa có tin nhắn.</li>
          )}
          {query.data?.map((message) => (
            <li
              key={message.id}
              className={`flex ${message.author_id === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl border p-3 text-sm sm:max-w-[80%] ${message.author_id === user?.id ? "border-primary/15 bg-primary-soft" : "border-border bg-card"}`}
              >
                <p className="text-xs font-semibold">
                  {message.author} · {roleNames[message.author_role]}
                </p>
                <p className="my-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {message.body}
                </p>
                <time dateTime={message.created_at} className="text-[10px] text-muted-foreground">
                  {new Date(message.created_at).toLocaleString("vi-VN")}
                </time>
              </div>
            </li>
          ))}
          <li aria-hidden="true">
            <div ref={end} />
          </li>
        </ol>
      )}
      {writable && !query.error ? (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!body.trim() || pending) return;
            setPending(true);
            try {
              await write(`/tickets/${encodeURIComponent(ticket.id)}/messages`, {
                body: body.trim(),
              });
              setBody("");
            } catch {
            } finally {
              setPending(false);
            }
          }}
        >
          <textarea
            aria-label="Nội dung tin nhắn"
            required
            maxLength={10000}
            rows={3}
            className="field h-auto py-3"
            placeholder="Trao đổi về vấn đề cần hỗ trợ…"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={pending}
          />
          <div className="flex flex-wrap items-center gap-3"><Button variant="brand" disabled={pending || !body.trim()}>
            <Send /> {pending ? "Đang gửi…" : "Gửi tin nhắn"}
          </Button>{actions}</div>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          {ticket.status === "Đã đóng"
            ? "Ticket đã đóng. Bạn vẫn có thể đọc lịch sử hội thoại."
            : "Chờ Admin phân công người xử lý để tiếp tục trao đổi."}
        </p>
      )}
    </section>
  );
}
