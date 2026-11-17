import { createFileRoute } from "@tanstack/react-router";

import { AdminReportsPage } from "@/portals/admin/pages/ReportsPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/reports")({
  head: () => pageHead("Báo cáo · NexDesk Admin", "Hiệu suất xử lý, SLA và mức hài lòng."),
  component: AdminReportsPage,
});
