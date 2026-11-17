import { createFileRoute } from "@tanstack/react-router";

import { EndUserDashboardPage } from "@/portals/end-user/pages/DashboardPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/end-user/")({
  head: () => pageHead("Dashboard cá nhân · NexDesk", "Tổng quan các yêu cầu hỗ trợ CNTT của bạn."),
  component: EndUserDashboardPage,
});
