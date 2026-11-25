import { useId, useState } from "react";
import { Send, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWrite } from "../api/client";
import type { ApiTicket } from "../api/types";
import { Field } from "./Field";

const scores = [1, 2, 3, 4, 5];
const ratingLabels = [
  "Chọn số sao",
  "Rất không hài lòng",
  "Chưa hài lòng",
  "Bình thường",
  "Hài lòng",
  "Rất hài lòng",
];
const quickTags = [
  "Phản hồi nhanh",
  "Thân thiện",
  "Giải thích dễ hiểu",
  "Xử lý triệt để",
  "Cần cải thiện",
];
const maxFeedbackLength = 2000;

export function FeedbackStars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} trên 5 sao`} className="inline-flex gap-1">
      {scores.map((score) => (
        <Star
          key={score}
          aria-hidden="true"
          className={cn(
            "size-3.5",
            score <= rating ? "fill-warning text-warning" : "text-muted-foreground/35",
          )}
        />
      ))}
    </span>
  );
}

export function TicketFeedbackForm({
  ticket,
  onSaved,
}: {
  ticket: Pick<ApiTicket, "id" | "assignee">;
  onSaved?: () => void;
}) {
  const write = useWrite();
  const ratingName = useId();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const feedback = [...tags, comment.trim()].filter(Boolean).join(". ");
  const overLimit = feedback.length > maxFeedbackLength;

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!rating || pending || overLimit) return;
        setPending(true);
        try {
          await write(`/tickets/${encodeURIComponent(ticket.id)}/feedback`, {
            rating,
            comment: feedback,
          });
          toast.success("Đã lưu đánh giá.");
          onSaved?.();
        } catch {
          // The API client shows the error and the form retains the draft.
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-5">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-hero p-6">
          <p className="text-center text-sm font-semibold">
            Bạn hài lòng với hỗ trợ của {ticket.assignee || "phòng CNTT"}?
          </p>
          <div role="radiogroup" aria-label="Số sao" className="flex gap-1">
            {scores.map((score) => (
              <label key={score} className="cursor-pointer rounded-md p-1">
                <input
                  type="radio"
                  name={ratingName}
                  value={score}
                  aria-label={`${score} sao`}
                  checked={rating === score}
                  onChange={() => setRating(score)}
                  className="peer sr-only"
                />
                <Star
                  aria-hidden="true"
                  className={cn(
                    "size-7 rounded-sm transition-transform hover:scale-110 peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                    score <= rating ? "fill-warning text-warning" : "text-muted-foreground/35",
                  )}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {ratingLabels[rating]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickTags.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setTags((current) =>
                    selected ? current.filter((item) => item !== tag) : [...current, tag],
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  selected
                    ? "border-primary/40 bg-primary-soft text-primary"
                    : "border-border hover:bg-surface",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <Field label="Góp ý thêm">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            maxLength={maxFeedbackLength}
            placeholder="Chia sẻ trải nghiệm của bạn…"
            className="field h-auto resize-none py-3"
          />
        </Field>
        {overLimit && (
          <p role="alert" className="text-sm text-danger">
            Góp ý và nhãn đã chọn vượt quá 2.000 ký tự.
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="brand" disabled={!rating || pending || overLimit}>
            <Send /> {pending ? "Đang gửi…" : "Gửi đánh giá"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function TicketFeedbackAction({ ticket }: { ticket: ApiTicket }) {
  const [open, setOpen] = useState(false);
  if (ticket.status !== "Đã đóng") return "—";
  if (ticket.rating !== null) return <FeedbackStars rating={ticket.rating} />;

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="whitespace-nowrap">
            <Star /> Đánh giá
          </Button>
        </DialogTrigger>
        <DialogContent className="portal-end-user max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-[20px]">
          <DialogHeader>
            <DialogTitle>Đánh giá Ticket {ticket.id}</DialogTitle>
            <DialogDescription>{ticket.title}</DialogDescription>
          </DialogHeader>
          <TicketFeedbackForm ticket={ticket} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
