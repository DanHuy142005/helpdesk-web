import { createFileRoute } from "@tanstack/react-router";

import { TechnicianInProgressPage } from "@/portals/technician/pages/InProgressPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/technician/in-progress")({
  head: () =>
    pageHead(
      "Xử lý sự cố · NexDesk Technician",
      "Trao đổi trực tiếp với End User, xem ảnh sự cố và xác nhận kết quả.",
    ),
  component: TechnicianInProgressPage,
});
