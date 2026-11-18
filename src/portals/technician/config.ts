import { ClipboardList, Cpu, LayoutDashboard, ListChecks, Wrench } from "lucide-react";

import type { PortalConfig } from "@/shared";

export const technicianConfig: PortalConfig = {
  id: "technician",
  themeClass: "portal-technician",
  homeTo: "/technician",
  brand: { name: "NexDesk", product: "Technician Portal", icon: Wrench },
  user: { name: "Phạm Đức Huy", role: "Kỹ thuật viên hệ thống", initials: "ĐH" },
  greeting: {
    title: "Chào Huy, chúc ngày làm việc hiệu quả",
    subtitle: "Bạn có 6 công việc cần xử lý",
  },
  searchPlaceholder: "Tìm Ticket, mã thiết bị, serial...",
  nav: [
    {
      title: "Công việc",
      items: [
        { label: "Dashboard", to: "/technician", icon: LayoutDashboard, exact: true },
        {
          label: "Công việc được giao",
          to: "/technician/assigned",
          icon: ClipboardList,
          badge: "6",
        },
        { label: "Xử lý sự cố", to: "/technician/in-progress", icon: Wrench },
      ],
    },
    {
      title: "Kết quả & thiết bị",
      items: [
        { label: "Kết quả xử lý", to: "/technician/results", icon: ListChecks },
        { label: "Thiết bị liên quan", to: "/technician/devices", icon: Cpu },
      ],
    },
  ],
  promo: {
    title: "Ticket ưu tiên",
    text: "TK-10249 sắp vượt SLA — còn 7 phút.",
    cta: "Mở Ticket",
    to: "/technician/in-progress",
  },
};
