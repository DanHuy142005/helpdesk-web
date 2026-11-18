import {
  BarChart3,
  AlarmClock,
  Building2,
  FileText,
  LayoutDashboard,
  MonitorSmartphone,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

import type { PortalConfig } from "@/shared";

export const adminConfig: PortalConfig = {
  id: "admin",
  themeClass: "portal-admin",
  homeTo: "/admin",
  brand: { name: "NexDesk", product: "Admin Portal", icon: ShieldCheck },
  user: { name: "Nguyễn Hoàng Long", role: "Quản trị hệ thống", initials: "HL" },
  greeting: { title: "Chào buổi sáng, Long", subtitle: "Cập nhật hệ thống mới nhất" },
  searchPlaceholder: "Tìm ticket, nhân viên, tài sản...",
  nav: [
    {
      title: "Tổng quan",
      items: [
        { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true },
        { label: "Báo cáo", to: "/admin/reports", icon: BarChart3 },
      ],
    },
    {
      title: "Vận hành",
      items: [
        { label: "Quản lý Ticket", to: "/admin/tickets", icon: Ticket, badge: "24" },
        { label: "SLA & tự đóng", to: "/admin/sla", icon: AlarmClock },
        { label: "Nhân viên", to: "/admin/employees", icon: Users },
        { label: "Phòng ban", to: "/admin/departments", icon: Building2 },
      ],
    },
    {
      title: "Tài nguyên CNTT",
      items: [
        {
          label: "Tài sản CNTT",
          to: "/admin/assets",
          icon: MonitorSmartphone,
          children: [
            { label: "Thiết bị phần cứng", to: "/admin/assets" },
            { label: "Phần mềm & License", to: "/admin/software" },
          ],
        },
        { label: "Tài liệu", to: "/admin/documents", icon: FileText },
      ],
    },
  ],
  promo: {
    title: "Báo cáo tháng 11",
    text: "SLA đạt 96,4% — cao nhất trong 6 tháng qua.",
    cta: "Xem báo cáo",
    to: "/admin/reports",
  },
};
