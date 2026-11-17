import { usePortalData, useActions, useWrite } from "@/shared";
import { Send, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared";
import { cn } from "@/shared";
import {
  DonutChart,
  Field,
  PageHeader,
  ProgressList,
  SectionCard,
  chartColors as c,
} from "@/shared";

const quickTags = [
  "Phản hồi nhanh",
  "Thân thiện",
  "Giải thích dễ hiểu",
  "Xử lý triệt để",
  "Cần cải thiện",
];

function Stars({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} sao`}
          className="disabled:cursor-default"
        >
          <Star
            className={cn(
              size === "sm" ? "size-3.5" : "size-7 transition-transform hover:scale-110",
              n <= value ? "fill-warning text-warning" : "text-muted-foreground/35",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function EndUserFeedbackPage() {
  const { feedbackHistory, pendingFeedback, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const ticket = pendingFeedback[0];
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState(""),
    [pending, setPending] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Hỗ trợ"
        title="Phản hồi & đánh giá"
        description="Ý kiến của bạn giúp phòng CNTT hỗ trợ tốt hơn."
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Đánh giá yêu cầu vừa giải quyết"
          description={ticket ? `${ticket.id} · ${ticket.title}` : "Không có yêu cầu chờ đánh giá"}
          className="xl:col-span-7"
        >
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rating) {
                toast.error("Vui lòng chọn số sao");
                return;
              }
              if (!ticket) return;
              setPending(true);
              try {
                await write("/tickets/" + ticket.id + "/feedback", {
                  rating,
                  comment: [...tags, comment].filter(Boolean).join(". "),
                });
                toast.success("Đã lưu đánh giá.");
                setRating(0);
                setTags([]);
                setComment("");
              } catch {
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-hero p-6">
              <p className="text-sm font-semibold">
                Bạn hài lòng với hỗ trợ của {ticket?.assignee ?? "chúng tôi"}?
              </p>
              <Stars value={rating} onChange={setRating} />
              <p className="text-xs text-muted-foreground">
                {
                  [
                    "Chọn số sao",
                    "Rất không hài lòng",
                    "Chưa hài lòng",
                    "Bình thường",
                    "Hài lòng",
                    "Rất hài lòng",
                  ][rating]
                }
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((t) => {
                const on = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                      on
                        ? "border-primary/40 bg-primary-soft text-primary"
                        : "border-border hover:bg-surface",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <Field label="Góp ý thêm">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Chia sẻ trải nghiệm của bạn..."
                className="field h-auto resize-none py-3"
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" variant="brand" disabled={!ticket || pending}>
                <Send /> Gửi đánh giá
              </Button>
            </div>
          </form>
        </SectionCard>

        <div className="space-y-5 xl:col-span-5">
          <SectionCard
            title="Đánh giá của bạn"
            description={`${feedbackHistory.length} lượt đánh giá`}
          >
            <DonutChart
              centerValue={stats.rating}
              centerLabel="Điểm TB"
              data={[
                ...[5, 4, 3, 2, 1].map((rating, i) => ({
                  name: rating + " sao",
                  value: feedbackHistory.filter((f) => f.rating === rating).length,
                  color: [c.violet, c.blue, c.cyan, c.orange, c.pink][i]!,
                })),
              ]}
            />
          </SectionCard>
          <SectionCard title="Kết quả hỗ trợ của bạn">
            <ProgressList
              rows={[
                { label: "Đúng hạn SLA", value: stats.sla },
                {
                  label: "Đánh giá hài lòng",
                  value: feedbackHistory.length
                    ? Math.round(
                        (feedbackHistory.filter((f) => f.rating >= 4).length /
                          feedbackHistory.length) *
                          100,
                      )
                    : 0,
                  tone: "success",
                },
                {
                  label: "Đã đóng",
                  value: stats.total ? Math.round((stats.closed / stats.total) * 100) : 0,
                  tone: "info",
                },
              ]}
            />
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Lịch sử đánh giá" className="mt-5">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {feedbackHistory.map((f) => (
            <li key={f.id} className="rounded-xl border border-border/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">{f.id}</span>
                <Stars value={f.rating} size="sm" />
              </div>
              <p className="mt-1 text-sm font-semibold">{f.title}</p>
              <p className="mt-2 text-xs text-muted-foreground">“{f.comment}”</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{f.date}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
