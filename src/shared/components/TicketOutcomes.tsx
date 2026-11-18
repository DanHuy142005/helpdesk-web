import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useActions } from "../api/Actions";
import { useWrite } from "../api/client";
import type { ApiTicket } from "../api/types";
import { Field } from "./Field";
import { AutoCloseNotice } from "./TicketSla";

export function ResolveTicketButton({ ticket }: { ticket: ApiTicket }) {
  const [open, setOpen] = useState(false),
    [solution, setSolution] = useState(""),
    [pending, setPending] = useState(false);
  const write = useWrite(),
    actions = useActions();
  const available = ["Đang xử lý", "Chờ phản hồi"].includes(ticket.status);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={!available || pending}
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 />
        {ticket.status === "Đã giải quyết" ? "Chờ End User xác nhận" : "Đã giải quyết xong"}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn xác nhận giải quyết xong không?</AlertDialogTitle>
            <AlertDialogDescription>
              Kết quả sẽ được gửi cho End User kiểm tra và xác nhận hoàn thành.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field label="Kết quả xử lý">
            <textarea
              aria-label="Kết quả xử lý"
              className="field h-auto py-3"
              rows={3}
              minLength={10}
              maxLength={10000}
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              placeholder="Mô tả kết quả đã thực hiện…"
              disabled={pending}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Chưa, tiếp tục xử lý</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || solution.trim().length < 10}
              onClick={async (event) => {
                event.preventDefault();
                setPending(true);
                try {
                  await write(`/tickets/${ticket.id}/actions`, {
                    action: "resolve",
                    version: ticket.version,
                    note: solution,
                  });
                  setOpen(false);
                  setSolution("");
                  actions.notify(
                    "Đã xác nhận giải quyết xong",
                    "Yêu cầu đang chờ End User kiểm tra và xác nhận hoàn thành.",
                  );
                } catch {
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Đang lưu…" : "Có, đã giải quyết"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TicketCompletionButton({ ticket }: { ticket: ApiTicket }) {
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false);
  const write = useWrite(),
    actions = useActions();
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="brand"
        disabled={ticket.status !== "Đã giải quyết" || pending}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title={
          ticket.status === "Đã giải quyết"
            ? "Xác nhận sau khi bạn đã kiểm tra kết quả"
            : "Chỉ xác nhận sau khi người xử lý đã giải quyết xong"
        }
      >
        {ticket.status === "Đã đóng"
          ? ticket.closed_automatically
            ? "Đã tự động đóng"
            : "Đã xác nhận hoàn thành"
          : "Xác nhận hoàn thành"}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <AlertDialogContent
          className="w-[calc(100%-2rem)] rounded-[20px]"
          onClick={(event) => event.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận hoàn thành yêu cầu?</AlertDialogTitle>
            <AlertDialogDescription>
              Chỉ xác nhận khi vấn đề của bạn đã được giải quyết. Ticket sẽ được đóng sau bước này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm">{ticket.solution}</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Kiểm tra lại</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={async (event) => {
                event.preventDefault();
                setPending(true);
                try {
                  await write(`/tickets/${ticket.id}/actions`, {
                    action: "confirm",
                    version: ticket.version,
                  });
                  setOpen(false);
                  actions.notify(
                    "Đã xác nhận hoàn thành",
                    "Cảm ơn bạn đã xác nhận. Yêu cầu hỗ trợ đã được đóng.",
                  );
                } catch {
                } finally {
                  setPending(false);
                }
              }}
            >
              Xác nhận hoàn thành
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TicketResultReview({ ticket }: { ticket: ApiTicket }) {
  const [reason, setReason] = useState(""),
    [reopen, setReopen] = useState(false),
    [pending, setPending] = useState(false);
  const write = useWrite(),
    actions = useActions();
  if (ticket.status !== "Đã giải quyết") return null;
  return (
    <section className="space-y-3 rounded-xl border border-success/25 bg-success/5 p-4">
      <h3 className="font-bold">Người xử lý đã giải quyết xong</h3>
      <AutoCloseNotice ticket={ticket} />
      <p className="whitespace-pre-wrap text-sm">{ticket.solution}</p>
      <div className="flex flex-wrap gap-2">
        <TicketCompletionButton ticket={ticket} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setReopen((value) => !value)}
        >
          Yêu cầu xử lý tiếp
        </Button>
      </div>
      {reopen && (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            try {
              await write(`/tickets/${ticket.id}/actions`, {
                action: "reopen",
                version: ticket.version,
                note: reason,
              });
              setReopen(false);
              setReason("");
              actions.notify(
                "Đã gửi yêu cầu xử lý tiếp",
                "Người phụ trách sẽ tiếp tục hỗ trợ bạn trong cuộc trò chuyện này.",
              );
            } catch {
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="Vấn đề còn tồn tại">
            <textarea
              required
              minLength={10}
              maxLength={10000}
              aria-label="Vấn đề còn tồn tại"
              className="field h-auto py-3"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <Button variant="brand" disabled={pending || reason.trim().length < 10}>
            Gửi yêu cầu xử lý tiếp
          </Button>
        </form>
      )}
    </section>
  );
}

export function ReturnToHelpdesk({
  ticket,
  compact = false,
}: {
  ticket: ApiTicket;
  compact?: boolean;
}) {
  const [reason, setReason] = useState(""),
    [pending, setPending] = useState(false);
  const write = useWrite(),
    actions = useActions();
  if (ticket.status === "Đã đóng") return null;
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || reason.trim().length < 10) return;
        setPending(true);
        try {
          await write(`/tickets/${ticket.id}/return-to-helpdesk`, {
            version: ticket.version,
            note: reason,
          });
          setReason("");
          actions.notify(
            "Đã chuyển yêu cầu cho Admin",
            "Admin sẽ phân công nhân viên Helpdesk tiếp tục xử lý yêu cầu.",
          );
        } catch {
        } finally {
          setPending(false);
        }
      }}
    >
      <Field
        label={compact ? "Ghi chú / kết quả / lý do chuyển" : "Lý do chuyển cho Helpdesk"}
        hint="Nhập lý do để Admin phân công Helpdesk tiếp tục hỗ trợ."
      >
        <textarea
          aria-label="Lý do chuyển cho Helpdesk"
          rows={3}
          required
          minLength={10}
          maxLength={10000}
          className="field h-auto py-3"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={pending || reason.trim().length < 10}>
        Chuyển cho Helpdesk
      </Button>
    </form>
  );
}
