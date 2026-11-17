import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskQueuePage } from "@/portals/helpdesk/pages/QueuePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/queue")({
  head: () => pageHead("Tiếp nhận Ticket · NexDesk Helpdesk", "Hàng đợi yêu cầu hỗ trợ mới từ mọi kênh."),
  component: HelpdeskQueuePage,
});
