import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { NavItem, PortalConfig } from "../types";

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = pathname.replace(/\/$/, "") || "/";
  return (to: string, exact?: boolean) =>
    exact ? current === to : current === to || current.startsWith(`${to}/`);
}

interface SidebarProps {
  config: PortalConfig;
  collapsed?: boolean;
  onNavigate?: (() => void) | undefined;
}

export function Sidebar({ config, collapsed = false, onNavigate }: SidebarProps) {
  const Brand = config.brand.icon;

  return (
    <div className="card-surface flex h-full flex-col bg-sidebar p-3">
      <Link
        to={config.homeTo}
        onClick={onNavigate}
        className={cn("flex items-center gap-3 px-2 pb-5 pt-2", collapsed && "justify-center px-0")}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-primary-foreground shadow-glow">
          <Brand className="size-5" />
        </span>
        {!collapsed && (
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold text-gradient">
              {config.brand.name}
            </span>
            <span className="block text-[11px] font-medium text-muted-foreground">
              {config.brand.product}
            </span>
          </span>
        )}
      </Link>

      <nav className="scrollbar-thin -mx-1 flex-1 space-y-5 overflow-y-auto px-1">
        {config.nav.map((group) => (
          <div key={group.title}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" />
            ) : (
              <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                {group.title}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {config.promo && !collapsed && (
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-hero p-4">
          <div className="absolute -right-6 -top-6 size-20 rounded-full bg-brand opacity-30 blur-xl" />
          <p className="relative text-sm font-bold text-foreground">{config.promo.title}</p>
          <p className="relative mt-1 text-xs leading-relaxed text-muted-foreground">
            {config.promo.text}
          </p>
          <Link
            to={config.promo.to}
            onClick={onNavigate}
            className="relative mt-3 inline-flex items-center gap-1 rounded-lg bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-soft"
          >
            {config.promo.cta} <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const isActive = useIsActive();
  const Icon = item.icon;
  const childActive = item.children?.some((c) => isActive(c.to)) ?? false;
  const active = item.children ? childActive : isActive(item.to, item.exact);
  const [open, setOpen] = useState(childActive);

  const base = cn(
    "group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all",
    collapsed && "justify-center px-0",
    active
      ? "border border-primary/10 bg-primary-soft text-accent-foreground shadow-soft"
      : "border border-transparent text-sidebar-foreground hover:bg-surface hover:text-foreground",
  );
  const icon = (
    <Icon
      className={cn(
        "size-[18px] shrink-0 transition-colors",
        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
      )}
    />
  );

  if (item.children && !collapsed) {
    return (
      <li>
        <button type="button" onClick={() => setOpen((o) => !o)} className={base}>
          {icon}
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <ul className="relative ml-[21px] mt-1 space-y-0.5 border-l border-border pl-3">
            {item.children.map((child) => {
              const on = isActive(child.to);
              return (
                <li key={child.to} className="relative">
                  <span className="absolute -left-3 top-1/2 h-px w-2.5 bg-border" />
                  <Link
                    to={child.to}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-[13px] transition-colors",
                      on
                        ? "bg-surface font-semibold text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        to={item.children?.[0]?.to ?? item.to}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={base}
      >
        {icon}
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
