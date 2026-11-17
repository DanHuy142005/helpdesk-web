import type { ReactNode } from "react";

import { PortalShell } from "@/shared";
import { helpdeskConfig } from "./config";

export function HelpdeskLayout({ children }: { children: ReactNode }) {
  return <PortalShell config={helpdeskConfig}>{children}</PortalShell>;
}
