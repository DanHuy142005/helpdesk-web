import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { transaction } from "./db.mjs";
import { assert, audit, getTicket, ticketScope, assertAssetAccess } from "./security.mjs";

export const priorities = ["Khẩn cấp", "Cao", "Trung bình", "Thấp"];
export const categories = [
  "Tài khoản & Quyền",
  "Email & Office",
  "Phần cứng",
  "Phần mềm",
  "Mạng & VPN",
  "Thiết bị ngoại vi",
  "Khác",
];
const text = (min, max) => z.string().trim().min(min).max(max);
const createSchema = z
  .object({
    title: text(5, 200),
    description: text(10, 10000),
    category: z.enum(categories),
    priority: z.enum(priorities),
    assetId: z.string().max(60).nullable().optional(),
    requesterId: z.string().uuid().optional(),
  })
  .strict();
const actionSchema = z
  .object({
    action: z.enum([
      "accept",
      "escalate",
      "start",
      "wait",
      "resume",
      "resolve",
      "confirm",
      "reopen",
      "classify",
    ]),
    version: z.number().int().positive(),
    note: text(0, 10000).default(""),
    assigneeId: z.string().uuid().optional(),
    priority: z.enum(priorities).optional(),
    category: z.enum(categories).optional(),
    assetId: z.string().max(60).nullable().optional(),
  })
  .strict();
const slaMinutes = { "Khẩn cấp": 15, Cao: 30, "Trung bình": 120, Thấp: 1440 };

export const ticketSelect = `SELECT t.*, r.name requester, r.email, d.name department, a.name assignee,
  (SELECT count(*)::int FROM ticket_comments c WHERE c.ticket_id=t.id AND NOT c.internal) comment_count,
  ast.name asset_name, ast.location, aa.name asset_owner
  FROM tickets t JOIN users r ON r.id=t.requester_id LEFT JOIN departments d ON d.id=r.department_id
  LEFT JOIN users a ON a.id=t.assignee_id LEFT JOIN assets ast ON ast.id=t.asset_id
  LEFT JOIN asset_assignments aas ON aas.asset_id=ast.id AND aas.ended_at IS NULL LEFT JOIN users aa ON aa.id=aas.user_id`;

