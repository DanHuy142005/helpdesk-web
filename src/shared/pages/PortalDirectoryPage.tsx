import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Headset,
  LifeBuoy,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppPath } from "../types";
interface PortalCard {
  to: AppPath;
  theme: string;
  icon: LucideIcon;
  name: string;
  audience: string;
  text: string;
  pages: string[];
}

const portals: PortalCard[] = [
  {
    to: "/admin",
    theme: "portal-admin",
    icon: ShieldCheck,
    name: "Admin Portal",
    audience: "Quản trị hệ thống",
    text: "Quản lý Ticket, nhân viên, phòng ban, tài sản CNTT, license và báo cáo SLA.",
    pages: ["Dashboard", "Ticket", "Nhân viên", "Tài sản", "Báo cáo"],
  },
  {
    to: "/helpdesk",
    theme: "portal-helpdesk",
    icon: Headset,
    name: "Helpdesk Portal",
    audience: "Chuyên viên tuyến 1",
    text: "Tiếp nhận, phân loại, xử lý nhanh sự cố và chuyển tiếp cho kỹ thuật viên.",
    pages: ["Tiếp nhận", "Xử lý sự cố", "Chuyển Technician", "Theo dõi"],
  },
  {
    to: "/technician",
    theme: "portal-technician",
    icon: Wrench,
    name: "Technician Portal",
    audience: "Kỹ thuật viên",
    text: "Nhận việc được giao, cập nhật tiến độ, ghi kết quả và tra cứu thiết bị.",
    pages: ["Việc được giao", "Đang xử lý", "Kết quả", "Thiết bị"],
  },
  {
    to: "/end-user",
    theme: "portal-end-user",
    icon: LifeBuoy,
    name: "End User Portal",
    audience: "Nhân viên công ty",
    text: "Gửi yêu cầu hỗ trợ, theo dõi trạng thái, đánh giá và tự tra cứu hướng dẫn.",
    pages: ["Tạo yêu cầu", "Ticket của tôi", "Theo dõi", "Kho hướng dẫn"],
  },
];

export function PortalDirectory() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Cổng làm việc doanh nghiệp
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
          <span className="text-gradient">NexDesk</span> IT Helpdesk
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Bốn cổng làm việc riêng biệt, dùng chung hệ thống dữ liệu. Đăng nhập để truy cập đúng cổng
          theo vai trò của bạn.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {portals.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.to}
              to={p.to}
              className={cn(
                p.theme,
                "group card-surface relative overflow-hidden p-6 transition-all hover:-translate-y-1 hover:shadow-card",
              )}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand opacity-15 blur-2xl transition-opacity group-hover:opacity-30" />
              <div className="relative flex items-start justify-between gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand text-primary-foreground shadow-glow">
                  <Icon className="size-6" />
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
                  {p.to}
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </span>
              </div>
              <h2 className="relative mt-5 font-display text-xl font-bold">{p.name}</h2>
              <p className="relative text-xs font-semibold text-primary">{p.audience}</p>
              <p className="relative mt-2 text-sm text-muted-foreground">{p.text}</p>
              <div className="relative mt-4 flex flex-wrap gap-1.5">
                {p.pages.map((pg) => (
                  <span
                    key={pg}
                    className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-accent-foreground"
                  >
                    {pg}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
