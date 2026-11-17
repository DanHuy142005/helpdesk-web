import { usePortalData, useActions, useWrite } from "@/shared";
import {
  CheckCircle2,
  Clock3,
  Cpu,
  HardDrive,
  MemoryStick,
  Pause,
  Plus,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type TicketDetail } from "@/shared";

import { Button } from "@/shared";
import { cn } from "@/shared";
import {
  Field,
  PageHeader,
  PriorityBadge,
  ProgressBar,
  SectionCard,
  StatusBadge,
  UserAvatar,
} from "@/shared";

const steps = ["Tiếp nhận", "Chẩn đoán", "Khắc phục", "Kiểm thử", "Bàn giao"];

export function TechnicianInProgressPage() {
  const { devices, jobs, workLog, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const [selected, setSelected] = useState(""),
    [solution, setSolution] = useState(""),
    [cause, setCause] = useState("Chưa xác định"),
    [duration, setDuration] = useState(""),
    [pending, setPending] = useState(false);
  const job = jobs.find((j) => j.id === selected) || jobs[0];
  const details = useQuery({
    queryKey: ["ticket", job?.id],
    queryFn: () => api<TicketDetail>("/tickets/" + job!.id),
    enabled: !!job,
    refetchInterval: 3000,
  });
  if (!job)
    return (
      <SectionCard title="Ticket đang xử lý">
        Chưa có công việc đang mở được giao cho bạn.
      </SectionCard>
    );
  const device = devices.find((d) => d.code === job.device);
  const current = job.status === "Đã chuyển" ? 0 : job.status === "Chờ phản hồi" ? 1 : 2;
  async function act(action: string) {
    setPending(true);
    try {
      await write("/tickets/" + job!.id + "/actions", {
        action,
        version: job!.version,
        note:
          action === "resolve"
            ? `Nguyên nhân: ${cause}. Thời gian thực tế: ${duration || "Chưa ghi"}. Giải pháp: ${solution}`
            : solution,
      });
      toast.success("Đã cập nhật " + job!.id);
      setSolution("");
    } catch {
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Công việc"
        title="Ticket đang xử lý"
        description="Cập nhật tiến độ, ghi nhật ký và hoàn tất kết quả xử lý."
        actions={
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                void act(
                  job.status === "Đã chuyển"
                    ? "start"
                    : job.status === "Chờ phản hồi"
                      ? "resume"
                      : "wait",
                )
              }
            >
              <Pause />{" "}
              {job.status === "Đã chuyển"
                ? "Bắt đầu"
                : job.status === "Chờ phản hồi"
                  ? "Tiếp tục"
                  : "Tạm dừng"}
            </Button>
            <Button
              variant="brand"
              disabled={pending || solution.trim().length < 10 || job.status === "Đã chuyển"}
              onClick={() => void act("resolve")}
            >
              <CheckCircle2 /> Hoàn tất
            </Button>
          </>
        }
      />
      <select
        aria-label="Chọn Ticket đang xử lý"
        className="field mb-5"
        value={job.id}
        onChange={(e) => {
          setSelected(e.target.value);
          setSolution("");
        }}
      >
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.id} · {j.title}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <SectionCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-primary">{job.id}</p>
                <h2 className="mt-1 font-display text-xl font-bold">{job.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={job.status} />
                  <PriorityBadge priority={job.priority} />
                </div>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" /> Hạn SLA {job.due}
                </p>
                <p className="mt-1 font-display text-lg font-bold text-danger">{job.slaLeft}</p>
              </div>
            </div>

            <ol className="mt-6 grid grid-cols-5 gap-2">
              {steps.map((s, i) => (
                <li key={s} className="text-center">
                  <div
                    className={cn("h-1.5 rounded-full", i <= current ? "bg-brand" : "bg-surface")}
                  />
                  <p
                    className={cn(
                      "mt-2 text-[11px] font-semibold",
                      i <= current ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {s}
                  </p>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard
            title="Nhật ký xử lý"
            actions={
              <Button variant="soft" size="sm" onClick={() => actions.openTicket(job.id)}>
                <Plus /> Thêm ghi chú
              </Button>
            }
          >
            {details.data?.comments.map((comment) => (
              <div key={comment.id} className="mb-3 rounded-xl bg-surface p-3 text-sm">
                <b>{comment.author}</b>
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleString("vi-VN")}
                  {comment.internal ? " · Nội bộ" : ""}
                </span>
                <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))}
            <ol className="relative space-y-5 border-l border-border pl-5">
              {workLog
                .filter((l) => l.ticketId === job.id)
                .map((l, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-card bg-primary ring-4 ring-primary/15" />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold">{l.time}</span>
                      <span className="text-muted-foreground">· {l.by}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/85">{l.text}</p>
                  </li>
                ))}
            </ol>
          </SectionCard>

          <SectionCard title="Kết quả xử lý">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nguyên nhân gốc">
                <select className="field" value={cause} onChange={(e) => setCause(e.target.value)}>
                  <option>Chưa xác định</option>
                  <option>Ổ đĩa đầy dung lượng</option>
                  <option>Sai phân quyền</option>
                  <option>Lỗi kết nối mạng</option>
                  <option>Hỏng phần cứng</option>
                </select>
              </Field>
              <Field label="Thời gian xử lý thực tế">
                <input
                  className="field"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Ví dụ: 30 phút"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Giải pháp đã áp dụng">
                <textarea
                  aria-label="Giải pháp đã áp dụng"
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  rows={3}
                  className="field h-auto resize-none py-3"
                  placeholder="Mô tả giải pháp hoặc lý do tạm dừng..."
                />
              </Field>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <SectionCard title="Người yêu cầu">
            <div className="flex items-center gap-3">
              <UserAvatar name={job.requester} size="lg" />
              <div>
                <p className="font-bold">{job.requester}</p>
                <p className="text-xs text-muted-foreground">{job.location}</p>
                <p className="mt-1 text-xs text-muted-foreground">Giao bởi: {job.from}</p>
              </div>
            </div>
          </SectionCard>
          {device ? (
            <SectionCard title="Thiết bị liên quan">
              <div className="rounded-xl bg-hero p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-card text-primary shadow-soft">
                    <Server className="size-5" />
                  </span>
                  <div>
                    <p className="font-bold">{device.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {device.code} · {device.type}
                    </p>
                  </div>
                </div>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <Spec icon={Cpu} label="CPU" value={device.cpu} />
                <Spec icon={MemoryStick} label="RAM" value={device.ram} />
                <Spec icon={HardDrive} label="Lưu trữ" value={device.storage} />
              </dl>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-muted-foreground">Tình trạng thiết bị</span>
                  <span className="font-bold">{device.health}%</span>
                </div>
                <ProgressBar
                  value={device.health}
                  tone={device.health < 50 ? "danger" : device.health < 70 ? "warning" : "success"}
                />
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Thiết bị liên quan">Chưa liên kết thiết bị.</SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" /> {label}
      </dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
