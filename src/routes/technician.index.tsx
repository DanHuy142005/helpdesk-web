import { createFileRoute } from "@tanstack/react-router";

import { TechnicianDashboardPage } from "@/portals/technician/pages/DashboardPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/technician/")({
  head: () => pageHead("Dashboard · NexDesk Technician", "Tổng hợp công việc được giao cho kỹ thuật viên."),
  component: TechnicianDashboardPage,
});
