import { createFileRoute } from "@tanstack/react-router";
import { AdminSlaPage } from "@/portals/admin/pages/SlaPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/sla")({
  head: () =>
    pageHead(
      "SLA & tự đóng · NexDesk Admin",
      "Quản lý hạn xử lý và thời gian chờ xác nhận Ticket.",
    ),
  component: AdminSlaPage,
});
