import { usePortalData } from "@/shared/api/data";
export type AdminTicket = ReturnType<typeof usePortalData>["tickets"][number];
export type Employee = ReturnType<typeof usePortalData>["employees"][number];
export type Department = ReturnType<typeof usePortalData>["departments"][number];
export type Asset = ReturnType<typeof usePortalData>["assets"][number];
export type SoftwareLicense = ReturnType<typeof usePortalData>["software"][number];
export type DocumentItem = ReturnType<typeof usePortalData>["documents"][number];
