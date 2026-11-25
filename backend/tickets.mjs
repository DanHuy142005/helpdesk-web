import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { transaction } from "./db.mjs";
import { upload, validateAttachments, saveAttachments } from "./attachments.mjs";
import {
  assert,
  audit,
  getTicket,
  ticketScope,
  assertAssetAccess,
  canReadConversation,
} from "./security.mjs";

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
    assetId: z.string().min(1).max(60).nullable().optional(),
    requesterId: z.string().uuid().optional(),
  })
  .strict();
const actionSchema = z
  .object({
    action: z.enum([
      "accept",
      "escalate",
      "assign",
      "return-to-helpdesk",
      "start",
      "wait",
      "resume",
      "resolve",
      "confirm",
      "reopen",
      "classify",
      "withdraw",
    ]),
    version: z.number().int().positive(),
    note: text(0, 10000).default(""),
    assigneeId: z.string().uuid().optional(),
    priority: z.enum(priorities).optional(),
    category: z.enum(categories).optional(),
    assetId: z.string().min(1).max(60).nullable().optional(),
  })
  .strict();
export const slaMinutes = { "Khẩn cấp": 15, Cao: 30, "Trung bình": 120, Thấp: 1440 };

export const ticketSelect = `SELECT t.*, r.name requester, r.email, d.name department, a.name assignee, a.role assignee_role,
  assigner.name assigned_by_name,
  (SELECT CASE WHEN p.auto_close_enabled AND t.status='Đã giải quyết' THEN t.resolved_at+p.auto_close_minutes*interval '1 minute' END FROM ticket_policy p WHERE p.id=true) auto_close_at,
  (SELECT count(*)::int FROM ticket_messages m WHERE m.ticket_id=t.id) comment_count,
  ast.name asset_name, ast.location, aa.name asset_owner
  FROM tickets t JOIN users r ON r.id=t.requester_id LEFT JOIN departments d ON d.id=r.department_id
  LEFT JOIN users a ON a.id=t.assignee_id LEFT JOIN assets ast ON ast.id=t.asset_id
  LEFT JOIN users assigner ON assigner.id=t.assigned_by
  LEFT JOIN asset_assignments aas ON aas.asset_id=ast.id AND aas.ended_at IS NULL LEFT JOIN users aa ON aa.id=aas.user_id`;

