import { createFileRoute } from "@tanstack/react-router";

import { AdminTicketsPage } from "@/portals/admin/pages/TicketsPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/tickets")({
  head: () => pageHead("Quản lý Ticket · NexDesk Admin", "Theo dõi toàn bộ yêu cầu hỗ trợ CNTT."),
  component: AdminTicketsPage,
});
