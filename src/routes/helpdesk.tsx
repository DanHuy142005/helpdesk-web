import { Outlet, createFileRoute } from "@tanstack/react-router";

import { HelpdeskLayout } from "@/portals/helpdesk/HelpdeskLayout";

export const Route = createFileRoute("/helpdesk")({
  component: LayoutRoute,
});

function LayoutRoute() {
  return (
    <HelpdeskLayout>
      <Outlet />
    </HelpdeskLayout>
  );
}
