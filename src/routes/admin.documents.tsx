import { createFileRoute } from "@tanstack/react-router";

import { AdminDocumentsPage } from "@/portals/admin/pages/DocumentsPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/admin/documents")({
  head: () => pageHead("Tài liệu · NexDesk Admin", "Quy trình, chính sách và hướng dẫn nội bộ."),
  component: AdminDocumentsPage,
});
