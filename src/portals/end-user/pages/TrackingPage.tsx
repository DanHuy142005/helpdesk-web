import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import {
  AttachmentGallery,
  TicketAttachmentUpload,
  Button,
  PageHeader,
  PriorityBadge,
  SectionCard,
  StatusBadge,
  TicketConversation,
  TicketResultReview,
  AutoCloseNotice,
  api,
  cn,
  useActions,
  usePortalData,
  type TicketDetail,
} from "@/shared";

export function EndUserTrackingPage() {
  const { myTickets } = usePortalData(),
    actions = useActions();
  const [selected, setSelected] = useState("");
  const chosen = myTickets.find((ticket) => ticket.id === selected) || myTickets[0];
  const query = useQuery({
    queryKey: ["ticket", chosen?.id],
    queryFn: () => api<TicketDetail>("/tickets/" + chosen!.id),
    enabled: !!chosen,
    refetchInterval: 3000,
  });
  const ticket = query.data;
  const current = !ticket
    ? 0
    : ticket.status === "Đã đóng"
      ? 4
      : ticket.status === "Đã giải quyết"
        ? 3
        : ticket.assignee_id
          ? 2
          : ticket.queue_role
            ? 1
            : 0;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cá nhân"
        title="Theo dõi trạng thái"
        description="Theo dõi tiến độ và trò chuyện trực tiếp với người đang hỗ trợ bạn."
      />
      {!chosen ? (
        <SectionCard>Bạn chưa gửi yêu cầu hỗ trợ.</SectionCard>
      ) : (
        <>
          <label className="block space-y-2 text-sm font-semibold">
            Chọn yêu cầu cần theo dõi
            <select
              aria-label="Chọn yêu cầu cần theo dõi"
              className="field"
              value={chosen.id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {myTickets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.title}
                </option>
              ))}
            </select>
          </label>
          {query.error ? (
            <p role="alert" className="text-danger">
              {query.error.message}
            </p>
          ) : ticket ? (
            <div key={ticket.id} className="space-y-5">
              <SectionCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-primary">{ticket.id}</p>
                    <h2 className="mt-1 text-xl font-bold">{ticket.title}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      <span className="text-xs text-muted-foreground">
                        {ticket.assignee || "Chờ Admin phân công người xử lý"}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => actions.openTicket(ticket.id)}>
                    Xem thông tin yêu cầu
                  </Button>
                </div>
                <ol aria-label="Tiến trình yêu cầu" className="mt-7 grid gap-5 sm:grid-cols-5">
                  {[
                    "Đã gửi yêu cầu",
                    "Admin phân công",
                    "Đang xử lý",
                    "Chờ bạn xác nhận",
                    "Hoàn thành",
                  ].map((label, index) => (
                    <li
                      key={label}
                      aria-current={index === current ? "step" : undefined}
                      className="relative"
                    >
                      {index < 4 && (
                        <span
                          className={cn(
                            "absolute left-10 top-5 hidden h-0.5 w-[calc(100%-1rem)] sm:block",
                            index < current ? "bg-brand" : "bg-border",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative grid size-10 place-items-center rounded-full text-sm font-bold",
                          index < current
                            ? "bg-brand text-white"
                            : index === current
                              ? "border-2 border-primary bg-card text-primary ring-4 ring-primary/15"
                              : "bg-surface text-muted-foreground",
                        )}
                      >
                        {index < current ? <Check className="size-5" /> : index + 1}
                      </span>
                      <p
                        className={cn(
                          "mt-3 text-sm font-semibold",
                          index > current && "text-muted-foreground",
                        )}
                      >
                        {label}
                      </p>
                    </li>
                  ))}
                </ol>
              </SectionCard>
              <TicketResultReview ticket={ticket} />
              {ticket.closed_automatically && <AutoCloseNotice ticket={ticket} />}
              <TicketConversation ticket={ticket} expanded />
              {(ticket.attachments.length > 0 || ticket.status !== "Đã đóng") && (
                <SectionCard>
                  <AttachmentGallery files={ticket.attachments} />
                  {ticket.status !== "Đã đóng" && (
                    <div className={ticket.attachments.length ? "mt-5" : ""}>
                      <TicketAttachmentUpload ticketId={ticket.id} />
                    </div>
                  )}
                </SectionCard>
              )}
            </div>
          ) : (
            <p>Đang tải yêu cầu…</p>
          )}
        </>
      )}
    </div>
  );
}
