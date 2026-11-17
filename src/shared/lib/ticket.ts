import type { Tone } from "./tones";

export type TicketStatus =
  | "Mới"
  | "Đang xử lý"
  | "Chờ phản hồi"
  | "Đã chuyển"
  | "Đã giải quyết"
  | "Đã đóng";

export type TicketPriority = "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp";

export const statusTone: Record<TicketStatus, Tone> = {
  "Mới": "info",
  "Đang xử lý": "primary",
  "Chờ phản hồi": "warning",
  "Đã chuyển": "lavender",
  "Đã giải quyết": "success",
  "Đã đóng": "muted",
};

export const priorityTone: Record<TicketPriority, Tone> = {
  "Khẩn cấp": "danger",
  Cao: "warning",
  "Trung bình": "info",
  Thấp: "muted",
};
