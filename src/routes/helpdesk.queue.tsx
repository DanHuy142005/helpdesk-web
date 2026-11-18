import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskQueuePage } from "@/portals/helpdesk/pages/QueuePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/queue")({
  head: () =>
    pageHead("Ticket được giao · NexDesk Helpdesk", "Các yêu cầu hỗ trợ do Admin phân công."),
  component: HelpdeskQueuePage,
});
