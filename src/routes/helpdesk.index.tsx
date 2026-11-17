import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskDashboardPage } from "@/portals/helpdesk/pages/DashboardPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/")({
  head: () => pageHead("Dashboard · NexDesk Helpdesk", "Tiếp nhận và điều phối Ticket trong ca trực."),
  component: HelpdeskDashboardPage,
});
