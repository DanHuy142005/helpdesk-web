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
import {
  api,
  ApiError,
  useWorkspace,
  useWrite,
  downloadReport,
  authenticatedUrl,
  logout,
  type ApiFieldError,
} from "./client";
import type { Entity, ApiAttachment, ApiDocument } from "./types";
import { Field } from "../components/Field";
import { TicketDetailPanel as TicketPanel } from "../components/TicketDetailPanel";
import { categories } from "./data";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { CheckCircle2 } from "lucide-react";
import { isOverdue } from "../components/TicketSla";
import { isOpenTicketStatus } from "../lib/ticket";

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
    | "password"
    | "overdue";
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
  notify: (title: string, description?: string) => void;
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
    [notice, setNotice] = useState<{ title: string; description: string | undefined } | null>(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const actions: Actions = {
    openTicket: (id) => setPanel({ type: "ticket", id }),
    openDocument: (id) => setPanel({ type: "document", id }),
    editEntity: (entity, id) => setPanel({ type: "entity", entity, ...(id ? { id } : {}) }),
    openPanel: setPanel,
    newTicket: () => setPanel({ type: "new-ticket" }),
    notify: (title, description) => {
      setPanel(null);
      setNotice({ title, description });
    },
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
                                : panel?.type === "overdue"
                                  ? "Ticket quá hạn SLA"
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
          {panel &&
            ["search", "notifications", "calendar", "audit", "overdue"].includes(panel.type) && (
              <UtilityPanel panel={panel} />
            )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!notice}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-[20px] text-center sm:max-w-md">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <AlertDialogHeader className="sm:text-center">
            <AlertDialogTitle>{notice?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {notice?.description || "Thông tin đã được cập nhật thành công."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction>Đã hiểu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            href={authenticatedUrl("/attachments/" + f.id)}
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
  const [fieldErrors, setFieldErrors] = useState<ApiFieldError[]>([]);
  const [formError, setFormError] = useState("");
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
  const fields: Record<Entity, FormField[]> = {
    users: [
      { key: "code", label: "Mã nhân viên" },
      { key: "name", label: "Họ tên" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Số điện thoại liên kết", type: "tel", optional: true },
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
        label: id ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu (ít nhất 7 ký tự)",
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
          if (entity === "documents" && w.user.role !== "admin") {
            body["published"] = false;
            body["visibility"] = "internal";
          }
          setPending(true);
          setFieldErrors([]);
          setFormError("");
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
          } catch (error) {
            if (error instanceof ApiError) setFieldErrors(error.fields);
            setFormError(error instanceof Error ? error.message : "Chưa lưu được thông tin.");
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
              <Field
                key={f.key}
                label={f.label}
                {...(f.key === "phone"
                  ? {
                      hint: "Ví dụ: 0901234567 hoặc +84901234567. Có thể nhập khoảng trắng hoặc dấu gạch ngang.",
                    }
                  : {})}
              >
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
                    minLength={f.type === "password" ? 7 : undefined}
                    autoComplete={
                      f.type === "password" ? "new-password" : f.key === "phone" ? "tel" : undefined
                    }
                    inputMode={f.key === "phone" ? "tel" : undefined}
                    placeholder={f.key === "phone" ? "0901234567" : undefined}
                    maxLength={f.key === "phone" ? 40 : undefined}
                    aria-invalid={fieldErrors.some((error) => error.field === f.key) || undefined}
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
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
          >
            {fieldErrors.length ? (
              <ul className="space-y-1">
                {fieldErrors.map((error, index) => (
                  <li key={index}>
                    <b>
                      {fields[entity].find((field) => field.key === error.field)?.label ||
                        "Thông tin"}
                      :
                    </b>{" "}
                    {error.message}
                  </li>
                ))}
              </ul>
            ) : (
              formError
            )}
          </div>
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
      {w && w.user.role === "admin" && (
        <Field label="Người yêu cầu">
          <select name="requesterId" className="field" required defaultValue="">
            <option value="">Chọn End User cần hỗ trợ</option>
            {w.users
              .filter((u) => u.active && u.role === "end-user")
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
            confirmPassword: f.get("confirmPassword"),
          });
          window.location.assign("/");
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
      <Field label="Mật khẩu mới (ít nhất 7 ký tự)">
        <input
          required
          minLength={7}
          maxLength={128}
          type="password"
          name="password"
          autoComplete="new-password"
          className="field"
        />
      </Field>
      <Field label="Nhập lại mật khẩu mới">
        <input
          required
          minLength={7}
          maxLength={128}
          type="password"
          name="confirmPassword"
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
  if (panel.type === "overdue")
    return (
      <div className="space-y-3">
        {w.tickets
          .filter((ticket) => isOverdue(ticket, w.serverTime))
          .map((ticket) => (
            <button
              key={ticket.id}
              className="block w-full rounded-xl border border-danger/20 bg-danger/5 p-3 text-left text-sm"
              onClick={() => actions.openTicket(ticket.id)}
            >
              <b>
                {ticket.id} · {ticket.title}
              </b>
              <span className="mt-1 block text-xs text-danger">
                {ticket.priority} · Hạn xử lý: {new Date(ticket.due_at).toLocaleString("vi-VN")}
              </span>
            </button>
          ))}
        {!w.tickets.some((ticket) => isOverdue(ticket, w.serverTime)) && (
          <p>Không có Ticket quá hạn SLA.</p>
        )}
      </div>
    );
  if (panel.type === "calendar")
    return (
      <ul className="space-y-2">
        {w.tickets
          .filter((t) => isOpenTicketStatus(t.status))
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
