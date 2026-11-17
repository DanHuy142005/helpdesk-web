import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskResolvePage } from "@/portals/helpdesk/pages/ResolvePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/resolve")({
  head: () => pageHead("Xử lý sự cố · NexDesk Helpdesk", "Xử lý nhanh sự cố đơn giản tuyến 1."),
  component: HelpdeskResolvePage,
});
