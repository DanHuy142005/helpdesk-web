import { usePortalData, useActions, useWrite } from "@/shared";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Clock3,
  Eye,
  KeyRound,
  Mail,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  Wifi,
  AppWindow,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared";
import { cn } from "@/shared";
import { IconTile, PageHeader, SectionCard, type Tone } from "@/shared";

const catIcon = [KeyRound, Mail, Wifi, Printer, AppWindow, ShieldCheck];
const catTone: Tone[] = ["primary", "info", "cyan", "warning", "lavender", "success"];

export function EndUserKnowledgePage() {
  const { articles, kbCategories, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const list = articles.filter(
    (a) =>
      (!cat || a.category === cat) && (!q || `${a.title} ${a.summary}`.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Hỗ trợ"
        title="Kho hướng dẫn"
        description="Tự xử lý nhanh các sự cố CNTT thường gặp."
      />

      <section className="relative overflow-hidden rounded-card border border-card bg-knowledge p-6 shadow-card sm:p-8">
        <div className="relative max-w-xl">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> {articles.length} bài hướng dẫn
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">Bạn cần giúp gì hôm nay?</h2>
          <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-card bg-card px-4 shadow-soft">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="VD: mật khẩu, VPN, máy in..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kbCategories.map((k, i) => (
          <button
            key={k.name}
            type="button"
            onClick={() => setCat(cat === k.name ? null : k.name)}
            className={cn(
              "card-surface flex flex-col items-start gap-3 p-4 text-left transition-all hover:-translate-y-0.5",
              cat === k.name && "border-primary/40 ring-4 ring-primary/10",
            )}
          >
            <IconTile icon={catIcon[i] ?? BookOpen} tone={catTone[i] ?? "primary"} />
            <div>
              <p className="text-sm font-bold">{k.name}</p>
              <p className="text-[11px] text-muted-foreground">{k.count} bài viết</p>
            </div>
          </button>
        ))}
      </div>

      <SectionCard
        title={cat ?? "Tất cả hướng dẫn"}
        description={`${list.length} bài viết`}
        actions={
          cat && (
            <Button variant="ghost" size="sm" onClick={() => setCat(null)}>
              Bỏ lọc
            </Button>
          )
        }
      >
        {list.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Chưa có hướng dẫn phù hợp.</p>
            <Button variant="brand" size="sm" className="mt-3" asChild>
              <Link to="/end-user/new-request">Gửi yêu cầu hỗ trợ</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {list.map((a) => (
              <li
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => actions.openDocument(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") actions.openDocument(a.id);
                }}
                className="group rounded-xl border border-border/70 p-4 transition-all hover:border-primary/30 hover:bg-surface/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-primary">{a.category}</span>
                  {a.popular && (
                    <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                      Phổ biến
                    </span>
                  )}
                </div>
                <p className="mt-1 font-semibold group-hover:text-primary">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.summary}</p>
                <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3" /> {a.minutes} phút đọc
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" /> {a.views}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
