import type { ApiEvent } from "../api/types";

export function TicketHistory({
  events,
  statusOnly = false,
}: {
  events: ApiEvent[];
  statusOnly?: boolean;
}) {
  return (
    <section aria-label="Lịch sử trạng thái" className="space-y-3">
      <h3 className="font-bold">Lịch sử trạng thái</h3>
      <ol className="space-y-3 border-l pl-4">
        {events.map((event) => (
          <li key={event.id} className="text-sm">
            <b>{event.to_status}</b>
            <time dateTime={event.created_at} className="ml-2 text-xs text-muted-foreground">
              {new Date(event.created_at).toLocaleString("vi-VN")}
            </time>
            {!statusOnly && (
              <>
                <p className="text-xs text-muted-foreground">
                  {event.actor}
                  {event.assignee ? ` · ${event.assignee}` : ""}
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground">{event.note}</p>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
