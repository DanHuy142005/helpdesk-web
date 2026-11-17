import { createFileRoute } from "@tanstack/react-router";

import { AdminEmployeesPage } from "@/portals/admin/pages/EmployeesPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/employees")({
  head: () => pageHead("Nhân viên · NexDesk Admin", "Danh sách nhân sự và vai trò hệ thống."),
  component: AdminEmployeesPage,
});
