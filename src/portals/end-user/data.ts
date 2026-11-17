import { usePortalData } from "@/shared/api/data";
export type MyTicket = ReturnType<typeof usePortalData>["myTickets"][number];
export type FeedbackItem = ReturnType<typeof usePortalData>["feedbackHistory"][number];
export type Article = ReturnType<typeof usePortalData>["articles"][number];
