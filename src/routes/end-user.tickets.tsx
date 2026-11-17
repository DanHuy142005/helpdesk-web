import { createFileRoute } from "@tanstack/react-router";

import { EndUserTicketsPage } from "@/portals/end-user/pages/TicketsPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/end-user/tickets")({
  head: () => pageHead("Ticket của tôi · NexDesk", "Danh sách các Ticket bạn đã gửi."),
  component: EndUserTicketsPage,
});
