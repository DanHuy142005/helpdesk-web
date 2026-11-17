import { BookOpen, LayoutDashboard, LifeBuoy, ListTodo, MessageSquareHeart, PlusCircle, Route } from "lucide-react";

import type { PortalConfig } from "@/shared";

export const endUserConfig: PortalConfig = {
  id: "end-user",
  themeClass: "portal-end-user",
  homeTo: "/end-user",
  brand: { name: "NexDesk", product: "Cổng hỗ trợ nhân viên", icon: LifeBuoy },
  user: { name: "Trần Thu Hà", role: "Kế toán viên · Tài chính", initials: "TH" },
  greeting: { title: "Xin chào Hà, chúc bạn một ngày tốt lành", subtitle: "Bạn có 3 yêu cầu đang được xử lý" },
  searchPlaceholder: "Tìm hướng dẫn, mã Ticket...",
  nav: [
    {
      title: "Cá nhân",
      items: [
        { label: "Dashboard", to: "/end-user", icon: LayoutDashboard, exact: true },
        { label: "Tạo yêu cầu hỗ trợ", to: "/end-user/new-request", icon: PlusCircle },
        { label: "Ticket của tôi", to: "/end-user/tickets", icon: ListTodo, badge: "3" },
        { label: "Theo dõi trạng thái", to: "/end-user/tracking", icon: Route },
      ],
    },
    {
      title: "Hỗ trợ",
      items: [
        { label: "Phản hồi", to: "/end-user/feedback", icon: MessageSquareHeart },
        { label: "Kho hướng dẫn", to: "/end-user/knowledge", icon: BookOpen },
      ],
    },
  ],
  promo: {
    title: "Tự xử lý trong 3 phút",
    text: "Quên mật khẩu? Xem hướng dẫn tự đặt lại mà không cần chờ Helpdesk.",
    cta: "Xem hướng dẫn",
    to: "/end-user/knowledge",
  },
};
