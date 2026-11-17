import { createFileRoute } from "@tanstack/react-router";

import { TechnicianInProgressPage } from "@/portals/technician/pages/InProgressPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/technician/in-progress")({
  head: () => pageHead("Ticket đang xử lý · NexDesk Technician", "Cập nhật tiến độ và kết quả xử lý."),
  component: TechnicianInProgressPage,
});
