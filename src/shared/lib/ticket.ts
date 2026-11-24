import type { Tone } from "./tones";

export type TicketStatus =
  "Mới" | "Đang xử lý" | "Chờ phản hồi" | "Đã chuyển" | "Đã giải quyết" | "Đã đóng" | "Đã thu hồi";

export const isFinalTicketStatus = (status: TicketStatus) =>
  status === "Đã đóng" || status === "Đã thu hồi";

export const isOpenTicketStatus = (status: TicketStatus) =>
  status !== "Đã giải quyết" && !isFinalTicketStatus(status);

export type TicketPriority = "Khẩn cấp" | "Cao" | "Trung bình" | "Thấp";

export const statusTone: Record<TicketStatus, Tone> = {
  Mới: "info",
  "Đang xử lý": "primary",
  "Chờ phản hồi": "warning",
  "Đã chuyển": "lavender",
  "Đã giải quyết": "success",
  "Đã đóng": "muted",
  "Đã thu hồi": "muted",
};

export const priorityTone: Record<TicketPriority, Tone> = {
  "Khẩn cấp": "danger",
  Cao: "warning",
  "Trung bình": "info",
  Thấp: "muted",
};
