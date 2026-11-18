import { PageHeader, SectionCard, StatusBadge, useActions, usePortalData } from "@/shared";

// Keep the existing route available for bookmarks; Helpdesk no longer transfers tickets.
export function HelpdeskEscalatePage() {
  const { assignments } = usePortalData();
  const actions = useActions();
  return (
    <div>
      <PageHeader
        eyebrow="Theo dõi"
        title="Lịch sử phân công"
        description="Admin phân công Ticket. Bạn chỉ xử lý các Ticket đang được giao cho mình."
      />
      <SectionCard title="Phân công và bàn giao">
        {assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Chưa có lịch sử phân công trong phạm vi công việc của bạn.
          </p>
        )}
        <ol className="space-y-5 border-l border-border pl-5">
          {assignments.map((event) => (
            <li key={event.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  className="text-sm font-bold text-primary"
                  onClick={() => actions.openTicket(event.ticket_id)}
                >
                  {event.ticket_id}
                </button>
                <StatusBadge status={event.to_status} />
              </div>
              <p className="text-sm">
                {event.action === "assign"
                  ? `${event.actor} phân công cho ${event.assignee || "—"}`
                  : `${event.actor} trả về hàng đợi Helpdesk`}
              </p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.note}</p>
              <time className="text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString("vi-VN")}
              </time>
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  );
}
