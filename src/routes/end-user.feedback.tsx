import { createFileRoute } from "@tanstack/react-router";

import { EndUserFeedbackPage } from "@/portals/end-user/pages/FeedbackPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/end-user/feedback")({
  head: () => pageHead("Phản hồi · NexDesk", "Đánh giá chất lượng hỗ trợ CNTT."),
  component: EndUserFeedbackPage,
});
