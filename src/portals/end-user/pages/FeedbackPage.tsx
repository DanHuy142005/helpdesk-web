import { useState } from "react";
import {
  DonutChart,
  FeedbackStars,
  Field,
  PageHeader,
  ProgressList,
  SectionCard,
  TicketFeedbackForm,
  chartColors as c,
  usePortalData,
} from "@/shared";

export function EndUserFeedbackPage() {
  const { feedbackHistory, pendingFeedback, stats } = usePortalData();
  const [selectedId, setSelectedId] = useState("");
  const ticket = pendingFeedback.find((item) => item.id === selectedId);

  return (
    <div>
      <PageHeader
        eyebrow="Hỗ trợ"
        title="Phản hồi & đánh giá"
        description="Ý kiến của bạn giúp phòng CNTT hỗ trợ tốt hơn."
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SectionCard
          title="Đánh giá yêu cầu đã đóng"
          description="Chọn yêu cầu mà bạn muốn đánh giá."
          className="xl:col-span-7"
        >
          {pendingFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có yêu cầu chờ đánh giá.</p>
          ) : (
            <div className="space-y-5">
              <Field label="Chọn Ticket cần đánh giá">
                <select
                  className="field"
                  value={ticket?.id ?? ""}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">Chọn một Ticket</option>
                  {pendingFeedback.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} · {item.title}
                    </option>
                  ))}
                </select>
              </Field>
              {ticket && <TicketFeedbackForm key={ticket.id} ticket={ticket} />}
            </div>
          )}
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
                <FeedbackStars rating={f.rating} />
              </div>
              <p className="mt-1 text-sm font-semibold">{f.title}</p>
              {f.comment && (
                <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  “{f.comment}”
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">{f.date}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
