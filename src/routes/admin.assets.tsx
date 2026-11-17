import { createFileRoute } from "@tanstack/react-router";

import { AdminAssetsPage } from "@/portals/admin/pages/AssetsPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/assets")({
  head: () => pageHead("Tài sản CNTT · NexDesk Admin", "Quản lý vòng đời thiết bị phần cứng."),
  component: AdminAssetsPage,
});
