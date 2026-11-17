import { createFileRoute } from "@tanstack/react-router";

import { AdminDashboardPage } from "@/portals/admin/pages/DashboardPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/")({
  head: () => pageHead("Dashboard · NexDesk Admin", "Tổng quan vận hành IT Helpdesk toàn doanh nghiệp."),
  component: AdminDashboardPage,
});