async function event(
  client,
  ticket,
  actor,
  action,
  note,
  previous = null,
  previousAssigneeId = null,
) {
  await client.query(
    `INSERT INTO ticket_events(id,ticket_id,actor_id,action,note,from_status,to_status,assignee_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [randomUUID(), ticket.id, actor, action, note, previous, ticket.status, ticket.assignee_id],
  );
  await audit(client, actor, action, "tickets", ticket.id, {
    from: previous,
    to: ticket.status,
    assigneeId: ticket.assignee_id,
    previousAssigneeId,
    queueRole: ticket.queue_role,
    note,
    priority: ticket.priority,
    category: ticket.category,
    assetId: ticket.asset_id,
    requestedPriority: ticket.requested_priority,
    requestedCategory: ticket.requested_category,
    requestedAssetId: ticket.requested_asset_id,
    classifiedBy: ticket.classified_by,
  });
  const users = new Set(
    [ticket.requester_id, ticket.assignee_id].filter((id) => id && id !== actor),
  );
  if (["create", "reopen", "return-to-helpdesk", "withdraw"].includes(action)) {
    const { rows } = await client.query("SELECT id FROM users WHERE role='admin' AND active");
    rows.forEach((u) => {
      if (u.id !== actor) users.add(u.id);
    });
  }
  for (const user of users)
    await client.query(
      "INSERT INTO notifications(id,user_id,message,ticket_id) VALUES($1,$2,$3,$4)",
      [
        randomUUID(),
        user,
        `${ticket.id}: ${ticket.title} — ${action === "assign" ? "Admin đã phân công người xử lý" : action === "return-to-helpdesk" ? "Chờ Admin phân công Helpdesk" : ticket.status}`,
        ticket.id,
      ],
    );
}

export function ticketRouter(pool) {
  const router = Router();
  const messageSelect = `SELECT m.id,m.body,m.created_at,m.sender_id author_id,u.name author,u.role author_role
    FROM ticket_messages m JOIN users u ON u.id=m.sender_id WHERE m.ticket_id=$1 ORDER BY m.created_at,m.id`;
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
  router.post("/", upload.array("files", 10), async (req, res) => {
    assert(["end-user", "admin"].includes(req.user.role), 403, "Bạn không có quyền tạo Ticket.");
    const input = createSchema.parse(req.body);
    const files = req.files || [];
    validateAttachments(files);
    assert(
      req.user.role !== "admin" || (input.requesterId && input.requesterId !== req.user.id),
      400,
      "Chọn End User cần tạo yêu cầu hỗ trợ.",
    );
    const ticket = await transaction(pool, async (client) => {
      let requesterId = req.user.id;
      if (input.requesterId && input.requesterId !== req.user.id) {
        assert(req.user.role === "admin", 403, "Không được tạo yêu cầu thay người khác.");
        const { rows } = await client.query(
          "SELECT id FROM users WHERE id=$1 AND active AND role='end-user'",
          [input.requesterId],
        );
        assert(rows.length, 400, "Người yêu cầu phải là End User đang hoạt động.");
        requesterId = input.requesterId;
      }
      if (input.assetId)
        await assertAssetAccess(
          client,
          { ...req.user, id: requesterId, role: "end-user" },
          input.assetId,
        );
      const { rows } = await client.query(
        `INSERT INTO tickets(title,description,category,priority,requester_id,asset_id,due_at,requested_priority,requested_category,requested_asset_id)
        VALUES($1,$2,$3,$4,$5,$6,now()+($7::int*interval '1 minute'),$4,$3,$6) RETURNING *`,
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
      const attachments = await saveAttachments(client, req.user, "tickets", rows[0].id, files);
      return { ...rows[0], attachments };
    });
    res.status(201).json(ticket);
  });
  router.get("/:id", async (req, res) => {
    const result = await transaction(pool, async (client) => {
      const ticket = await getTicket(client, req.user, req.params.id, true);
      const canChat = canReadConversation(req.user, ticket);
      const full = await client.query(`${ticketSelect} WHERE t.id=$1`, [ticket.id]);
      const comments = await client.query(
        `SELECT c.id,c.body,c.internal,c.created_at,u.name author,u.id author_id FROM ticket_comments c JOIN users u ON u.id=c.author_id
        WHERE c.ticket_id=$1 AND c.internal AND $2::boolean ORDER BY c.created_at,c.id`,
        [ticket.id, canChat && req.user.role === "technician"],
      );
      const messages = canChat ? await client.query(messageSelect, [ticket.id]) : { rows: [] };
      const events = await client.query(
        `SELECT e.*,COALESCE(u.name,'Hệ thống') actor,a.name assignee FROM ticket_events e LEFT JOIN users u ON u.id=e.actor_id LEFT JOIN users a ON a.id=e.assignee_id WHERE e.ticket_id=$1 ORDER BY e.created_at`,
        [ticket.id],
      );
      const attachments = await client.query(
        "SELECT id,name,mime,size FROM attachments WHERE ticket_id=$1 ORDER BY created_at",
        [ticket.id],
      );
      return {
        ...full.rows[0],
        comments: comments.rows,
        messages: messages.rows,
        can_chat: canChat,
        events: events.rows,
        attachments: attachments.rows,
      };
    });
    res.json(result);
  });
  router.delete("/:id", async (req, res) => {
    assert(req.user.role === "admin", 403, "Chỉ Admin được xóa Ticket đã đóng.");
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    await transaction(pool, async (client) => {
      const ticket = await getTicket(client, req.user, req.params.id, true);
      assert(
        ticket.version === version,
        409,
        "Ticket vừa được cập nhật. Hãy tải lại trước khi thao tác.",
      );
      assert(ticket.status === "Đã đóng", 409, "Chỉ có thể xóa Ticket ở trạng thái Đã đóng.");
      // Remove Ticket-owned records in the same transaction and retain the audit trail.
      await client.query("DELETE FROM notifications WHERE ticket_id=$1", [ticket.id]);
      await client.query("DELETE FROM attachments WHERE ticket_id=$1", [ticket.id]);
      await client.query("DELETE FROM ticket_comments WHERE ticket_id=$1", [ticket.id]);
      await client.query("DELETE FROM ticket_messages WHERE ticket_id=$1", [ticket.id]);
      await client.query("DELETE FROM ticket_events WHERE ticket_id=$1", [ticket.id]);
      await client.query("DELETE FROM tickets WHERE id=$1", [ticket.id]);
      await audit(client, req.user.id, "delete", "tickets", ticket.id, {
        status: ticket.status,
        closedAt: ticket.closed_at,
      });
    });
    res.json({ ok: true });
  });
  const performAction = (forcedAction) => async (req, res) => {
    const action = forcedAction || req.body?.action;
    if (["accept", "escalate"].includes(action))
      assert(
        false,
        403,
        "Không được tự nhận hoặc chuyển người xử lý. Chỉ Admin được phân công Ticket.",
      );
    if (action === "assign")
      assert(req.user.role === "admin", 403, "Chỉ Admin được phân công Ticket.");
    else if (action === "withdraw")
      assert(req.user.role === "end-user", 403, "Chỉ End User được thu hồi Ticket của mình.");
    else if (action === "classify")
      assert(
        ["admin", "end-user"].includes(req.user.role),
        403,
        "Chỉ Admin và End User được chỉnh phân loại Ticket.",
      );
    else if (action === "return-to-helpdesk")
      assert(
        req.user.role === "technician",
        403,
        "Chỉ Technician được trả Ticket về hàng đợi Helpdesk.",
      );
    else if (!["confirm", "reopen"].includes(action))
      assert(
        ["helpdesk", "technician"].includes(req.user.role),
        403,
        "Bạn không có quyền xử lý Ticket.",
      );
    const input = actionSchema.parse(
      forcedAction ? { ...req.body, action: forcedAction } : req.body,
    );
    assert(
      !input.assigneeId || action === "assign",
      403,
      "Chỉ Admin được chọn người xử lý qua thao tác phân công.",
    );
    const updated = await transaction(pool, async (client) => {
      const ticket = await getTicket(client, req.user, req.params.id, true);
      assert(
        ticket.version === input.version,
        409,
        "Ticket vừa được cập nhật. Hãy tải lại trước khi thao tác.",
      );
      assert(ticket.status !== "Đã thu hồi", 409, "Ticket đã được thu hồi.");
      const previous = ticket.status;
      const previousAssigneeId = ticket.assignee_id;
      const owner = ticket.assignee_id === req.user.id;
      const helpdesk = req.user.role === "helpdesk";
      const technician = req.user.role === "technician";
      const classify = async (proposal = false) => {
        assert(
          input.priority && input.category && input.assetId !== undefined,
          400,
          "Chọn đủ mức ưu tiên, loại yêu cầu và thiết bị liên quan trước khi lưu hoặc phân công.",
        );
        if (input.assetId)
          await assertAssetAccess(
            client,
            proposal ? { id: ticket.requester_id, role: "end-user" } : req.user,
            input.assetId,
          );
        if (proposal) {
          ticket.requested_priority = input.priority;
          ticket.requested_category = input.category;
          ticket.requested_asset_id = input.assetId || null;
        }
        if (!proposal || (!ticket.classified_by && !ticket.assignee_id)) {
          ticket.priority = input.priority;
          ticket.category = input.category;
          ticket.asset_id = input.assetId || null;
          ticket.due_at = new Date(
            new Date(ticket.created_at).getTime() + slaMinutes[input.priority] * 60000,
          );
        }
        if (!proposal) {
          ticket.classified_by = req.user.id;
          ticket.classification_confirmed_at = new Date();
        }
      };
      switch (input.action) {
        case "withdraw":
          assert(
            ticket.requester_id === req.user.id,
            403,
            "Chỉ người yêu cầu được thu hồi Ticket.",
          );
          assert(
            ticket.status === "Mới" &&
              !ticket.assignee_id &&
              !ticket.assigned_by &&
              !ticket.accepted_at &&
              !ticket.queue_role,
            409,
            "Chỉ có thể thu hồi Ticket trước lần phân công đầu tiên.",
          );
          ticket.status = "Đã thu hồi";
          break;
        case "assign": {
          assert(
            !["Đã giải quyết", "Đã đóng"].includes(ticket.status),
            409,
            "Không thể phân công Ticket đã giải quyết đang chờ xác nhận hoặc đã đóng.",
          );
          assert(input.assigneeId, 400, "Chọn nhân viên Helpdesk hoặc Technician.");
          await classify();
          const { rows } = await client.query(
            "SELECT id,role FROM users WHERE id=$1 AND role IN ('helpdesk','technician') AND active FOR SHARE",
            [input.assigneeId],
          );
          assert(rows.length, 400, "Người xử lý phải là Helpdesk hoặc Technician đang hoạt động.");
          assert(
            ticket.queue_role !== "helpdesk" || rows[0].role === "helpdesk",
            409,
            "Ticket đang ở hàng đợi Helpdesk. Hãy phân công một nhân viên Helpdesk.",
          );
          assert(
            ticket.assignee_id !== input.assigneeId,
            409,
            "Ticket đã được giao cho nhân viên này.",
          );
          ticket.assignee_id = input.assigneeId;
          ticket.assigned_by = req.user.id;
          ticket.queue_role = null;
          ticket.status = "Đang xử lý";
          ticket.accepted_at ||= new Date();
          break;
        }
        case "return-to-helpdesk": {
          assert(
            technician && owner,
            403,
            "Chỉ Technician đang phụ trách được trả Ticket về Helpdesk.",
          );
          assert(ticket.status !== "Đã đóng", 409, "Ticket đã đóng.");
          assert(input.note.length >= 10, 400, "Nhập lý do trả về Helpdesk ít nhất 10 ký tự.");
          ticket.assignee_id = null;
          ticket.assigned_by = null;
          ticket.queue_role = "helpdesk";
          ticket.status = "Mới";
          ticket.solution = "";
          ticket.resolved_at = null;
          break;
        }
        case "start":
          assert(
            (technician || helpdesk) && owner && ticket.status === "Mới",
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
          ticket.closed_automatically = false;
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
          ticket.sla_alert_due_at = null;
          ticket.sla_alert_assignee_id = null;
          break;
        case "classify":
          assert(ticket.status !== "Đã đóng", 409, "Ticket đã đóng.");
          assert(
            req.user.role === "admin" ||
              (req.user.role === "end-user" && ticket.requester_id === req.user.id),
            403,
            "Không được chỉnh Ticket của người khác.",
          );
          await classify(req.user.role === "end-user");
          break;
      }
      const { rows } = await client.query(
        `UPDATE tickets SET status=$2,assignee_id=$3,solution=$4,accepted_at=$5,resolved_at=$6,closed_at=$7,
        priority=$8,category=$9,asset_id=$10,due_at=$11,queue_role=$12,assigned_by=$13,
        requested_priority=$14,requested_category=$15,requested_asset_id=$16,classified_by=$17,classification_confirmed_at=$18,
        closed_automatically=$19,sla_alert_due_at=$20,sla_alert_assignee_id=$21,updated_at=now(),version=version+1 WHERE id=$1 RETURNING *`,
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
          ticket.queue_role,
          ticket.assigned_by,
          ticket.requested_priority,
          ticket.requested_category,
          ticket.requested_asset_id,
          ticket.classified_by,
          ticket.classification_confirmed_at,
          ticket.closed_automatically,
          ticket.sla_alert_due_at,
          ticket.sla_alert_assignee_id,
        ],
      );
      await event(
        client,
        rows[0],
        req.user.id,
        input.action,
        input.note,
        previous,
        previousAssigneeId,
      );
      return rows[0];
    });
    res.json(updated);
  };
  router.post("/:id/actions", performAction());
  router.post("/:id/assign", performAction("assign"));
  router.post("/:id/return-to-helpdesk", performAction("return-to-helpdesk"));

  router.get("/:id/messages", async (req, res) => {
    const messages = await transaction(pool, async (client) => {
      const ticket = await getTicket(client, req.user, req.params.id, true);
      assert(
        canReadConversation(req.user, ticket),
        403,
        "Bạn không có quyền đọc hội thoại Ticket này.",
      );
      return (await client.query(messageSelect, [ticket.id])).rows;
    });
    res.json(messages);
  });
  const sendMessage =
    (legacy = false) =>
    async (req, res) => {
      const input = z
        .object({ body: text(1, 10000), internal: z.boolean().default(false) })
        .strict()
        .parse(req.body);
      assert(legacy || !input.internal, 400, "Tin nhắn hội thoại không phải ghi chú nội bộ.");
      await transaction(pool, async (client) => {
        const ticket = await getTicket(client, req.user, req.params.id, true);
        assert(
          canReadConversation(req.user, ticket),
          403,
          "Chỉ người yêu cầu và người đang xử lý được tham gia hội thoại.",
        );
        assert(
          !["Đã đóng", "Đã thu hồi"].includes(ticket.status),
          409,
          "Ticket đã đóng hoặc đã thu hồi.",
        );
        assert(ticket.assignee_id, 409, "Ticket đang chờ Admin phân công người xử lý.");
        assert(
          !input.internal || req.user.role === "technician",
          403,
          "Không được tạo ghi chú nội bộ.",
        );
        const messageId = randomUUID();
        if (input.internal) {
          await client.query(
            "INSERT INTO ticket_comments(id,ticket_id,author_id,body,internal) VALUES($1,$2,$3,$4,true)",
            [messageId, ticket.id, req.user.id, input.body],
          );
        } else {
          await client.query(
            "INSERT INTO ticket_messages(id,ticket_id,sender_id,body) VALUES($1,$2,$3,$4)",
            [messageId, ticket.id, req.user.id, input.body],
          );
        }
        // Audit identifies the message without exposing private conversation content.
        await audit(
          client,
          req.user.id,
          input.internal ? "comment" : "message",
          "tickets",
          ticket.id,
          {
            messageId,
            internal: input.internal,
          },
        );
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
        if (!input.internal && req.user.role === "end-user" && ticket.status === "Chờ phản hồi") {
          const updated = (
            await client.query(
              "UPDATE tickets SET status='Đang xử lý',updated_at=now(),version=version+1 WHERE id=$1 RETURNING *",
              [ticket.id],
            )
          ).rows[0];
          await event(
            client,
            updated,
            req.user.id,
            "information-received",
            "Người yêu cầu đã bổ sung thông tin qua hội thoại.",
            ticket.status,
            ticket.assignee_id,
          );
        }
      });
      res.status(201).json({ ok: true });
    };
  router.post("/:id/messages", sendMessage());
  router.post("/:id/comments", sendMessage(true));
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
