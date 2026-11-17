import type { LucideIcon } from "lucide-react";
import type { FileRoutesByTo } from "@/routeTree.gen";

/** Any real page path of the app — keeps sidebar links type-safe. */
export type AppPath = keyof FileRoutesByTo;

export interface NavChild {
  label: string;
  to: AppPath;
}

export interface NavItem {
  label: string;
  to: AppPath;
  icon: LucideIcon;
  /** Match the path exactly (use for portal home pages). */
  exact?: boolean;
  badge?: string;
  children?: NavChild[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface PortalConfig {
  id: "admin" | "helpdesk" | "technician" | "end-user";
  /** CSS class in styles.css that sets the portal's brand accent. */
  themeClass: string;
  homeTo: AppPath;
  brand: { name: string; product: string; icon: LucideIcon };
  user: { name: string; role: string; initials: string };
  greeting: { title: string; subtitle: string };
  searchPlaceholder: string;
  nav: NavGroup[];
  promo?: { title: string; text: string; cta: string; to: AppPath };
}
