import { createFileRoute } from "@tanstack/react-router";

import { TechnicianDevicesPage } from "@/portals/technician/pages/DevicesPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/technician/devices")({
  head: () => pageHead("Thiết bị liên quan · NexDesk Technician", "Cấu hình và tình trạng thiết bị liên quan."),
  component: TechnicianDevicesPage,
});
