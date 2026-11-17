import { createFileRoute } from "@tanstack/react-router";

import { EndUserTrackingPage } from "@/portals/end-user/pages/TrackingPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/end-user/tracking")({
  head: () => pageHead("Theo dõi trạng thái · NexDesk", "Theo dõi tiến độ xử lý từng yêu cầu."),
  component: EndUserTrackingPage,
});
