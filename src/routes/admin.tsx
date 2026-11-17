import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminLayout } from "@/portals/admin/AdminLayout";

export const Route = createFileRoute("/admin")({
  component: LayoutRoute,
});

function LayoutRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
