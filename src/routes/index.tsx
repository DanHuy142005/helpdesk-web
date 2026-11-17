import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/shared";
import { PortalDirectory } from "@/shared/pages/PortalDirectoryPage";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "NexDesk · Hệ thống IT Helpdesk doanh nghiệp",
      "Bốn cổng riêng cho Quản trị, Helpdesk, Kỹ thuật viên và Nhân viên trong hệ thống IT Helpdesk NexDesk.",
    ),
  component: PortalDirectory,
});
