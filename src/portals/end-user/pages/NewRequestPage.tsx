import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Send } from "lucide-react";
import {
  AttachmentPicker,
  Button,
  Field,
  PageHeader,
  SectionCard,
  cn,
  useActions,
  usePortalData,
  useWrite,
  type TicketPriority,
} from "@/shared";

const priorities: { value: TicketPriority; hint: string }[] = [
  { value: "Thấp", hint: "Không ảnh hưởng công việc" },
  { value: "Trung bình", hint: "Ảnh hưởng một phần" },
  { value: "Cao", hint: "Không làm việc được" },
  { value: "Khẩn cấp", hint: "Ảnh hưởng nhiều người" },
];

export function EndUserNewRequestPage() {
  const { categories } = usePortalData();
  const actions = useActions(),
    write = useWrite(),
    navigate = useNavigate();
  const [priority, setPriority] = useState<TicketPriority>("Trung bình"),
    [title, setTitle] = useState(""),
    [pending, setPending] = useState(false),
    [files, setFiles] = useState<File[]>([]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    form.set("priority", priority);
    files.forEach((file) => form.append("files", file));
    setPending(true);
    try {
      const ticket = await write<{ id: string }>("/tickets", form);
      actions.notify(
        "Đã gửi yêu cầu hỗ trợ",
        "Yêu cầu " + ticket.id + " đã được ghi nhận. Bộ phận CNTT sẽ phản hồi bạn sớm nhất có thể.",
      );
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
        description="Mô tả vấn đề và đính kèm ảnh để bộ phận CNTT hỗ trợ bạn."
      />
      <SectionCard className="mx-auto max-w-5xl">
        <form onSubmit={submit} className="space-y-5">
          <Field label="Tiêu đề">
            <input
              required
              name="title"
              minLength={5}
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="VD: Không đăng nhập được Outlook"
              className="field"
              disabled={pending}
            />
          </Field>
          <Field label="Loại yêu cầu">
            <select
              name="category"
              className="field"
              defaultValue={categories[0]}
              disabled={pending}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <div className="space-y-2">
            <span className="text-sm font-semibold">Mức độ ảnh hưởng</span>
            <div className="grid gap-2 sm:grid-cols-4">
              {priorities.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={pending}
                  onClick={() => setPriority(item.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    priority === item.value
                      ? "border-primary/40 bg-primary-soft shadow-soft"
                      : "border-border hover:bg-surface",
                  )}
                >
                  <p className={cn("text-sm font-bold", priority === item.value && "text-primary")}>
                    {item.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{item.hint}</p>
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
              placeholder="Lỗi xảy ra khi nào, thông báo lỗi là gì, bạn đã thử những gì…"
              className="field h-auto resize-none py-3"
              disabled={pending}
            />
          </Field>
          <AttachmentPicker files={files} onChange={setFiles} disabled={pending} />
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="reset"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setTitle("");
                setPriority("Trung bình");
                setFiles([]);
              }}
            >
              Làm lại
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              <Send /> {pending ? "Đang gửi…" : "Gửi yêu cầu"}
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
