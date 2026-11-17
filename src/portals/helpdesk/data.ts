import { usePortalData } from "@/shared/api/data";
export type QueueTicket = ReturnType<typeof usePortalData>["queue"][number];
export type Technician = ReturnType<typeof usePortalData>["technicians"][number];
export type Channel = "Cổng web" | "Email" | "Điện thoại" | "Chat";
export const quickFixes: Record<string, string[]> = {
  default: [
    "Xác minh thông tin người yêu cầu",
    "Thu thập thông báo lỗi",
    "Ghi lại các bước đã thử và kết quả xử lý",
  ],
};
