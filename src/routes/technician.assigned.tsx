import { createFileRoute } from "@tanstack/react-router";

import { TechnicianAssignedPage } from "@/portals/technician/pages/AssignedPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/technician/assigned")({
  head: () => pageHead("Công việc được giao · NexDesk Technician", "Danh sách Ticket được giao cho bạn."),
  component: TechnicianAssignedPage,
});
