import type { ReactNode } from "react";

import { PortalShell } from "@/shared";
import { endUserConfig } from "./config";

export function EndUserLayout({ children }: { children: ReactNode }) {
  return <PortalShell config={endUserConfig}>{children}</PortalShell>;
}
