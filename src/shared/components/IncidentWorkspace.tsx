import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, useWorkspace } from "../api/client";
import type { TicketDetail } from "../api/types";
import { PageHeader } from "./PageHeader";
import { SectionCard } from "./SectionCard";
import { PriorityBadge, StatusBadge } from "./StatusBadge";
import { TicketConversation } from "./TicketConversation";
import { AttachmentGallery, TicketAttachmentUpload } from "./Attachments";
import { TicketHistory } from "./TicketHistory";
import { ResolveTicketButton, ReturnToHelpdesk } from "./TicketOutcomes";

import { SlaWarning, AutoCloseNotice } from "./TicketSla";

export function IncidentWorkspace() {
  const { data: workspace } = useWorkspace();
  const [selected, setSelected] = useState("");
  const list =
    workspace?.tickets.filter(
      (ticket) => ticket.assignee_id === workspace.user.id && ticket.status !== "Đã đóng",
    ) || [];
  const chosen = list.find((ticket) => ticket.id === selected) || list[0];
  const query = useQuery({
    queryKey: ["ticket", chosen?.id],
    queryFn: ({ signal }) => api<TicketDetail>(`/tickets/${chosen!.id}`, { signal }),
    enabled: !!chosen,
    refetchInterval: 3000,
    retry: false,
  });
  const ticket = query.data;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Công việc"
        title="Xử lý sự cố"
        description="Trao đổi trực tiếp với End User, xem ảnh sự cố và xác nhận kết quả xử lý."
      />
      {!chosen ? (
        <SectionCard title="Chưa có yêu cầu cần xử lý">
          Các Ticket do Admin phân công sẽ xuất hiện tại đây.
        </SectionCard>
      ) : (
        <>
          <label className="block space-y-2 text-sm font-semibold">
            Chọn yêu cầu đang xử lý
            <select
              aria-label="Chọn yêu cầu đang xử lý"
              className="field"
              value={chosen.id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {list.map((item) => (
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
              <SlaWarning ticket={ticket} />
              <AutoCloseNotice ticket={ticket} />
              <SectionCard>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-primary">{ticket.id}</span>
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <h2 className="text-xl font-bold">{ticket.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {ticket.description}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Người yêu cầu: {ticket.requester} · {ticket.department}
                </p>
              </SectionCard>
              <TicketConversation
                ticket={ticket}
                expanded
                actions={<ResolveTicketButton ticket={ticket} />}
              />
              {ticket.status === "Đã giải quyết" && (
                <SectionCard title="Chờ End User xác nhận">
                  <p className="whitespace-pre-wrap text-sm">{ticket.solution}</p>
                </SectionCard>
              )}
              <SectionCard>
                <AttachmentGallery files={ticket.attachments} />
                <div className={ticket.attachments.length ? "mt-5" : ""}>
                  <TicketAttachmentUpload ticketId={ticket.id} />
                </div>
              </SectionCard>
              {workspace?.user.role === "technician" && <ReturnToHelpdesk ticket={ticket} />}
              <SectionCard>
                <TicketHistory events={ticket.events} />
              </SectionCard>
            </div>
          ) : (
            <p>Đang tải yêu cầu…</p>
          )}
        </>
      )}
    </div>
  );
}
