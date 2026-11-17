import { createFileRoute } from "@tanstack/react-router";

import { AdminSoftwarePage } from "@/portals/admin/pages/SoftwarePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/software")({
  head: () => pageHead("Phần mềm & License · NexDesk Admin", "Theo dõi bản quyền và lịch gia hạn phần mềm."),
  component: AdminSoftwarePage,
});
