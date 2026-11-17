import { ArrowRightLeft, Headset, Inbox, KanbanSquare, LayoutDashboard, Wrench } from "lucide-react";

import type { PortalConfig } from "@/shared";

export const helpdeskConfig: PortalConfig = {
  id: "helpdesk",
  themeClass: "portal-helpdesk",
  homeTo: "/helpdesk",
  brand: { name: "NexDesk", product: "Helpdesk Portal", icon: Headset },
  user: { name: "Lý Mỹ Duyên", role: "Chuyên viên Helpdesk", initials: "MD" },
  greeting: { title: "Chào Duyên, ca trực sáng", subtitle: "12 Ticket mới đang chờ tiếp nhận" },
  searchPlaceholder: "Tìm Ticket, người yêu cầu, mã sự cố...",
  nav: [
    {
      title: "Tiếp nhận",
      items: [
        { label: "Dashboard", to: "/helpdesk", icon: LayoutDashboard, exact: true },
        { label: "Tiếp nhận Ticket", to: "/helpdesk/queue", icon: Inbox, badge: "12" },
        { label: "Xử lý sự cố", to: "/helpdesk/resolve", icon: Wrench },
      ],
    },
    {
      title: "Điều phối",
      items: [
        { label: "Chuyển Technician", to: "/helpdesk/escalate", icon: ArrowRightLeft },
        { label: "Theo dõi công việc", to: "/helpdesk/tracking", icon: KanbanSquare },
      ],
    },
  ],
  promo: {
    title: "Mẹo xử lý nhanh",
    text: "68% sự cố mật khẩu & email có thể xử lý ngay ở tuyến 1.",
    cta: "Xử lý ngay",
    to: "/helpdesk/resolve",
  },
};
