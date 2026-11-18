import { createFileRoute } from "@tanstack/react-router";

import { HelpdeskResolvePage } from "@/portals/helpdesk/pages/ResolvePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/helpdesk/resolve")({
  head: () =>
    pageHead(
      "Xử lý sự cố · NexDesk Helpdesk",
      "Trao đổi trực tiếp với End User, xem ảnh sự cố và xác nhận kết quả.",
    ),
  component: HelpdeskResolvePage,
});
