import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskDashboardPage } from "@/portals/helpdesk/pages/DashboardPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/")({
  head: () =>
    pageHead(
      "Dashboard · NexDesk Helpdesk",
      "Xử lý Ticket do Admin giao và trao đổi với End User.",
    ),
  component: HelpdeskDashboardPage,
});
