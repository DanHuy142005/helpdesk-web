import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Text used for the built-in search box; omit to hide search. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  totalLabel?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string;
  tableClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  searchText,
  searchPlaceholder = "Tìm kiếm...",
  toolbar,
  totalLabel,
  onRowClick,
  selectedKey,
  tableClassName,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    if (!searchText || !query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => searchText(r).toLowerCase().includes(q));
  }, [rows, query, searchText]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  useEffect(() => setPage(1), [query]);

  const align = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div>
      {(searchText || toolbar) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchText ? (
            <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 sm:max-w-xs">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          ) : (
            <span />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="scrollbar-thin overflow-x-auto">
        <table
          className={cn(
            "w-full min-w-[720px] border-separate border-spacing-0 text-sm",
            tableClassName,
          )}
        >
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  className={cn(
                    "bg-surface px-4 py-3 text-xs font-semibold text-muted-foreground",
                    i === 0 && "rounded-l-xl",
                    i === columns.length - 1 && "rounded-r-xl",
                    align(c.align),
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const key = getRowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && e.key === "Enter" && e.target === e.currentTarget)
                      onRowClick(row);
                  }}
                  className={cn(
                    "transition-colors hover:bg-surface/70",
                    onRowClick && "cursor-pointer",
                    selectedKey === key && "bg-primary-soft/60",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-border/70 px-4 py-3.5 text-foreground/90",
                        align(c.align),
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  Không tìm thấy dữ liệu phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Hiển thị {filtered.length ? (currentPage - 1) * 10 + 1 : 0}–
          {Math.min(currentPage * 10, filtered.length)} / {filtered.length}{" "}
          {totalLabel || "bản ghi"}
        </span>
        <div className="flex items-center gap-1">
          <PageBtn disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
            <ChevronLeft className="size-3.5" />
          </PageBtn>
          {Array.from({ length: pageCount }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 1)
            .map((n) => (
              <PageBtn key={n} active={n === currentPage} onClick={() => setPage(n)}>
                {n}
              </PageBtn>
            ))}
          <PageBtn disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
            <ChevronRight className="size-3.5" />
          </PageBtn>
        </div>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg font-semibold transition-colors",
        active ? "bg-brand text-primary-foreground shadow-glow" : "hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}
