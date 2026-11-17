import { usePortalData, useActions, useWrite } from "@/shared";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, Paperclip, Send, UploadCloud } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/shared";
import { cn } from "@/shared";
import { Field, PageHeader, SectionCard, type TicketPriority } from "@/shared";

const priorities: { value: TicketPriority; hint: string }[] = [
  { value: "Thấp", hint: "Không ảnh hưởng công việc" },
  { value: "Trung bình", hint: "Ảnh hưởng một phần" },
  { value: "Cao", hint: "Không làm việc được" },
  { value: "Khẩn cấp", hint: "Ảnh hưởng nhiều người" },
];

export function EndUserNewRequestPage() {
  const { articles, categories, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const navigate = useNavigate();
  const [priority, setPriority] = useState<TicketPriority>("Trung bình");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const suggestions =
    title.trim().length > 2
      ? articles.filter((a) =>
          a.title
            .toLowerCase()
            .split(" ")
            .some((w) => w.length > 3 && title.toLowerCase().includes(w)),
        )
      : [];

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    try {
      const ticket = await write<{ id: string }>("/tickets", {
        title,
        description: form.get("description"),
        category: form.get("category"),
        priority,
        assetId: form.get("assetId") || null,
      });
      if (file) {
        const body = new FormData();
        body.set("file", file);
        try {
          await write("/tickets/" + ticket.id + "/attachments", body);
        } catch {
          toast.error(
            "Ticket " + ticket.id + " đã được tạo; tệp chưa lưu được. Mở Ticket để tải lại tệp.",
          );
        }
      }
      toast.success("Đã tạo yêu cầu " + ticket.id);
      void navigate({ to: "/end-user/tickets" });
    } catch {
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cá nhân"
        title="Tạo yêu cầu hỗ trợ"
        description="Mô tả vấn đề càng rõ, Helpdesk càng xử lý nhanh."
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard className="xl:col-span-8">
          <form onSubmit={submit} className="space-y-5">
            <Field label="Tiêu đề">
              <input
                required
                name="title"
                minLength={5}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Không đăng nhập được Outlook"
                className="field"
              />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Loại yêu cầu">
                <select name="category" className="field" defaultValue={categories[0]}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Thiết bị liên quan" hint="Dữ liệu hiện tại">
                <select name="assetId" className="field">
                  <option value="">Không liên kết thiết bị</option>
                  {workspace.assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} · {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-semibold">Mức độ ảnh hưởng</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      priority === p.value
                        ? "border-primary/40 bg-primary-soft shadow-soft"
                        : "border-border hover:bg-surface",
                    )}
                  >
                    <p className={cn("text-sm font-bold", priority === p.value && "text-primary")}>
                      {p.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{p.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Mô tả chi tiết">
              <textarea
                required
                name="description"
                minLength={10}
                maxLength={10000}
                rows={5}
                placeholder="Lỗi xảy ra khi nào, thông báo lỗi là gì, bạn đã thử những gì..."
                className="field h-auto resize-none py-3"
              />
            </Field>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && f.size <= 5242880) setFile(f);
                else toast.error("Tệp vượt quá 5 MB.");
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-surface/60 p-6 text-center"
            >
              <UploadCloud className="size-7 text-primary" />
              <p className="text-sm font-semibold">Kéo thả ảnh chụp màn hình vào đây</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, PDF, TXT · tối đa 5 MB</p>
              <input
                id="request-file"
                aria-label="Tệp đính kèm yêu cầu"
                type="file"
                accept="image/png,image/jpeg,application/pdf,text/plain"
                className="mt-2 max-w-full text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 5242880) {
                    toast.error("Tệp vượt quá 5 MB.");
                    return;
                  }
                  setFile(f || null);
                }}
              />
              {file && <span className="text-sm text-primary">{file.name}</span>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById("request-file")?.click()}
              >
                <Paperclip /> Đính kèm tệp
              </Button>
              <div className="flex gap-2">
                <Button
                  type="reset"
                  variant="outline"
                  onClick={() => {
                    setTitle("");
                    setPriority("Trung bình");
                    setFile(null);
                  }}
                >
                  Làm lại
                </Button>
                <Button type="submit" variant="brand" disabled={pending}>
                  <Send /> Gửi yêu cầu
                </Button>
              </div>
            </div>
          </form>
        </SectionCard>

        <div className="space-y-5 xl:col-span-4">
          <SectionCard
            title="Có thể bạn tự xử lý được"
            description={
              suggestions.length ? "Gợi ý theo tiêu đề bạn nhập" : "Hướng dẫn được xem nhiều nhất"
            }
          >
            <ul className="space-y-2">
              {(suggestions.length ? suggestions : articles.filter((a) => a.popular))
                .slice(0, 4)
                .map((a) => (
                  <li
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => actions.openDocument(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") actions.openDocument(a.id);
                    }}
                    className="flex gap-3 rounded-xl border border-border/70 p-3"
                  >
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.minutes} phút đọc · {a.views} lượt xem
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </SectionCard>
          <SectionCard title="Cam kết thời gian phản hồi">
            <ul className="space-y-2 text-sm">
              {[
                ["Khẩn cấp", "15 phút"],
                ["Cao", "30 phút"],
                ["Trung bình", "2 giờ"],
                ["Thấp", "1 ngày làm việc"],
              ].map(([k, v]) => (
                <li key={k} className="flex justify-between rounded-lg bg-surface px-3 py-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
