import { createFileRoute } from "@tanstack/react-router";

import { AdminDepartmentsPage } from "@/portals/admin/pages/DepartmentsPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/departments")({
  head: () => pageHead("Phòng ban · NexDesk Admin", "Cơ cấu phòng ban và mức sử dụng dịch vụ CNTT."),
  component: AdminDepartmentsPage,
});
