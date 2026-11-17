import { createFileRoute } from "@tanstack/react-router";

import { EndUserNewRequestPage } from "@/portals/end-user/pages/NewRequestPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/end-user/new-request")({
  head: () => pageHead("Tạo yêu cầu hỗ trợ · NexDesk", "Gửi yêu cầu hỗ trợ CNTT mới tới Helpdesk."),
  component: EndUserNewRequestPage,
});
