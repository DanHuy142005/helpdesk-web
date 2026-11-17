import { useState, type ReactNode } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PortalConfig } from "../types";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AccessGate } from "../api/AccessGate";
import { useWorkspace } from "../api/client";

/**
 * Shared app frame (sidebar + top bar + content) used by every portal.
 * Each portal passes its own config, so brand, menu and accent stay independent.
 */
export function PortalShell({ config, children }: { config: PortalConfig; children: ReactNode }) {
  return (
    <AccessGate role={config.id}>
      <AuthenticatedShell config={config}>{children}</AuthenticatedShell>
    </AccessGate>
  );
}

function AuthenticatedShell({
  config: baseConfig,
  children,
}: {
  config: PortalConfig;
  children: ReactNode;
}) {
  const { data } = useWorkspace();
  const user = data!.user;
  const config: PortalConfig = {
    ...baseConfig,
    user: {
      name: user.name,
      initials: user.name
        .split(" ")
        .slice(-2)
        .map((n) => n[0])
        .join(""),
      role: user.position || user.role,
    },
    greeting: {
      title: `Xin chào, ${user.name.split(" ").at(-1)}`,
      subtitle: `${data!.tickets.filter((t) => !["Đã đóng", "Đã giải quyết"].includes(t.status)).length} Ticket đang mở`,
    },
    nav: baseConfig.nav.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const count = item.to.includes("queue")
          ? data!.tickets.filter((t) => t.status === "Mới").length
          : item.to.includes("assigned")
            ? data!.tickets.filter((t) => !["Đã đóng", "Đã giải quyết"].includes(t.status)).length
            : item.to.includes("tickets")
              ? data!.tickets.length
              : null;
        const { badge, ...rest } = item;
        return count === null ? rest : { ...rest, badge: String(count) };
      }),
    })),
    ...(baseConfig.promo
      ? {
          promo: {
            ...baseConfig.promo,
            title: "Thông tin hệ thống",
            text: `${data!.tickets.length} Ticket trong phạm vi truy cập của bạn.`,
          },
        }
      : {}),
  };
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn(config.themeClass, "min-h-screen")}>
      <div className="mx-auto flex w-full max-w-[1680px] gap-5 p-3 sm:p-4 lg:p-5">
        <aside
          className={cn(
            "sticky top-5 hidden h-[calc(100vh-2.5rem)] shrink-0 transition-[width] duration-300 lg:block",
            collapsed ? "w-[84px]" : "w-[264px]",
          )}
        >
          <Sidebar config={config} collapsed={collapsed} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Topbar
            config={config}
            onToggleSidebar={() => setCollapsed((c) => !c)}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <main className="animate-rise min-w-0 flex-1 pb-6">{children}</main>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className={cn(config.themeClass, "w-[288px] border-none bg-transparent p-3 shadow-none")}
        >
          <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
          <Sidebar config={config} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
