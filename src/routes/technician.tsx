import { Outlet, createFileRoute } from "@tanstack/react-router";

import { TechnicianLayout } from "@/portals/technician/TechnicianLayout";

export const Route = createFileRoute("/technician")({
  component: LayoutRoute,
});

function LayoutRoute() {
  return (
    <TechnicianLayout>
      <Outlet />
    </TechnicianLayout>
  );
}
