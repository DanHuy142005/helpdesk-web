import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, useWorkspace, useWrite, downloadReport, logout } from "./client";
import type { Entity, TicketDetail, ApiAttachment, ApiDocument } from "./types";
import { StatusBadge, PriorityBadge } from "../components/StatusBadge";
import { Field } from "../components/Field";
import { categories } from "./data";

type Panel = {
  type:
    | "ticket"
    | "document"
    | "entity"
    | "search"
    | "notifications"
    | "calendar"
    | "audit"
    | "new-ticket"
    | "report"
    | "password";
  id?: string;
  entity?: Entity;
  query?: string;
};
interface Actions {
  openTicket: (id: string) => void;
  openDocument: (id: string) => void;
  editEntity: (entity: Entity, id?: string) => void;
  openPanel: (panel: Panel) => void;
  newTicket: () => void;
  exportReport: () => void;
  from: string;
  to: string;
}
const Context = createContext<Actions | null>(null);
export function useActions() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace actions unavailable");
  return value;
}
export function ActionsProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel | null>(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const actions: Actions = {
    openTicket: (id) => setPanel({ type: "ticket", id }),
    openDocument: (id) => setPanel({ type: "document", id }),
    editEntity: (entity, id) => setPanel({ type: "entity", entity, ...(id ? { id } : {}) }),
    openPanel: setPanel,
    newTicket: () => setPanel({ type: "new-ticket" }),
    exportReport: () => {
      void downloadReport(from, to).catch((e) => toast.error(e.message));
    },
    from,
    to,
  };
  return (
    <Context.Provider value={actions}>
      {children}
      <Dialog
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="portal-admin max-h-[90vh] overflow-y-auto rounded-[20px] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {panel?.type === "ticket"
                ? panel.id
                : panel?.type === "entity"
                  ? "Quản lý thông tin"
                  : panel?.type === "document"
                    ? "Tài liệu kỹ thuật"
                    : panel?.type === "new-ticket"
                      ? "Tạo Ticket"
                      : panel?.type === "report"
                        ? "Kỳ báo cáo"
                        : panel?.type === "password"
                          ? "Đổi mật khẩu"
                          : panel?.type === "search"
                            ? "Tìm kiếm"
                            : panel?.type === "audit"
                              ? "Lịch sử thao tác"
                              : panel?.type === "calendar"
                                ? "Lịch xử lý"
                                : "Thông báo"}
            </DialogTitle>
            <DialogDescription>
              Dữ liệu được đồng bộ giữa các cổng theo quyền truy cập của bạn.
            </DialogDescription>
          </DialogHeader>
          {panel?.type === "ticket" && panel.id && <TicketPanel key={panel.id} id={panel.id} />}
          {panel?.type === "document" && panel.id && <DocumentPanel key={panel.id} id={panel.id} />}
          {panel?.type === "entity" && panel.entity && (
            <EntityForm
              key={panel.entity + (panel.id || "new")}
              entity={panel.entity}
              id={panel.id}
              close={() => setPanel(null)}
            />
          )}
          {panel?.type === "new-ticket" && <NewTicketForm close={() => setPanel(null)} />}
          {panel?.type === "report" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (from && to && from > to) {
                  toast.error("Ngày bắt đầu phải trước ngày kết thúc.");
                  return;
                }
                setPanel(null);
              }}
            >
              <Field label="Từ ngày">
                <input
                  type="date"
                  className="field"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="Đến ngày">
                <input
                  type="date"
                  className="field"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Button variant="brand">Áp dụng</Button>
            </form>
          )}
          {panel?.type === "password" && <PasswordForm />}
          {panel && ["search", "notifications", "calendar", "audit"].includes(panel.type) && (
            <UtilityPanel panel={panel} />
          )}
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
export function FileList({ files }: { files: ApiAttachment[] }) {
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.id}>
          <a
            className="text-sm font-semibold text-primary underline"
            href={"/api/attachments/" + f.id}
          >
            {f.name} ({Math.ceil(f.size / 1024)} KB)
          </a>
        </li>
      ))}
    </ul>
  );
}
export function FileUpload({ entity, id }: { entity: "tickets" | "documents"; id: string }) {
  const write = useWrite();
  const [pending, setPending] = useState(false);
  return (
    <label className="block rounded-xl border border-dashed p-3 text-sm">
      Đính kèm PNG, JPG, PDF, TXT · tối đa 5 MB
      <input
        type="file"
        accept="image/png,image/jpeg,application/pdf,text/plain"
        disabled={pending}
        className="mt-2 block w-full text-xs"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 5242880) {
            toast.error("Tệp vượt quá 5 MB.");
            return;
          }
          const body = new FormData();
          body.set("file", file);
          setPending(true);
          try {
            await write(`/${entity}/${encodeURIComponent(id)}/attachments`, body);
            toast.success("Đã lưu tệp.");
          } catch {
          } finally {
            setPending(false);
          }
        }}
      />
    </label>
  );
}
function TicketPanel({ id }: { id: string }) {
  const { data: workspace } = useWorkspace(),
    write = useWrite();
  const query = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api<TicketDetail>("/tickets/" + encodeURIComponent(id)),
    refetchInterval: 3000,
  });
  const [note, setNote] = useState(""),
    [comment, setComment] = useState(""),
    [internal, setInternal] = useState(false),
    [tech, setTech] = useState(""),
    [pending, setPending] = useState(false);
  if (query.error)
    return (
      <p role="alert" className="text-danger">
        {query.error.message}
      </p>
    );
  const t = query.data;
  if (!t || !workspace) return <p>Đang tải…</p>;
  const user = workspace.user,
    owner = t.assignee_id === user.id;
  async function act(action: string) {
    setPending(true);
    try {
      await write("/tickets/" + id + "/actions", {
        action,
        version: t!.version,
        note,
        ...(tech ? { assigneeId: tech } : {}),
      });
      setNote("");
      toast.success("Đã cập nhật Ticket.");
    } catch {
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{t.title}</h2>
        <div className="my-3 flex flex-wrap gap-2">
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          <span className="text-sm text-muted-foreground">{t.category}</span>
        </div>
        <p className="whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm">{t.description}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.requester} · {t.department} · Phụ trách: {t.assignee || "Chưa phân công"} · Thiết bị:{" "}
          {t.asset_id || "Không có"}
        </p>
      </div>
      {t.solution && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <h3 className="font-bold">Kết quả xử lý</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">{t.solution}</p>
        </div>
      )}
      {t.status !== "Đã đóng" && (
        <section className="space-y-3 rounded-xl border p-4">
          <Field label="Ghi chú / kết quả / lý do chuyển">
            <textarea
              className="field h-auto py-3"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={10000}
            />
          </Field>
          {user.role === "helpdesk" && owner && (
            <Field label="Technician nhận chuyển">
              <select className="field" value={tech} onChange={(e) => setTech(e.target.value)}>
                <option value="">Chọn Technician</option>
                {workspace.users
                  .filter((u) => u.role === "technician" && u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            {user.role === "helpdesk" && t.status === "Mới" && (
              <Button disabled={pending} variant="brand" onClick={() => void act("accept")}>
                Tiếp nhận
              </Button>
            )}
            {user.role === "technician" && owner && t.status === "Đã chuyển" && (
              <Button disabled={pending} variant="brand" onClick={() => void act("start")}>
                Bắt đầu xử lý
              </Button>
            )}
            {["helpdesk", "technician"].includes(user.role) &&
              owner &&
              t.status === "Đang xử lý" && (
                <Button disabled={pending} variant="outline" onClick={() => void act("wait")}>
                  Chờ phản hồi
                </Button>
              )}
            {["helpdesk", "technician"].includes(user.role) &&
              owner &&
              t.status === "Chờ phản hồi" && (
                <Button disabled={pending} variant="outline" onClick={() => void act("resume")}>
                  Tiếp tục xử lý
                </Button>
              )}
            {["helpdesk", "technician"].includes(user.role) &&
              owner &&
              ["Đang xử lý", "Chờ phản hồi"].includes(t.status) && (
                <Button disabled={pending} variant="brand" onClick={() => void act("resolve")}>
                  Ghi kết quả giải quyết
                </Button>
              )}
            {user.role === "helpdesk" &&
              owner &&
              ["Đang xử lý", "Chờ phản hồi"].includes(t.status) && (
                <Button
                  disabled={pending || !tech}
                  variant="soft"
                  onClick={() => void act("escalate")}
                >
                  Chuyển Technician
                </Button>
              )}
            {t.requester_id === user.id && t.status === "Đã giải quyết" && (
              <>
                <Button disabled={pending} variant="brand" onClick={() => void act("confirm")}>
                  Xác nhận đóng Ticket
                </Button>
                <Button disabled={pending} variant="outline" onClick={() => void act("reopen")}>
                  Yêu cầu xử lý tiếp
                </Button>
              </>
            )}
          </div>
        </section>
      )}
      {user.role === "helpdesk" && ["Mới", "Đang xử lý", "Chờ phản hồi"].includes(t.status) && (
        <form
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            try {
              await write("/tickets/" + id + "/actions", {
                action: "classify",
                version: t.version,
                priority: data.get("priority"),
                category: data.get("category"),
                assetId: data.get("assetId") || null,
              });
              toast.success("Đã phân loại.");
            } catch {}
          }}
        >
          <select
            aria-label="Mức ưu tiên"
            name="priority"
            className="field"
            defaultValue={t.priority}
          >
            {["Khẩn cấp", "Cao", "Trung bình", "Thấp"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            aria-label="Loại yêu cầu"
            name="category"
            className="field"
            defaultValue={t.category}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Thiết bị liên quan"
            name="assetId"
            className="field"
            defaultValue={t.asset_id || ""}
          >
            <option value="">Không có thiết bị</option>
            {workspace.assets
              .filter((a) => a.owner_id === t.requester_id)
              .map((a) => (
                <option key={a.id}>{a.id}</option>
              ))}
          </select>
          <Button variant="outline">Lưu phân loại</Button>
        </form>
      )}
      <section>
        <h3 className="mb-3 font-bold">Trao đổi & ghi chú</h3>
        <ul className="space-y-2">
          {t.comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-surface p-3 text-sm">
              <b>{c.author}</b>
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("vi-VN")}
                {c.internal ? " · Nội bộ" : ""}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
        {t.status !== "Đã đóng" && (
          <form
            className="mt-3 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              try {
                await write("/tickets/" + id + "/comments", { body: comment, internal });
                setComment("");
                toast.success("Đã gửi phản hồi.");
              } catch {
              } finally {
                setPending(false);
              }
            }}
          >
            <textarea
              aria-label="Nội dung phản hồi"
              required
              className="field h-auto py-3"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={10000}
            />
            {user.role !== "end-user" && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                Ghi chú nội bộ (ẩn với End User)
              </label>
            )}
            <Button disabled={pending} variant="brand">
              Gửi phản hồi
            </Button>
          </form>
        )}
      </section>
      <FileList files={t.attachments} />
      {t.status !== "Đã đóng" && <FileUpload entity="tickets" id={id} />}
      <section>
        <h3 className="mb-3 font-bold">Lịch sử xử lý</h3>
        <ol className="space-y-2 border-l pl-4">
          {t.events.map((event) => (
            <li key={event.id} className="text-sm">
              <b>{event.to_status}</b> · {event.actor}
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString("vi-VN")}
              </span>
              <p className="whitespace-pre-wrap text-muted-foreground">{event.note}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

type FormField = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
};
function EntityForm({
  entity,
  id,
  close,
}: {
  entity: Entity;
  id?: string | undefined;
  close: () => void;
}) {
  const { data: w } = useWorkspace(),
    write = useWrite();
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Record<string, unknown>[] | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  if (!w) return null;
  const rows =
    entity === "users"
      ? w.users
      : entity === "departments"
        ? w.departments
        : entity === "assets"
          ? w.assets
          : entity === "software"
            ? w.software
            : w.documents;
  const record = { ...(rows.find((r) => r.id === id) || {}) } as unknown as Record<string, unknown>;
  if (entity === "assets") Object.assign(record, record["specs"] || {});
  const fields: Record<Entity, FormField[]> = {
    users: [
      { key: "code", label: "Mã nhân viên" },
      { key: "name", label: "Họ tên" },
      { key: "email", label: "Email", type: "email" },
      {
        key: "role",
        label: "Vai trò",
        options: ["admin", "helpdesk", "technician", "end-user"].map((value) => ({
          value,
          label: value,
        })),
      },
      {
        key: "department_id",
        label: "Phòng ban",
        options: w.departments.map((d) => ({ value: d.id, label: d.name })),
      },
      { key: "position", label: "Chức vụ" },
      {
        key: "password",
        label: id ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu (ít nhất 12 ký tự)",
        type: "password",
        optional: !!id,
      },
      { key: "active", label: "Tài khoản hoạt động", type: "checkbox" },
    ],
    departments: [
      { key: "id", label: "Mã phòng ban" },
      { key: "name", label: "Tên phòng ban" },
      { key: "head", label: "Trưởng phòng", optional: true },
    ],
    assets: [
      { key: "id", label: "Mã tài sản" },
      { key: "name", label: "Tên tài sản" },
      {
        key: "type",
        label: "Loại thiết bị",
        options: [
          "Laptop",
          "PC",
          "Màn hình",
          "Máy in",
          "Thiết bị mạng",
          "Điện thoại",
          "Máy chủ",
        ].map((value) => ({ value, label: value })),
      },
      { key: "serial", label: "Serial", optional: true },
      { key: "location", label: "Vị trí" },
      { key: "warranty", label: "Bảo hành đến", type: "date", optional: true },
      {
        key: "status",
        label: "Tình trạng",
        options: ["Trong kho", "Đang sử dụng", "Bảo trì", "Thanh lý"].map((value) => ({
          value,
          label: value,
        })),
      },
      { key: "notes", label: "Ghi chú", type: "textarea", optional: true },
      ...["cpu", "ram", "storage", "os"].map((key) => ({
        key,
        label: (
          { cpu: "CPU", ram: "RAM", storage: "Lưu trữ", os: "Hệ điều hành" } as Record<
            string,
            string
          >
        )[key]!,
        optional: true,
      })),
      { key: "health", label: "Tình trạng kỹ thuật (%)", type: "number", optional: true },
    ],
    software: [
      { key: "name", label: "Tên phần mềm" },
      { key: "vendor", label: "Nhà cung cấp" },
      { key: "version", label: "Phiên bản" },
      {
        key: "license_type",
        label: "Loại license",
        options: ["Thuê bao", "Vĩnh viễn", "Mã nguồn mở"].map((value) => ({ value, label: value })),
      },
      { key: "seats", label: "Số license", type: "number" },
      { key: "expires", label: "Hết hạn", type: "date", optional: true },
    ],
    documents: [
      { key: "title", label: "Tiêu đề" },
      { key: "category", label: "Danh mục" },
      { key: "content", label: "Nội dung", type: "textarea" },
      {
        key: "visibility",
        label: "Phạm vi đọc",
        options: [
          { value: "public", label: "Tất cả nhân viên" },
          { value: "internal", label: "Nội bộ CNTT" },
        ],
      },
      { key: "published", label: "Công bố cho người đọc", type: "checkbox" },
    ],
  };
  return (
    <div className="space-y-5">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget),
            body: Record<string, unknown> = {};
          for (const f of fields[entity]) {
            const value = form.get(f.key);
            if (f.key === "password" && !value) continue;
            body[f.key] =
              f.type === "checkbox"
                ? value === "on"
                : f.type === "number"
                  ? Number(value)
                  : String(value || "");
          }
          if (entity === "users" && !body["department_id"]) body["department_id"] = null;
          if (entity === "assets") {
            body["specs"] = Object.fromEntries(
              ["cpu", "ram", "storage", "os", "health"].map((key) => [key, body[key]]),
            );
            for (const key of ["cpu", "ram", "storage", "os", "health"]) delete body[key];
          }
          if (entity === "documents" && w.user.role !== "admin") {
            body["published"] = false;
            body["visibility"] = "internal";
          }
          setPending(true);
          try {
            const saved = await write<{ id: string }>(
              "/" + entity + (id ? "/" + encodeURIComponent(id) : ""),
              body,
              id ? "PUT" : "POST",
            );
            if (uploadFile) {
              const fileBody = new FormData();
              fileBody.set("file", uploadFile);
              try {
                await write("/documents/" + saved.id + "/attachments", fileBody);
              } catch {
                toast.error("Tài liệu đã lưu; hãy mở lại để đính kèm tệp.");
              }
            }
            toast.success("Đã lưu dữ liệu.");
            close();
          } catch {
          } finally {
            setPending(false);
          }
        }}
      >
        {fields[entity]
          .filter(
            (f) =>
              entity !== "documents" ||
              w.user.role === "admin" ||
              !["published", "visibility"].includes(f.key),
          )
          .map((f) =>
            f.type === "checkbox" ? (
              <label key={f.key} className="flex gap-2 text-sm font-semibold">
                <input
                  name={f.key}
                  type="checkbox"
                  defaultChecked={
                    record[f.key] === undefined ? f.key === "active" : !!record[f.key]
                  }
                />
                {f.label}
              </label>
            ) : (
              <Field key={f.key} label={f.label}>
                {f.options ? (
                  <select
                    name={f.key}
                    className="field"
                    defaultValue={String(record[f.key] || f.options[0]?.value || "")}
                  >
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.key}
                    required={!f.optional}
                    rows={f.key === "content" ? 8 : 3}
                    className="field h-auto py-3"
                    defaultValue={String(record[f.key] || "")}
                  />
                ) : (
                  <input
                    name={f.key}
                    type={f.type || "text"}
                    className="field"
                    required={!f.optional}
                    readOnly={!!id && f.key === "id"}
                    min={f.type === "number" ? (f.key === "health" ? 0 : 1) : undefined}
                    max={f.key === "health" ? 100 : undefined}
                    minLength={f.type === "password" ? 12 : undefined}
                    autoComplete={f.type === "password" ? "new-password" : undefined}
                    defaultValue={
                      f.type === "password"
                        ? ""
                        : String(record[f.key] || (f.key === "seats" ? 1 : "")).slice(
                            0,
                            f.type === "date" ? 10 : 100000,
                          )
                    }
                  />
                )}
              </Field>
            ),
          )}
        {entity === "documents" && !id && (
          <Field label="Tệp đính kèm (tùy chọn, tối đa 5 MB)">
            <input
              type="file"
              accept="image/png,image/jpeg,application/pdf,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 5242880) {
                  toast.error("Tệp vượt quá 5 MB.");
                  return;
                }
                setUploadFile(f || null);
              }}
            />
          </Field>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" disabled={pending}>
            Lưu thông tin
          </Button>
          {id && entity !== "users" && w.user.role === "admin" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Xóa bản ghi này? Các bản ghi đang được liên kết sẽ được giữ lại.",
                  )
                )
                  return;
                try {
                  await write("/" + entity + "/" + encodeURIComponent(id), {}, "DELETE");
                  close();
                } catch {}
              }}
            >
              Xóa bản ghi
            </Button>
          )}
        </div>
      </form>
      {entity === "assets" && id && (
        <>
          <AssignmentForm id={id} />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                setHistory(await api("/assets/" + encodeURIComponent(id) + "/history"));
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Lịch sử cấp phát
          </Button>
          {history && (
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="rounded-xl bg-surface p-3 text-sm">
                  <b>{String(h["recipient"])}</b> · {String(h["department"] || "")}
                  <p>
                    {String(h["reason"])} · {String(h["condition"])}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(String(h["started_at"])).toLocaleString("vi-VN")} →{" "}
                    {h["ended_at"]
                      ? new Date(String(h["ended_at"])).toLocaleString("vi-VN")
                      : "Đang giữ"}{" "}
                    · {String(h["actor"])}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {entity === "software" && id && <LicenseForm id={id} />}
      {entity === "documents" && id && <FileUpload entity="documents" id={id} />}
    </div>
  );
}
function AssignmentForm({ id }: { id: string }) {
  const { data: w } = useWorkspace(),
    write = useWrite();
  const [pending, setPending] = useState(false);
  const asset = w?.assets.find((a) => a.id === id);
  if (!w || !asset) return null;
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        try {
          await write("/assets/" + encodeURIComponent(id) + "/assignments", {
            action: f.get("action"),
            userId: f.get("userId"),
            reason: f.get("reason"),
            condition: f.get("condition"),
            version: asset.version,
          });
          toast.success("Đã cập nhật cấp phát.");
        } catch {
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="font-bold">Cấp phát / thu hồi / điều chuyển</h3>
      <p className="text-sm">Người đang giữ: {asset.owner || "Trong kho"}</p>
      <select name="action" className="field" aria-label="Thao tác tài sản">
        {asset.owner_id ? (
          <>
            <option value="transfer">Điều chuyển</option>
            <option value="return">Thu hồi</option>
          </>
        ) : (
          <option value="assign">Cấp phát</option>
        )}
      </select>
      <select name="userId" className="field" aria-label="Người nhận">
        {w.users
          .filter((u) => u.active)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.code}
            </option>
          ))}
      </select>
      <input
        required
        minLength={5}
        name="reason"
        className="field"
        placeholder="Lý do (ít nhất 5 ký tự)"
        aria-label="Lý do cấp phát"
      />
      <input
        required
        minLength={2}
        name="condition"
        className="field"
        placeholder="Tình trạng khi bàn giao"
        aria-label="Tình trạng bàn giao"
      />
      <Button disabled={pending} variant="soft">
        Lưu cấp phát
      </Button>
    </form>
  );
}
function LicenseForm({ id }: { id: string }) {
  const { data: w } = useWorkspace(),
    write = useWrite();
  const [pending, setPending] = useState(false);
  const software = w?.software.find((s) => s.id === id);
  if (!w || !software) return null;
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        try {
          await write("/software/" + id + "/installations", {
            action: f.get("action"),
            assetId: f.get("assetId"),
          });
          toast.success("Đã cập nhật license.");
        } catch {
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="font-bold">
        Cấp / thu hồi license · {software.used}/{software.seats}
      </h3>
      <p className="text-sm">Thiết bị đã cấp: {software.installations.join(", ") || "Chưa có"}</p>
      <select name="action" aria-label="Thao tác license" className="field">
        <option value="install">Cấp license</option>
        <option value="remove">Thu hồi license</option>
      </select>
      <select name="assetId" aria-label="Thiết bị nhận license" className="field">
        {w.assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.id} · {a.name}
          </option>
        ))}
      </select>
      <Button variant="soft" disabled={pending}>
        Lưu license
      </Button>
    </form>
  );
}
function DocumentPanel({ id }: { id: string }) {
  const { data: w } = useWorkspace(),
    actions = useActions();
  const query = useQuery({
    queryKey: ["document", id],
    queryFn: () => api<ApiDocument & { attachments: ApiAttachment[] }>("/documents/" + id),
    refetchOnWindowFocus: false,
  });
  if (query.error) return <p className="text-danger">{query.error.message}</p>;
  const d = query.data;
  if (!d) return <p>Đang tải…</p>;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{d.title}</h2>
      <p className="text-sm text-muted-foreground">
        {d.category} · {d.published ? "Đã công bố" : "Bản nháp"} ·{" "}
        {d.visibility === "public" ? "Tất cả nhân viên" : "Nội bộ CNTT"}
      </p>
      <div className="whitespace-pre-wrap rounded-xl bg-surface p-5 text-sm leading-7">
        {d.content}
      </div>
      <FileList files={d.attachments} />
      {w?.user.role === "admin" && (
        <Button variant="brand" onClick={() => actions.editEntity("documents", id)}>
          Chỉnh sửa / công bố
        </Button>
      )}
      {w &&
        ["helpdesk", "technician"].includes(w.user.role) &&
        !d.published &&
        d.author_id === w.user.id && (
          <Button variant="outline" onClick={() => actions.editEntity("documents", id)}>
            Chỉnh sửa bản nháp
          </Button>
        )}
    </div>
  );
}
function NewTicketForm({ close }: { close: () => void }) {
  const { data: w } = useWorkspace(),
    write = useWrite(),
    [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        try {
          const t = await write<{ id: string }>("/tickets", {
            title: f.get("title"),
            description: f.get("description"),
            category: f.get("category"),
            priority: f.get("priority"),
            ...(f.get("requesterId") ? { requesterId: f.get("requesterId") } : {}),
          });
          toast.success("Đã tạo " + t.id);
          close();
        } catch {
        } finally {
          setPending(false);
        }
      }}
    >
      <Field label="Tiêu đề">
        <input name="title" required minLength={5} maxLength={200} className="field" />
      </Field>
      <Field label="Mô tả">
        <textarea
          name="description"
          required
          minLength={10}
          className="field h-auto py-3"
          rows={4}
        />
      </Field>
      <Field label="Loại yêu cầu">
        <select name="category" className="field">
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Mức ưu tiên">
        <select name="priority" className="field">
          {["Trung bình", "Cao", "Khẩn cấp", "Thấp"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      {w && ["admin", "helpdesk"].includes(w.user.role) && (
        <Field label="Người yêu cầu">
          <select name="requesterId" className="field">
            {w.users
              .filter((u) => u.active)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Button variant="brand" disabled={pending}>
        Gửi yêu cầu
      </Button>
    </form>
  );
}
function PasswordForm() {
  const write = useWrite();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await write("/auth/password", {
            currentPassword: f.get("current"),
            password: f.get("password"),
          });
          window.location.reload();
        } catch {}
      }}
    >
      <Field label="Mật khẩu hiện tại">
        <input
          required
          type="password"
          name="current"
          autoComplete="current-password"
          className="field"
        />
      </Field>
      <Field label="Mật khẩu mới (ít nhất 12 ký tự)">
        <input
          required
          minLength={12}
          maxLength={128}
          type="password"
          name="password"
          autoComplete="new-password"
          className="field"
        />
      </Field>
      <Button variant="brand">Đổi mật khẩu & đăng xuất các phiên</Button>
    </form>
  );
}
function UtilityPanel({ panel }: { panel: Panel }) {
  const { data: w } = useWorkspace(),
    actions = useActions(),
    write = useWrite(),
    [query, setQuery] = useState(panel.query || "");
  if (!w) return null;
  if (panel.type === "audit")
    return (
      <ul className="space-y-2">
        {w.audits.map((a) => (
          <li key={a.id} className="rounded-xl bg-surface p-3 text-sm">
            <b>{a.actor || "Hệ thống"}</b> · {a.action} · {a.entity} · {a.entity_id}
            <p className="text-xs text-muted-foreground">
              {new Date(a.created_at).toLocaleString("vi-VN")}
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
              {JSON.stringify(a.details)}
            </pre>
          </li>
        ))}
      </ul>
    );
  if (panel.type === "notifications")
    return (
      <div className="space-y-3">
        <Button
          variant="outline"
          onClick={() => void write("/notifications/read", {}).catch(() => {})}
        >
          Đánh dấu đã đọc
        </Button>
        {!w.notifications.length && <p>Chưa có thông báo.</p>}
        {w.notifications.map((n) => (
          <button
            key={n.id}
            className="block w-full rounded-xl bg-surface p-3 text-left text-sm"
            onClick={() => {
              if (n.ticket_id) actions.openTicket(n.ticket_id);
            }}
          >
            {!n.read_at && "● "}
            {n.message}
            <span className="mt-1 block text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("vi-VN")}
            </span>
          </button>
        ))}
      </div>
    );
  if (panel.type === "calendar")
    return (
      <ul className="space-y-2">
        {w.tickets
          .filter((t) => !["Đã đóng", "Đã giải quyết"].includes(t.status))
          .sort((a, b) => a.due_at.localeCompare(b.due_at))
          .map((t) => (
            <li key={t.id}>
              <button
                onClick={() => actions.openTicket(t.id)}
                className="w-full rounded-xl bg-surface p-3 text-left text-sm"
              >
                <b>{new Date(t.due_at).toLocaleString("vi-VN")}</b> · {t.id} · {t.title}
              </button>
            </li>
          ))}
      </ul>
    );
  const q = query.trim().toLocaleLowerCase("vi");
  return (
    <div className="space-y-3">
      <input
        autoFocus
        aria-label="Từ khóa tìm kiếm"
        className="field"
        placeholder="Tìm ticket, tài sản, nhân viên, tài liệu…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {w.tickets
        .filter((t) => (t.id + t.title + t.requester).toLowerCase().includes(q))
        .map((t) => (
          <button
            key={t.id}
            className="block w-full rounded-xl bg-surface p-3 text-left text-sm"
            onClick={() => actions.openTicket(t.id)}
          >
            {t.id} · {t.title}
          </button>
        ))}
      {w.documents
        .filter((d) => d.title.toLowerCase().includes(q))
        .map((d) => (
          <button
            key={d.id}
            className="block w-full rounded-xl bg-surface p-3 text-left text-sm"
            onClick={() => actions.openDocument(d.id)}
          >
            Tài liệu · {d.title}
          </button>
        ))}
      {w.user.role === "admin" &&
        w.assets
          .filter((a) => (a.id + a.name + (a.owner || "")).toLowerCase().includes(q))
          .map((a) => (
            <button
              key={a.id}
              className="block w-full rounded-xl bg-surface p-3 text-left text-sm"
              onClick={() => actions.editEntity("assets", a.id)}
            >
              Tài sản · {a.id} · {a.name}
            </button>
          ))}
      {w.user.role === "admin" &&
        w.users
          .filter((u) => (u.name + u.email + u.code).toLowerCase().includes(q))
          .map((u) => (
            <button
              key={u.id}
              className="block w-full rounded-xl bg-surface p-3 text-left text-sm"
              onClick={() => actions.editEntity("users", u.id)}
            >
              Nhân viên · {u.name}
            </button>
          ))}
    </div>
  );
}
