import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskEscalatePage } from "@/portals/helpdesk/pages/EscalatePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/escalate")({
  head: () =>
    pageHead("Lịch sử phân công · NexDesk Helpdesk", "Theo dõi các Ticket được Admin phân công."),
  component: HelpdeskEscalatePage,
});
