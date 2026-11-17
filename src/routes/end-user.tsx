import { Outlet, createFileRoute } from "@tanstack/react-router";

import { EndUserLayout } from "@/portals/end-user/EndUserLayout";

export const Route = createFileRoute("/end-user")({
  component: LayoutRoute,
});

function LayoutRoute() {
  return (
    <EndUserLayout>
      <Outlet />
    </EndUserLayout>
  );
}
