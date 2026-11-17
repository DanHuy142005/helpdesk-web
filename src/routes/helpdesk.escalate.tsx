import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskEscalatePage } from "@/portals/helpdesk/pages/EscalatePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/escalate")({
  head: () => pageHead("Chuyển Technician · NexDesk Helpdesk", "Chuyển Ticket vượt khả năng cho Technician."),
  component: HelpdeskEscalatePage,
});
