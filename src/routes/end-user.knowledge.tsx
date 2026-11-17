import { createFileRoute } from "@tanstack/react-router";

import { EndUserKnowledgePage } from "@/portals/end-user/pages/KnowledgePage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/end-user/knowledge")({
  head: () => pageHead("Kho hướng dẫn · NexDesk", "Hướng dẫn tự xử lý các sự cố CNTT thường gặp."),
  component: EndUserKnowledgePage,
});
