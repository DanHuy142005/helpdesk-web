import type { ReactNode } from "react";

import { PortalShell } from "@/shared";
import { adminConfig } from "./config";

export function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalShell config={adminConfig}>{children}</PortalShell>;
}
