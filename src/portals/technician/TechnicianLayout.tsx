import type { ReactNode } from "react";

import { PortalShell } from "@/shared";
import { technicianConfig } from "./config";

export function TechnicianLayout({ children }: { children: ReactNode }) {
  return <PortalShell config={technicianConfig}>{children}</PortalShell>;
}
