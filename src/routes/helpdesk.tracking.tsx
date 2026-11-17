import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskTrackingPage } from "@/portals/helpdesk/pages/TrackingPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/tracking")({
  head: () => pageHead("Theo dõi công việc · NexDesk Helpdesk", "Bảng theo dõi tiến độ các Ticket."),
  component: HelpdeskTrackingPage,
});
