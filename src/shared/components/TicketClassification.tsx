import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace, useWrite } from "../api/client";
import { useActions } from "../api/Actions";
import { categories } from "../api/data";
import type { ApiTicket } from "../api/types";
import { isFinalTicketStatus } from "../lib/ticket";
import { Field } from "./Field";

export function TicketClassification({ ticket }: { ticket: ApiTicket }) {
  const { data: workspace } = useWorkspace(),
    write = useWrite(),
    actions = useActions();
  const [pending, setPending] = useState(false);
  const [assignee, setAssignee] = useState("");
  if (
    !workspace ||
    !["admin", "end-user"].includes(workspace.user.role) ||
    isFinalTicketStatus(ticket.status)
  )
    return null;
  const admin = workspace.user.role === "admin";
  const assignable = admin && ticket.status !== "Đã giải quyết";
  const assets = workspace.assets.filter(
    (asset) =>
      admin || asset.owner_id === ticket.requester_id || asset.id === ticket.requested_asset_id,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assigning =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "assign";
    if (assigning && (!assignee || assignee === ticket.assignee_id)) {
      toast.error("Chọn người xử lý mới.");
      return;
    }
    setPending(true);
    try {
      await write(`/tickets/${ticket.id}/${assigning ? "assign" : "actions"}`, {
        ...(assigning ? { assigneeId: assignee } : { action: "classify" }),
        version: ticket.version,
        priority: form.get("priority"),
        category: form.get("category"),
        assetId: form.get("assetId") === "none" ? null : form.get("assetId"),
        note: String(form.get("assignmentNote") || ""),
      });
      if (assigning)
        actions.notify("Đã phân công", "Nhân viên được chọn đã nhận được phân công xử lý yêu cầu.");
      else toast.success(admin ? "Đã lưu quyết định phân loại." : "Đã cập nhật thông tin đề xuất.");
    } catch {
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border p-4">
      <h3 className="font-bold">{admin ? "Phân loại & phân công" : "Thông tin yêu cầu"}</h3>
      <p className="text-sm text-muted-foreground">
        {admin
          ? `End User đề xuất: ${ticket.requested_priority} · ${ticket.requested_category} · ${ticket.requested_asset_id || "Không liên quan thiết bị"}. Chọn đủ ba mục để xác nhận quyết định xử lý.`
          : "Bạn có thể cập nhật thông tin đề xuất. Mức ưu tiên xử lý và SLA được áp dụng theo quyết định của Admin."}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Mức ưu tiên">
          <select
            name="priority"
            aria-label="Mức ưu tiên"
            required
            className="field"
            defaultValue={admin ? "" : ticket.requested_priority}
          >
            <option value="" disabled>
              Chọn mức ưu tiên
            </option>
            {["Khẩn cấp", "Cao", "Trung bình", "Thấp"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Loại yêu cầu">
          <select
            name="category"
            aria-label="Loại yêu cầu"
            required
            className="field"
            defaultValue={admin ? "" : ticket.requested_category}
          >
            <option value="" disabled>
              Chọn loại yêu cầu
            </option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Thiết bị liên quan">
          <select
            name="assetId"
            aria-label="Thiết bị liên quan"
            required
            className="field"
            defaultValue={admin ? "" : ticket.requested_asset_id || "none"}
          >
            <option value="" disabled>
              Chọn thiết bị liên quan
            </option>
            <option value="none">Không liên quan thiết bị</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.id} · {asset.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {assignable && (
        <>
          <Field label="Người xử lý">
            <select
              aria-label="Người xử lý"
              className="field"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Chọn người xử lý</option>
              {workspace.users
                .filter(
                  (person) =>
                    person.active &&
                    ["helpdesk", "technician"].includes(person.role) &&
                    (!ticket.queue_role || person.role === ticket.queue_role),
                )
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.role === "helpdesk" ? "Helpdesk" : "Technician"}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Ghi chú phân công">
            <textarea
              name="assignmentNote"
              aria-label="Ghi chú phân công"
              rows={2}
              maxLength={10000}
              className="field h-auto py-3"
            />
          </Field>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" value="classify" disabled={pending}>
          Lưu phân loại
        </Button>
        {assignable && (
          <Button
            variant="brand"
            value="assign"
            disabled={pending || !assignee || assignee === ticket.assignee_id}
          >
            Xác nhận phân công
          </Button>
        )}
      </div>
    </form>
  );
}