async function event(client, ticket, actor, action, note, previous = null) {
  await client.query(
    `INSERT INTO ticket_events(id,ticket_id,actor_id,action,note,from_status,to_status,assignee_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [randomUUID(), ticket.id, actor, action, note, previous, ticket.status, ticket.assignee_id],
  );
  await audit(client, actor, action, "tickets", ticket.id, {
    from: previous,
    to: ticket.status,
    assigneeId: ticket.assignee_id,
    note,
    priority: ticket.priority,
    category: ticket.category,
    assetId: ticket.asset_id,
  });
  const users = new Set(
    [ticket.requester_id, ticket.assignee_id].filter((id) => id && id !== actor),
  );
  if (action === "create" || action === "reopen") {
    const { rows } = await client.query("SELECT id FROM users WHERE role='helpdesk' AND active");
    rows.forEach((u) => {
      if (u.id !== actor) users.add(u.id);
    });
  }
  for (const user of users)
    await client.query(
      "INSERT INTO notifications(id,user_id,message,ticket_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), user, `${ticket.id}: ${ticket.title} — ${ticket.status}`, ticket.id],
    );
}

export function ticketRouter(pool) {
  const router = Router();
  router.get("/", async (req, res) => {
    const scope = ticketScope(req.user);
    const values = [...scope.values];
    const conditions = [scope.sql];
    for (const [key, column] of [
      ["status", "status"],
      ["assignee", "assignee_id"],
    ]) {
      if (typeof req.query[key] === "string" && req.query[key]) {
        values.push(req.query[key]);
        conditions.push(`t.${column}::text=$${values.length}`);
      }
    }
    if (typeof req.query.q === "string" && req.query.q) {
      values.push(`%${req.query.q.slice(0, 200)}%`);
      conditions.push(
        `(t.id ILIKE $${values.length} OR t.title ILIKE $${values.length} OR t.description ILIKE $${values.length})`,
      );
    }
    res.json(
      (
        await pool.query(
          `${ticketSelect} WHERE ${conditions.join(" AND ")} ORDER BY t.created_at DESC`,
          values,
        )
      ).rows,
    );
  });
  router.post("/", async (req, res) => {
    assert(
      ["end-user", "helpdesk", "admin"].includes(req.user.role),
      403,
      "Bạn không có quyền tạo Ticket.",
    );
    const input = createSchema.parse(req.body);
    const ticket = await transaction(pool, async (client) => {
      let requesterId = req.user.id;
      if (input.requesterId && input.requesterId !== req.user.id) {
        assert(
          ["admin", "helpdesk"].includes(req.user.role),
          403,
          "Không được tạo yêu cầu thay người khác.",
        );
        const { rows } = await client.query("SELECT id FROM users WHERE id=$1 AND active", [
          input.requesterId,
        ]);
        assert(rows.length, 400, "Người yêu cầu không hoạt động.");
        requesterId = input.requesterId;
      }
      if (input.assetId)
        await assertAssetAccess(
          client,
          { ...req.user, id: requesterId, role: "end-user" },
          input.assetId,
        );
      const { rows } = await client.query(
        `INSERT INTO tickets(title,description,category,priority,requester_id,asset_id,due_at)
        VALUES($1,$2,$3,$4,$5,$6,now()+($7::int*interval '1 minute')) RETURNING *`,
        [
          input.title,
          input.description,
          input.category,
          input.priority,
          requesterId,
          input.assetId || null,
          slaMinutes[input.priority],
        ],
      );
      await event(client, rows[0], req.user.id, "create", input.description);
      return rows[0];
    });
    res.status(201).json(ticket);
  });
  router.get("/:id", async (req, res) => {
    const ticket = await getTicket(pool, req.user, req.params.id);
    const [full, comments, events, attachments] = await Promise.all([
      pool.query(`${ticketSelect} WHERE t.id=$1`, [ticket.id]),
      pool.query(
        `SELECT c.id,c.body,c.internal,c.created_at,u.name author,u.id author_id FROM ticket_comments c JOIN users u ON u.id=c.author_id
        WHERE c.ticket_id=$1 AND ($2::boolean OR NOT c.internal) ORDER BY c.created_at`,
        [ticket.id, req.user.role !== "end-user"],
      ),
      pool.query(
        `SELECT e.*,u.name actor,a.name assignee FROM ticket_events e JOIN users u ON u.id=e.actor_id LEFT JOIN users a ON a.id=e.assignee_id WHERE e.ticket_id=$1 ORDER BY e.created_at`,
        [ticket.id],
      ),
      pool.query(
        "SELECT id,name,mime,size FROM attachments WHERE ticket_id=$1 ORDER BY created_at",
        [ticket.id],
      ),
    ]);
    res.json({
      ...full.rows[0],
      comments: comments.rows,
      events: events.rows,
      attachments: attachments.rows,
    });
  });
  router.post("/:id/actions", async (req, res) => {
    const input = actionSchema.parse(req.body);
    if (!["confirm", "reopen"].includes(input.action))
      assert(
        ["helpdesk", "technician"].includes(req.user.role),
        403,
        "Bạn không có quyền xử lý Ticket.",
      );
    const updated = await transaction(pool, async (client) => {
      const ticket = await getTicket(client, req.user, req.params.id, true);
      assert(
        ticket.version === input.version,
        409,
        "Ticket vừa được cập nhật. Hãy tải lại trước khi thao tác.",
      );
      const previous = ticket.status;
      const owner = ticket.assignee_id === req.user.id;
      const helpdesk = req.user.role === "helpdesk";
      const technician = req.user.role === "technician";
      switch (input.action) {
        case "accept":
          assert(
            helpdesk && ticket.status === "Mới" && !ticket.assignee_id,
            409,
            "Chỉ Helpdesk có thể nhận Ticket mới chưa có người xử lý.",
          );
          ticket.assignee_id = req.user.id;
          ticket.status = "Đang xử lý";
          ticket.accepted_at = new Date();
          break;
        case "escalate": {
          assert(
            helpdesk && owner && ["Đang xử lý", "Chờ phản hồi"].includes(ticket.status),
            403,
            "Chỉ Helpdesk đang phụ trách được chuyển Ticket.",
          );
          assert(
            input.note.length >= 10 && input.assigneeId,
            400,
            "Chọn Technician và nhập lý do chuyển ít nhất 10 ký tự.",
          );
          const { rows } = await client.query(
            "SELECT id FROM users WHERE id=$1 AND role='technician' AND active FOR SHARE",
            [input.assigneeId],
          );
          assert(rows.length, 400, "Technician không hoạt động.");
          ticket.assignee_id = input.assigneeId;
          ticket.status = "Đã chuyển";
          break;
        }
        case "start":
          assert(
            technician && owner && ticket.status === "Đã chuyển",
            409,
            "Ticket không ở trạng thái được tiếp nhận.",
          );
          ticket.status = "Đang xử lý";
          break;
        case "wait":
          assert(
            (helpdesk || technician) && owner && ticket.status === "Đang xử lý",
            403,
            "Không thể tạm dừng Ticket này.",
          );
          assert(input.note.length >= 5, 400, "Nhập lý do chờ phản hồi.");
          ticket.status = "Chờ phản hồi";
          break;
        case "resume":
          assert(
            (helpdesk || technician) && owner && ticket.status === "Chờ phản hồi",
            403,
            "Không thể tiếp tục Ticket này.",
          );
          ticket.status = "Đang xử lý";
          break;
        case "resolve":
          assert(
            (helpdesk || technician) &&
              owner &&
              ["Đang xử lý", "Chờ phản hồi"].includes(ticket.status),
            403,
            "Chỉ người đang xử lý được ghi kết quả.",
          );
          assert(input.note.length >= 10, 400, "Mô tả kết quả xử lý ít nhất 10 ký tự.");
          ticket.solution = input.note;
          ticket.status = "Đã giải quyết";
          ticket.resolved_at = new Date();
          break;
        case "confirm":
          assert(
            ticket.requester_id === req.user.id && ticket.status === "Đã giải quyết",
            403,
            "Chỉ người gửi được xác nhận kết quả.",
          );
          ticket.status = "Đã đóng";
          ticket.closed_at = new Date();
          break;
        case "reopen":
          assert(
            ticket.requester_id === req.user.id && ticket.status === "Đã giải quyết",
            403,
            "Chỉ người gửi được yêu cầu xử lý tiếp khi chờ xác nhận.",
          );
          assert(input.note.length >= 10, 400, "Mô tả vấn đề còn tồn tại ít nhất 10 ký tự.");
          ticket.status = "Đang xử lý";
          ticket.resolved_at = null;
          ticket.solution = "";
          break;
        case "classify":
          assert(
            helpdesk && ["Mới", "Đang xử lý", "Chờ phản hồi"].includes(ticket.status),
            403,
            "Chỉ Helpdesk được phân loại Ticket chưa chuyển.",
          );
          if (input.priority) {
            ticket.priority = input.priority;
            ticket.due_at = new Date(
              new Date(ticket.created_at).getTime() + slaMinutes[input.priority] * 60000,
            );
          }
          if (input.category) ticket.category = input.category;
          if (input.assetId !== undefined) {
            if (input.assetId)
              await assertAssetAccess(
                client,
                { id: ticket.requester_id, role: "end-user" },
                input.assetId,
              );
            ticket.asset_id = input.assetId || null;
          }
          break;
      }
      const { rows } = await client.query(
        `UPDATE tickets SET status=$2,assignee_id=$3,solution=$4,accepted_at=$5,resolved_at=$6,closed_at=$7,
        priority=$8,category=$9,asset_id=$10,due_at=$11,updated_at=now(),version=version+1 WHERE id=$1 RETURNING *`,
        [
          ticket.id,
          ticket.status,
          ticket.assignee_id,
          ticket.solution,
          ticket.accepted_at,
          ticket.resolved_at,
          ticket.closed_at,
          ticket.priority,
          ticket.category,
          ticket.asset_id,
          ticket.due_at,
        ],
      );
      await event(client, rows[0], req.user.id, input.action, input.note, previous);
      return rows[0];
    });
    res.json(updated);
  });
  router.post("/:id/comments", async (req, res) => {
    const input = z
      .object({ body: text(1, 10000), internal: z.boolean().default(false) })
      .strict()
      .parse(req.body);
    assert(!input.internal || req.user.role !== "end-user", 403, "Không được tạo ghi chú nội bộ.");
    await transaction(pool, async (client) => {
      const ticket = await getTicket(client, req.user, req.params.id, true);
      assert(ticket.status !== "Đã đóng", 409, "Ticket đã đóng.");
      assert(
        req.user.role !== "technician" || ticket.assignee_id === req.user.id,
        403,
        "Ticket không được giao cho bạn.",
      );
      await client.query(
        "INSERT INTO ticket_comments(id,ticket_id,author_id,body,internal) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), ticket.id, req.user.id, input.body, input.internal],
      );
      await audit(client, req.user.id, "comment", "tickets", ticket.id, {
        internal: input.internal,
      });
      if (!input.internal) {
        for (const id of new Set(
          [ticket.requester_id, ticket.assignee_id].filter((id) => id && id !== req.user.id),
        )) {
          await client.query(
            "INSERT INTO notifications(id,user_id,message,ticket_id) VALUES($1,$2,$3,$4)",
            [randomUUID(), id, `${ticket.id}: có phản hồi mới`, ticket.id],
          );
        }
      }
    });
    res.status(201).json({ ok: true });
  });
  router.post("/:id/feedback", async (req, res) => {
    const input = z
      .object({ rating: z.number().int().min(1).max(5), comment: text(0, 2000).default("") })
      .strict()
      .parse(req.body);
    await transaction(pool, async (client) => {
      const ticket = await getTicket(client, req.user, req.params.id, true);
      assert(
        ticket.requester_id === req.user.id && ticket.status === "Đã đóng",
        403,
        "Chỉ đánh giá yêu cầu của bạn đã xác nhận đóng.",
      );
      assert(ticket.rating === null, 409, "Ticket đã được đánh giá.");
      await client.query(
        "UPDATE tickets SET rating=$2,feedback=$3,updated_at=now(),version=version+1 WHERE id=$1",
        [ticket.id, input.rating, input.comment],
      );
      await audit(client, req.user.id, "feedback", "tickets", ticket.id, { rating: input.rating });
    });
    res.status(201).json({ ok: true });
  });
  return router;
}
