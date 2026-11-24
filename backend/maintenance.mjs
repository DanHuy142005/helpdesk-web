import { randomUUID } from "node:crypto";
import { transaction } from "./db.mjs";
import { audit } from "./security.mjs";

export async function runTicketMaintenance(pool, now = new Date()) {
  return transaction(pool, async (client) => {
    const locked = (
      await client.query(
        "SELECT pg_try_advisory_xact_lock(712048,hashtext(current_schema())) locked",
      )
    ).rows[0].locked;
    if (!locked) return { closed: 0, alerted: 0 };
    const policy = (await client.query("SELECT * FROM ticket_policy WHERE id=true FOR SHARE"))
      .rows[0];
    const admins = (
      await client.query("SELECT id FROM users WHERE role='admin' AND active")
    ).rows.map((row) => row.id);
    let closed = 0,
      alerted = 0;
    if (policy.auto_close_enabled) {
      const tickets = (
        await client.query(
          "SELECT * FROM tickets WHERE status='Đã giải quyết' AND resolved_at IS NOT NULL AND resolved_at+($1::int*interval '1 minute')<=$2 ORDER BY resolved_at LIMIT 500 FOR UPDATE SKIP LOCKED",
          [policy.auto_close_minutes, now],
        )
      ).rows;
      for (const ticket of tickets) {
        await client.query(
          "UPDATE tickets SET status='Đã đóng',closed_at=$2,closed_automatically=true,updated_at=$2,version=version+1 WHERE id=$1",
          [ticket.id, now],
        );
        const note = `Hệ thống tự đóng sau ${policy.auto_close_minutes} phút chờ người yêu cầu xác nhận theo cấu hình của Admin.`;
        await client.query(
          "INSERT INTO ticket_events(id,ticket_id,actor_id,action,note,from_status,to_status,assignee_id,created_at) VALUES($1,$2,NULL,'auto-close',$3,'Đã giải quyết','Đã đóng',$4,$5)",
          [randomUUID(), ticket.id, note, ticket.assignee_id, now],
        );
        await audit(client, null, "auto-close", "tickets", ticket.id, {
          waitMinutes: policy.auto_close_minutes,
          resolvedAt: ticket.resolved_at,
          closedAt: now,
        });
        for (const user of new Set([ticket.requester_id, ticket.assignee_id].filter(Boolean)))
          await client.query(
            "INSERT INTO notifications(id,user_id,message,ticket_id) VALUES($1,$2,$3,$4)",
            [
              randomUUID(),
              user,
              `${ticket.id}: yêu cầu đã được tự động đóng sau thời gian chờ xác nhận.`,
              ticket.id,
            ],
          );
        closed++;
      }
    }
    const overdue = (
      await client.query(
        "SELECT * FROM tickets WHERE status NOT IN ('Đã giải quyết','Đã đóng','Đã thu hồi') AND assignee_id IS NOT NULL AND due_at<$1 AND (sla_alert_due_at IS DISTINCT FROM due_at OR sla_alert_assignee_id IS DISTINCT FROM assignee_id) ORDER BY due_at LIMIT 500 FOR UPDATE SKIP LOCKED",
        [now],
      )
    ).rows;
    for (const ticket of overdue) {
      for (const user of new Set([ticket.assignee_id, ...admins]))
        await client.query(
          "INSERT INTO notifications(id,user_id,message,ticket_id) VALUES($1,$2,$3,$4)",
          [
            randomUUID(),
            user,
            `${ticket.id}: đã quá hạn SLA. Vui lòng ưu tiên xử lý ${ticket.title}.`,
            ticket.id,
          ],
        );
      await client.query(
        "UPDATE tickets SET sla_alert_due_at=due_at,sla_alert_assignee_id=assignee_id WHERE id=$1",
        [ticket.id],
      );
      await audit(client, null, "sla-overdue", "tickets", ticket.id, {
        dueAt: ticket.due_at,
        assigneeId: ticket.assignee_id,
      });
      alerted++;
    }
    return { closed, alerted };
  });
}

export function startTicketMaintenance(pool, { intervalMs = 15000 } = {}) {
  let active = null,
    stopping = false;
  const tick = () => {
    if (stopping || active) return;
    active = runTicketMaintenance(pool)
      .catch(() => console.error("Ticket maintenance failed; it will retry."))
      .finally(() => {
        active = null;
      });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => {
    stopping = true;
    clearInterval(timer);
    await active;
  };
}
