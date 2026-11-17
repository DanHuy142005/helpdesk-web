import { usePortalData } from "@/shared/api/data";
export type Job = ReturnType<typeof usePortalData>["jobs"][number];
export type Result = ReturnType<typeof usePortalData>["results"][number];
export type Device = ReturnType<typeof usePortalData>["devices"][number];
