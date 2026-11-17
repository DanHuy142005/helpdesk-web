import { createFileRoute } from "@tanstack/react-router";

import { TechnicianResultsPage } from "@/portals/technician/pages/ResultsPage";
import { pageHead } from "@/shared";

export const Route = createFileRoute("/technician/results")({
  head: () => pageHead("Kết quả xử lý · NexDesk Technician", "Lịch sử Ticket đã hoàn tất."),
  component: TechnicianResultsPage,
});
