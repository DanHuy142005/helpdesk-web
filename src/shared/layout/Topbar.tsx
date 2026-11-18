import { Bell, CalendarDays, Menu, PanelLeft, RefreshCw, Search } from "lucide-react";

import type { PortalConfig } from "../types";
import { UserAvatar } from "../components/UserAvatar";
import { useActions } from "../api/Actions";
import { logout, useWorkspace } from "../api/client";
import { useState } from "react";

interface TopbarProps {
  config: PortalConfig;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}

export function Topbar({ config, onToggleSidebar, onOpenMobile }: TopbarProps) {
  const actions = useActions();
  const workspace = useWorkspace();
  const [search, setSearch] = useState("");
  return (
    <header className="flex items-stretch gap-3">
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Mở menu"
        className="card-surface grid w-12 place-items-center text-muted-foreground lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Thu gọn menu"
        className="card-surface hidden w-12 place-items-center text-muted-foreground transition-colors hover:text-primary lg:grid"
      >
        <PanelLeft className="size-5" />
      </button>

      <div className="card-surface hidden min-w-0 flex-col justify-center px-5 py-2.5 md:flex">
        <p className="truncate text-sm font-bold text-foreground">{config.greeting.title}</p>
        <p className="truncate text-xs text-muted-foreground">{config.greeting.subtitle}</p>
      </div>

      <label className="card-surface flex min-w-0 flex-1 items-center gap-3 px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          aria-label="Tìm kiếm toàn hệ thống"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") actions.openPanel({ type: "search", query: search });
          }}
          type="search"
          placeholder={config.searchPlaceholder}
          className="h-12 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
          Enter
        </kbd>
      </label>

      <button
        type="button"
        onClick={() => void workspace.refetch()}
        className="card-surface hidden items-center gap-3 px-4 text-left xl:flex"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-surface text-muted-foreground">
          <RefreshCw className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Đồng bộ</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {workspace.isFetching ? "Đang tải…" : workspace.error ? "Lỗi kết nối" : "Đã đồng bộ"}{" "}
            <span className="size-1.5 rounded-full bg-success" />
          </p>
        </div>
      </button>

      <div className="card-surface hidden items-center gap-1 px-2 sm:flex">
        <IconButton label="Lịch" onClick={() => actions.openPanel({ type: "calendar" })}>
          <CalendarDays className="size-[18px]" />
        </IconButton>
        <IconButton
          label="Thông báo"
          dot={!!workspace.data?.notifications.some((n) => !n.read_at)}
          onClick={() => actions.openPanel({ type: "notifications" })}
        >
          <Bell className="size-[18px]" />
        </IconButton>
      </div>

      <div className="card-surface flex items-center gap-3 px-2 sm:px-3">
        <UserAvatar name={config.user.name} initials={config.user.initials} size="md" />
        <div className="hidden pr-2 leading-tight lg:block">
          <p className="text-sm font-bold">{config.user.name}</p>
          <p className="text-[11px] text-muted-foreground">{config.user.role}</p>
        </div>
        <details className="relative">
          <summary
            className="cursor-pointer p-2 text-xs font-semibold text-primary"
            aria-label="Tài khoản"
          >
            ⋯
          </summary>
          <div
            onClick={(e) => {
              const details = e.currentTarget.closest("details");
              if (details) details.open = false;
            }}
            className="card-surface absolute right-0 top-9 z-50 w-44 p-2 shadow-card"
          >
            <button
              className="w-full rounded-lg p-2 text-left text-sm hover:bg-surface"
              onClick={() => actions.openPanel({ type: "password" })}
            >
              Đổi mật khẩu
            </button>
            {workspace.data?.user.role !== "end-user" && (
              <button
                className="w-full rounded-lg p-2 text-left text-sm hover:bg-surface"
                onClick={() => actions.editEntity("documents")}
              >
                Soạn tài liệu kỹ thuật
              </button>
            )}
            {workspace.data?.user.role === "admin" && (
              <button
                className="w-full rounded-lg p-2 text-left text-sm hover:bg-surface"
                onClick={() => actions.openPanel({ type: "audit" })}
              >
                Lịch sử thao tác
              </button>
            )}
            <button
              className="w-full rounded-lg p-2 text-left text-sm text-danger hover:bg-surface"
              onClick={() => void logout().then(() => window.location.assign("/"))}
            >
              Đăng xuất
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}

function IconButton({
  label,
  dot,
  children,
  onClick,
}: {
  label: string;
  dot?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-surface hover:text-primary"
    >
      {children}
      {dot && (
        <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger ring-2 ring-card" />
      )}
    </button>
  );
}
