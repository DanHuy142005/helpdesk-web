import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import pg from "pg";
import request from "supertest";
import { createApp } from "../app.mjs";
import { migrate } from "../db.mjs";
import { seed } from "../seed.mjs";
import { startLocalDatabase } from "../../scripts/database.mjs";
import { createBackup, restoreBackup } from "../backup.mjs";
import { runTicketMaintenance } from "../maintenance.mjs";
import { phoneSchema, optionalPhoneSchema } from "../phone.mjs";

const schema = "test_" + randomBytes(8).toString("hex");
let db, pool, adminPool, app, fixture, accounts;
const password = randomBytes(24).toString("base64url");
before(async () => {
  delete process.env.SMS_WEBHOOK_URL;
  delete process.env.SMS_API_KEY;
  db = process.env.TEST_DATABASE_URL ? null : await startLocalDatabase();
  const url = process.env.TEST_DATABASE_URL || db.url;
  adminPool = new pg.Pool({ connectionString: url });
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
  await migrate(pool);
  fixture = await seed(pool, { password });
  const secondHelpdesk = { id: randomUUID(), email: "helpdesk2@nexdesk.local", role: "helpdesk" };
  await pool.query(
    `INSERT INTO users(id,code,name,email,password_hash,role,department_id,position)
    SELECT $1,'NV-HD2','Helpdesk kiểm thử',$2,password_hash,'helpdesk',department_id,position FROM users WHERE role='helpdesk' LIMIT 1`,
    [secondHelpdesk.id, secondHelpdesk.email],
  );
  fixture.accounts.push(secondHelpdesk);
  app = createApp(pool);
  accounts = {};
  for (const account of fixture.accounts) {
    const agent = request.agent(app);
    const result = await agent
      .post("/api/auth/login")
      .send({ email: account.email, password })
      .expect(200);
    assert.match(result.headers["set-cookie"][0], /HttpOnly/);
    assert.match(result.headers["set-cookie"][0], /SameSite=Strict/);
    accounts[account.email.split("@")[0]] = { ...account, agent, csrf: result.body.csrfToken };
  }
});
after(async () => {
  await pool?.end();
  if (adminPool) {
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
  }
  await db?.stop();
});
const call = (account, method, path, body = {}) =>
  account.agent[method]("/api" + path)
    .set("X-CSRF-Token", account.csrf)
    .send(body);
const create = async (account = accounts.user) => {
  const r = await call(account, "post", "/tickets", {
    title: "Kiểm thử yêu cầu hỗ trợ",
    description: "Mô tả chi tiết sự cố để kiểm thử tích hợp.",
    category: "Phần cứng",
    priority: "Trung bình",
  }).expect(201);
  return r.body;
};
const act = async (account, ticket, action, extra = {}) => {
  const r = await call(account, "post", "/tickets/" + ticket.id + "/actions", {
    action,
    ...(action === "assign"
      ? { priority: ticket.priority, category: ticket.category, assetId: ticket.asset_id || null }
      : {}),
    version: ticket.version,
    ...extra,
  }).expect(200);
  return r.body;
};

test("Authentication, CSRF, origin and server-side role checks", async () => {
  await request(app).get("/api/workspace").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: accounts.user.email, password: "incorrect-password" })
    .expect(401);
  await accounts.admin.agent
    .post("/api/departments")
    .send({ id: "A", name: "X", head: "" })
    .expect(403);
  await call(accounts.admin, "post", "/departments", { id: "XX", name: "X", head: "" })
    .set("Origin", "https://evil.example")
    .expect(403);
  await call(accounts.user, "post", "/departments", { id: "XX", name: "X", head: "" }).expect(403);
  await call(accounts.user, "put", "/users/" + accounts.user.id, { role: "admin" }).expect(403);
  const w = await accounts.user.agent.get("/api/workspace").expect(200);
  assert.equal(w.body.audits.length, 0);
  assert.equal(w.body.departments.length, 0);
  assert.equal(w.body.software.length, 0);
  assert(w.body.users.every((u) => u.id === accounts.user.id));
  assert(!JSON.stringify(w.body).includes("password_hash"));
});
test("Validation, no cross-user ticket access, and SQL parameterization", async () => {
  const delegated = {
    title: "Admin tạo yêu cầu hỗ trợ",
    description: "Tạo yêu cầu thay End User để hỗ trợ công việc.",
    category: "Phần cứng",
    priority: "Cao",
  };
  await call(accounts.helpdesk, "post", "/tickets", delegated).expect(403);
  await call(accounts.admin, "post", "/tickets", delegated).expect(400);
  await call(accounts.admin, "post", "/tickets", {
    ...delegated,
    requesterId: accounts.helpdesk.id,
  }).expect(400);
  const delegatedTicket = (
    await call(accounts.admin, "post", "/tickets", {
      ...delegated,
      requesterId: accounts.user.id,
    }).expect(201)
  ).body;
  assert.equal(delegatedTicket.requester_id, accounts.user.id);
  await call(accounts.user, "post", "/tickets", {
    title: "X",
    description: "",
    category: "Phần cứng",
    priority: "Cao",
  }).expect(400);
  const t = await create(accounts.user2);
  await accounts.user.agent.get("/api/tickets/" + t.id).expect(404);
  await call(accounts.user, "post", "/tickets/" + t.id + "/comments", {
    body: "Truy cập chéo",
  }).expect(404);
  await accounts.technician.agent.get("/api/tickets/" + t.id).expect(404);
  await accounts.helpdesk.agent
    .get("/api/tickets")
    .query({ q: "' OR 1=1 --" })
    .expect(200)
    .expect((r) => assert.equal(r.body.length, 0));
});
test("Helpdesk resolves simple incident, only requester confirms closure, feedback persists", async () => {
  let t = await create();
  t = await act(accounts.admin, t, "assign", { assigneeId: accounts.helpdesk.id });
  await call(accounts.admin, "post", "/tickets/" + t.id + "/actions", {
    action: "confirm",
    version: t.version,
  }).expect(403);
  t = await act(accounts.helpdesk, t, "resolve", {
    note: "Đã kiểm tra cấu hình và khắc phục sự cố thành công.",
  });
  t = await act(accounts.user, t, "confirm");
  assert.equal(t.status, "Đã đóng");
  await call(accounts.user, "post", "/tickets/" + t.id + "/feedback", {
    rating: 5,
    comment: "Hỗ trợ tốt",
  }).expect(201);
  await call(accounts.user, "post", "/tickets/" + t.id + "/feedback", { rating: 4 }).expect(409);
  const result = await accounts.user.agent.get("/api/tickets/" + t.id).expect(200);
  assert.equal(result.body.rating, 5);
  assert(result.body.events.some((e) => e.action === "confirm"));
  assert(result.body.solution.length > 10);
});
test("Admin assigns Technician; return to Helpdesk queue, Admin reassigns, requester rejects and confirms", async () => {
  let t = await create();
  t = await act(accounts.admin, t, "assign", {
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.technician.id,
    note: "Cần chuyên môn kỹ thuật, đã kiểm tra các bước cơ bản.",
  });
  assert.equal(t.assignee_id, accounts.technician.id);
  t = await act(accounts.technician, t, "wait", { note: "Chờ người dùng xác minh thiết bị." });
  t = await act(accounts.technician, t, "resume");
  t = await act(accounts.technician, t, "resolve", {
    note: "Đã cập nhật driver và kiểm tra hoạt động ổn định.",
  });
  t = await act(accounts.user, t, "reopen", {
    note: "Sự cố vẫn xảy ra sau khi khởi động lại máy.",
  });
  assert.equal(t.status, "Đang xử lý");
  t = await act(accounts.technician, t, "return-to-helpdesk", {
    note: "Cần Helpdesk phối hợp kiểm tra tại máy người dùng.",
  });
  assert.equal(t.assignee_id, null);
  assert.equal(t.queue_role, "helpdesk");
  t = await act(accounts.admin, t, "assign", { assigneeId: accounts.helpdesk.id });
  t = await act(accounts.helpdesk, t, "resolve", {
    note: "Đã thay thế cáp và kiểm thử lại hoàn tất.",
  });
  t = await act(accounts.user, t, "confirm");
  const detail = await accounts.user.agent.get("/api/tickets/" + t.id).expect(200);
  assert(detail.body.events.some((event) => event.action === "return-to-helpdesk"));
  assert.equal(detail.body.events.filter((event) => event.action === "assign").length, 2);
});
test("Concurrent Admin assignment has one winner and one assignment event", async () => {
  const t = await create();
  const results = await Promise.all(
    [accounts.helpdesk.id, accounts.technician.id].map((assigneeId) =>
      call(accounts.admin, "post", "/tickets/" + t.id + "/assign", {
        assigneeId,
        priority: t.priority,
        category: t.category,
        assetId: null,
        version: t.version,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM ticket_events WHERE ticket_id=$1 AND action='assign'",
          [t.id],
        )
      ).rows[0].count,
    ),
    1,
  );
});
test("Disabled assignee assignment rolls back the ticket and event", async () => {
  let t = await create();
  t = await act(accounts.admin, t, "assign", { assigneeId: accounts.helpdesk.id });
  await pool.query("UPDATE users SET active=false WHERE id=$1", [accounts.technician2.id]);
  await call(accounts.admin, "post", "/tickets/" + t.id + "/assign", {
    version: t.version,
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.technician2.id,
    note: "Cần chuyển cho kỹ thuật viên chuyên môn.",
  }).expect(400);
  const unchanged = await accounts.helpdesk.agent.get("/api/tickets/" + t.id).expect(200);
  assert.equal(unchanged.body.version, t.version);
  assert.equal(unchanged.body.events.length, 2);
  await accounts.technician2.agent.get("/api/workspace").expect(401);
  await pool.query("UPDATE users SET active=true WHERE id=$1", [accounts.technician2.id]);
});
test("Technician internal notes remain private; Helpdesk has no internal-note action", async () => {
  const t = await act(accounts.admin, await create(), "assign", {
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.technician.id,
  });
  await call(accounts.technician, "post", "/tickets/" + t.id + "/comments", {
    body: "Ghi chú nội bộ chỉ IT được xem.",
    internal: true,
  }).expect(201);
  const user = await accounts.user.agent.get("/api/tickets/" + t.id).expect(200),
    staff = await accounts.technician.agent.get("/api/tickets/" + t.id).expect(200);
  assert.equal(user.body.comments.length, 0);
  assert.equal(staff.body.comments.length, 1);
  await call(accounts.user, "post", "/tickets/" + t.id + "/comments", {
    body: "Xâm phạm",
    internal: true,
  }).expect(403);
  const assignedHelpdesk = await act(accounts.admin, t, "assign", {
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.helpdesk.id,
  });
  await call(accounts.helpdesk, "post", "/tickets/" + t.id + "/comments", {
    body: "Không được thêm ghi chú nội bộ.",
    internal: true,
  }).expect(403);
  const helpdeskDetail = await accounts.helpdesk.agent
    .get("/api/tickets/" + assignedHelpdesk.id)
    .expect(200);
  assert.equal(helpdeskDetail.body.comments.length, 0);
});
test("Only Admin assigns; legacy self-accept/escalation and assignee injection are forbidden", async () => {
  const t = await create();
  for (const account of [accounts.helpdesk, accounts.technician, accounts.user]) {
    await call(account, "post", `/tickets/${t.id}/assign`, {
      version: t.version,
      priority: "Trung bình",
      category: "Phần cứng",
      assetId: null,
      assigneeId: account.id,
    }).expect(403);
    for (const action of ["assign", "accept", "escalate"])
      await call(account, "post", `/tickets/${t.id}/actions`, {
        action,
        version: t.version,
        priority: "Trung bình",
        category: "Phần cứng",
        assetId: null,
        assigneeId: accounts.technician.id,
      }).expect(403);
  }
  for (const account of [accounts.helpdesk, accounts.technician]) {
    await account.agent.get(`/api/tickets/${t.id}`).expect(404);
    const workspace = (await account.agent.get("/api/workspace").expect(200)).body;
    assert(!workspace.tickets.some((ticket) => ticket.id === t.id));
    assert(!workspace.events.some((event) => event.ticket_id === t.id));
    assert(!workspace.notifications.some((notification) => notification.ticket_id === t.id));
  }
  await call(accounts.admin, "post", `/tickets/${t.id}/assign`, {
    version: t.version,
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.user.id,
  }).expect(400);
  const assigned = await act(accounts.admin, t, "assign", { assigneeId: accounts.helpdesk.id });
  await call(accounts.helpdesk, "post", `/tickets/${t.id}/actions`, {
    action: "wait",
    version: assigned.version,
    note: "Đợi kiểm tra",
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.technician.id,
  }).expect(403);
  await call(accounts.helpdesk, "post", `/tickets/${t.id}/return-to-helpdesk`, {
    version: assigned.version,
    note: "Không được trả ticket này.",
  }).expect(403);
  const detail = (await accounts.admin.agent.get(`/api/tickets/${t.id}`).expect(200)).body;
  assert.equal(detail.version, assigned.version);
  assert.equal(detail.assignee_id, accounts.helpdesk.id);
  assert.equal(detail.events.filter((event) => event.action === "assign").length, 1);
});

test("Technician returns only own ticket with reason; queue requires Admin to assign a Helpdesk", async () => {
  let t = await act(accounts.admin, await create(), "assign", {
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.technician.id,
  });
  await call(accounts.technician2, "post", `/tickets/${t.id}/return-to-helpdesk`, {
    version: t.version,
    note: "Ticket không thuộc tôi.",
  }).expect(404);
  await call(accounts.technician, "post", `/tickets/${t.id}/return-to-helpdesk`, {
    version: t.version,
    note: "",
  }).expect(400);
  await call(accounts.technician, "post", `/tickets/${t.id}/return-to-helpdesk`, {
    version: t.version,
    note: "Lý do chuyển hợp lệ.",
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.helpdesk.id,
  }).expect(403);
  const response = await call(accounts.technician, "post", `/tickets/${t.id}/return-to-helpdesk`, {
    version: t.version,
    note: "Cần Helpdesk hỗ trợ người dùng tại văn phòng.",
  }).expect(200);
  t = response.body;
  assert.equal(t.status, "Mới");
  assert.equal(t.assignee_id, null);
  assert.equal(t.queue_role, "helpdesk");
  await accounts.technician.agent.get(`/api/tickets/${t.id}`).expect(404);
  await accounts.helpdesk.agent.get(`/api/tickets/${t.id}`).expect(404);
  await call(accounts.admin, "post", `/tickets/${t.id}/assign`, {
    version: t.version,
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
    assigneeId: accounts.technician2.id,
  }).expect(409);
  t = (
    await call(accounts.admin, "post", `/tickets/${t.id}/assign`, {
      version: t.version,
      priority: "Trung bình",
      category: "Phần cứng",
      assetId: null,
      assigneeId: accounts.helpdesk.id,
    }).expect(200)
  ).body;
  assert.equal(t.queue_role, null);
  assert.equal(t.assigned_by, accounts.admin.id);
  assert.equal(t.status, "Đang xử lý");
  const detail = (await accounts.admin.agent.get(`/api/tickets/${t.id}`).expect(200)).body;
  const returned = detail.events.find((event) => event.action === "return-to-helpdesk");
  assert.equal(returned.actor_id, accounts.technician.id);
  assert(returned.note.length > 10 && returned.created_at);
});

test("Private ticket chat persists across reassignment and excludes Admin and former/unassigned staff", async () => {
  let t = await create();
  await call(accounts.user, "post", `/tickets/${t.id}/messages`, {
    body: "Chưa có người xử lý.",
  }).expect(409);
  t = await act(accounts.admin, t, "assign", { assigneeId: accounts.technician.id });
  const secret = "Nội dung hội thoại riêng " + randomUUID();
  for (const account of [accounts.user, accounts.technician])
    await call(account, "post", `/tickets/${t.id}/messages`, { body: secret + account.id }).expect(
      201,
    );
  await call(accounts.technician, "post", `/tickets/${t.id}/messages`, { body: "   " }).expect(400);
  for (const account of [
    accounts.admin,
    accounts.helpdesk,
    accounts.helpdesk2,
    accounts.technician2,
    accounts.user2,
  ]) {
    const status = account === accounts.admin ? 403 : 404;
    await account.agent.get(`/api/tickets/${t.id}/messages`).expect(status);
    await call(account, "post", `/tickets/${t.id}/messages`, { body: "Không được gửi." }).expect(
      status,
    );
    await call(account, "post", `/tickets/${t.id}/comments`, {
      body: "Không được dùng endpoint cũ.",
    }).expect(status);
  }
  const adminDetail = (await accounts.admin.agent.get(`/api/tickets/${t.id}`).expect(200)).body;
  assert.deepEqual(adminDetail.messages, []);
  assert.equal(adminDetail.can_chat, false);
  const audit = (await accounts.admin.agent.get("/api/reports").expect(200)).body;
  assert(!JSON.stringify(audit).includes(secret));
  t = await act(accounts.technician, t, "return-to-helpdesk", {
    note: "Nhờ Helpdesk tiếp tục kiểm tra tài khoản người dùng.",
  });
  t = await act(accounts.admin, t, "assign", { assigneeId: accounts.helpdesk.id });
  const thread = (await accounts.helpdesk.agent.get(`/api/tickets/${t.id}/messages`).expect(200))
    .body;
  assert.equal(thread.length, 2);
  assert(thread.every((message) => message.author_id && message.author && message.created_at));
  await accounts.technician.agent.get(`/api/tickets/${t.id}/messages`).expect(404);
  await call(accounts.technician, "post", `/tickets/${t.id}/messages`, {
    body: "Quyền đã hết.",
  }).expect(404);
  t = await act(accounts.admin, t, "assign", { assigneeId: accounts.helpdesk2.id });
  await accounts.helpdesk.agent.get(`/api/tickets/${t.id}/messages`).expect(404);
  await call(accounts.helpdesk, "post", `/tickets/${t.id}/comments`, {
    body: "Không còn quyền.",
  }).expect(404);
  assert.equal(
    (await accounts.helpdesk2.agent.get(`/api/tickets/${t.id}/messages`).expect(200)).body.length,
    2,
  );
  t = await act(accounts.helpdesk2, t, "resolve", {
    note: "Đã kiểm tra và khắc phục hoàn tất vấn đề.",
  });
  t = await act(accounts.user, t, "confirm");
  await call(accounts.user, "post", `/tickets/${t.id}/messages`, {
    body: "Ticket đã đóng.",
  }).expect(409);
  await accounts.user.agent.get(`/api/tickets/${t.id}/messages`).expect(200);
});

test("End User chat supplies missing information and resumes only the assigned waiting ticket", async () => {
  let t = await act(accounts.admin, await create(), "assign", { assigneeId: accounts.helpdesk.id });
  t = await act(accounts.helpdesk, t, "wait", { note: "Xin bổ sung thông báo lỗi." });
  await call(accounts.user, "post", `/tickets/${t.id}/messages`, {
    body: "Màn hình hiển thị lỗi kết nối máy chủ.",
  }).expect(201);
  const detail = (await accounts.user.agent.get(`/api/tickets/${t.id}`).expect(200)).body;
  assert.equal(detail.status, "Đang xử lý");
  assert.equal(detail.assignee_id, accounts.helpdesk.id);
  assert.equal(detail.version, t.version + 1);
  assert(detail.events.some((event) => event.action === "information-received"));
});

test("Migration upgrades old conversations without losing internal notes and is idempotent", async () => {
  const legacySchema = "test_" + randomBytes(8).toString("hex");
  await adminPool.query(`CREATE SCHEMA ${legacySchema}`);
  const legacy = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL || db.url,
    options: `-c search_path=${legacySchema}`,
  });
  try {
    await legacy.query(await readFile(new URL("../db/001-initial.sql", import.meta.url), "utf8"));
    await legacy.query(
      "CREATE TABLE schema_versions(version integer PRIMARY KEY,applied_at timestamptz DEFAULT now()); INSERT INTO schema_versions(version) VALUES(1)",
    );
    for (const account of [accounts.user, accounts.technician])
      await legacy.query(
        "INSERT INTO users(id,code,name,email,password_hash,role) VALUES($1,$2,$2,$3,'test-hash',$4)",
        [account.id, account.role, account.email, account.role],
      );
    await legacy.query(
      "INSERT INTO tickets(id,title,description,category,priority,status,requester_id,assignee_id,due_at) VALUES('TK-99999','Legacy','Legacy ticket','Phần cứng','Cao','Đã chuyển',$1,$2,now())",
      [accounts.user.id, accounts.technician.id],
    );
    for (const internal of [false, true])
      await legacy.query(
        "INSERT INTO ticket_comments(id,ticket_id,author_id,body,internal) VALUES($1,'TK-99999',$2,$3,$4)",
        [
          randomUUID(),
          accounts.technician.id,
          internal ? "Internal note" : "Public exchange",
          internal,
        ],
      );
    const oldGuideId = randomUUID(),
      customGuideId = randomUUID();
    for (const [id, content] of [
      [
        oldGuideId,
        "Nhân viên gửi yêu cầu. Helpdesk xác minh và tiếp nhận. Nếu cần chuyên môn sâu, chuyển cho Technician kèm các bước đã thử. Người phụ trách ghi kết quả. Người yêu cầu xác nhận đóng hoặc yêu cầu xử lý tiếp.",
      ],
      [customGuideId, "Hướng dẫn riêng đã được người dùng chỉnh sửa."],
    ])
      await legacy.query(
        "INSERT INTO documents(id,title,category,content,visibility,author_id) VALUES($1,'Quy trình xử lý sự cố CNTT','Quy trình',$2,'public',$3)",
        [id, content, accounts.technician.id],
      );
    await legacy.query(
      "INSERT INTO assets(id,name,type,notes,specs) VALUES('LEGACY-ASSET','Thiết bị cũ','Laptop',$1,$2)",
      ["Ghi chú trước migration", { cpu: "CPU cũ" }],
    );
    await migrate(legacy);
    await migrate(legacy);
    assert.match(
      (await legacy.query("SELECT content FROM documents WHERE id=$1", [oldGuideId])).rows[0]
        .content,
      /Admin phân công/,
    );
    assert.equal(
      (await legacy.query("SELECT content FROM documents WHERE id=$1", [customGuideId])).rows[0]
        .content,
      "Hướng dẫn riêng đã được người dùng chỉnh sửa.",
    );
    assert.equal((await legacy.query("SELECT * FROM ticket_messages")).rows.length, 1);
    assert.equal((await legacy.query("SELECT * FROM ticket_comments")).rows.length, 2);
    assert.equal((await legacy.query("SELECT status FROM tickets")).rows[0].status, "Đang xử lý");
    const archive = await legacy.query(
      "SELECT details FROM audit_log WHERE action='archive-asset-details' AND entity_id='LEGACY-ASSET'",
    );
    assert.deepEqual(
      archive.rows.map((row) => row.details),
      [{ notes: "Ghi chú trước migration", specs: { cpu: "CPU cũ" } }],
    );
    assert.equal(
      (await legacy.query("SELECT access_level FROM documents WHERE id=$1", [oldGuideId])).rows[0]
        .access_level,
      "draft_public",
    );
    assert.equal((await legacy.query("SELECT * FROM schema_versions")).rows.length, 7);
  } finally {
    await legacy.end();
    await adminPool.query(`DROP SCHEMA ${legacySchema} CASCADE`);
  }
});

test("Attachment type checks and download ownership", async () => {
  const t = await create();
  const file = await accounts.user.agent
    .post("/api/tickets/" + t.id + "/attachments")
    .set("X-CSRF-Token", accounts.user.csrf)
    .attach("file", Buffer.from("NexDesk test file"), {
      filename: "test.txt",
      contentType: "text/plain",
    })
    .expect(201);
  await accounts.user.agent.get("/api/attachments/" + file.body.id).expect(200);
  await accounts.user2.agent.get("/api/attachments/" + file.body.id).expect(404);
  await accounts.user.agent
    .post("/api/tickets/" + t.id + "/attachments")
    .set("X-CSRF-Token", accounts.user.csrf)
    .attach("file", Buffer.from("<script>bad</script>"), {
      filename: "fake.png",
      contentType: "image/png",
    })
    .expect(400);
});

test("Requester can withdraw a new ticket once and cannot withdraw a ticket returned to the queue", async () => {
  const ticket = await create();
  const path = `/tickets/${ticket.id}/actions`;
  const withdraw = { action: "withdraw", version: ticket.version };
  await call(accounts.user2, "post", path, withdraw).expect(404);
  await call(accounts.admin, "post", path, withdraw).expect(403);
  const withdrawn = (await call(accounts.user, "post", path, withdraw).expect(200)).body;
  assert.equal(withdrawn.status, "Đã thu hồi");
  assert.equal(withdrawn.assignee_id, null);
  await call(accounts.user, "post", path, { ...withdraw, version: withdrawn.version }).expect(409);
  await call(accounts.admin, "post", path, {
    action: "assign",
    version: withdrawn.version,
    assigneeId: accounts.helpdesk.id,
    priority: "Trung bình",
    category: "Phần cứng",
    assetId: null,
  }).expect(409);
  await accounts.user.agent
    .post(`/api/tickets/${ticket.id}/attachments`)
    .set("X-CSRF-Token", accounts.user.csrf)
    .attach("file", Buffer.from("withdrawn"), { filename: "test.txt", contentType: "text/plain" })
    .expect(409);
  const detail = (await accounts.user.agent.get(`/api/tickets/${ticket.id}`).expect(200)).body;
  assert.equal(
    detail.events.filter((event) => event.action === "withdraw" && event.to_status === "Đã thu hồi")
      .length,
    1,
  );
  const notices = (await accounts.admin.agent.get("/api/workspace").expect(200)).body.notifications;
  assert(
    notices.some(
      (notice) => notice.ticket_id === ticket.id && notice.message.includes("Đã thu hồi"),
    ),
  );

  let previouslyAssigned = await act(accounts.admin, await create(), "assign", {
    assigneeId: accounts.technician.id,
  });
  const tryWithdraw = () =>
    call(accounts.user, "post", `/tickets/${previouslyAssigned.id}/actions`, {
      action: "withdraw",
      version: previouslyAssigned.version,
    }).expect(409);
  await tryWithdraw();
  previouslyAssigned = await act(accounts.technician, previouslyAssigned, "return-to-helpdesk", {
    note: "Chuyển lại hàng đợi để Helpdesk tiếp tục hỗ trợ.",
  });
  assert.equal(previouslyAssigned.status, "Mới");
  assert.equal(previouslyAssigned.assignee_id, null);
  await tryWithdraw();
});

test("Withdrawal and Admin assignment cannot both succeed on the same version", async () => {
  const ticket = await create();
  const path = `/tickets/${ticket.id}/actions`;
  const [withdrawn, assigned] = await Promise.all([
    call(accounts.user, "post", path, { action: "withdraw", version: ticket.version }),
    call(accounts.admin, "post", path, {
      action: "assign",
      version: ticket.version,
      assigneeId: accounts.helpdesk.id,
      priority: "Trung bình",
      category: "Phần cứng",
      assetId: null,
    }),
  ]);
  assert.deepEqual([withdrawn.status, assigned.status].sort(), [200, 409]);
  const detail = (await accounts.user.agent.get(`/api/tickets/${ticket.id}`).expect(200)).body;
  assert.equal(detail.status, withdrawn.status === 200 ? "Đã thu hồi" : "Đang xử lý");
  assert.equal(
    detail.events.filter((event) => ["assign", "withdraw"].includes(event.action)).length,
    1,
  );
});

test("Only Admin can delete a closed ticket and its dependent records; audit survives", async () => {
  let ticket = await create();
  const path = `/tickets/${ticket.id}`;
  await call(accounts.admin, "delete", path, { version: ticket.version }).expect(409);
  await call(accounts.admin, "delete", path, { version: 0 }).expect(400);
  const file = await accounts.user.agent
    .post(`/api${path}/attachments`)
    .set("X-CSRF-Token", accounts.user.csrf)
    .attach("file", Buffer.from("file to delete"), {
      filename: "test.txt",
      contentType: "text/plain",
    })
    .expect(201);
  ticket = await act(accounts.admin, ticket, "assign", { assigneeId: accounts.technician.id });
  await call(accounts.user, "post", `${path}/messages`, { body: "Hội thoại cần được xóa." }).expect(
    201,
  );
  await call(accounts.technician, "post", `${path}/comments`, {
    body: "Ghi chú nội bộ.",
    internal: true,
  }).expect(201);
  ticket = await act(accounts.technician, ticket, "resolve", {
    note: "Đã sửa lỗi và xác nhận thiết bị hoạt động ổn định.",
  });
  await call(accounts.admin, "delete", path, { version: ticket.version }).expect(409);
  ticket = await act(accounts.user, ticket, "confirm");
  for (const account of [accounts.user, accounts.helpdesk, accounts.technician]) {
    await call(account, "delete", path, { version: ticket.version }).expect(403);
  }
  await call(accounts.admin, "delete", path, { version: ticket.version - 1 }).expect(409);
  await call(accounts.admin, "delete", path, { version: ticket.version }).expect(200);
  await accounts.admin.agent.get(`/api${path}`).expect(404);
  await accounts.user.agent.get(`/api${path}`).expect(404);
  await accounts.admin.agent.get(`/api/attachments/${file.body.id}`).expect(404);
  for (const table of [
    "notifications",
    "attachments",
    "ticket_comments",
    "ticket_messages",
    "ticket_events",
  ]) {
    assert.equal(
      (await pool.query(`SELECT 1 FROM ${table} WHERE ticket_id=$1`, [ticket.id])).rowCount,
      0,
    );
  }
  const log = (
    await pool.query(
      "SELECT actor_id, details FROM audit_log WHERE action='delete' AND entity='tickets' AND entity_id=$1",
      [ticket.id],
    )
  ).rows;
  assert.equal(log.length, 1);
  assert.equal(log[0].actor_id, accounts.admin.id);
  assert.equal(log[0].details.status, "Đã đóng");
});
test("Multiple screenshots are created atomically with the ticket and follow ticket access permissions", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=",
    "base64",
  );
  const submit = () =>
    accounts.user.agent
      .post("/api/tickets")
      .set("X-CSRF-Token", accounts.user.csrf)
      .field("title", "Yêu cầu có nhiều ảnh chụp")
      .field("description", "Mô tả lỗi kèm nhiều ảnh để nhân viên IT kiểm tra.")
      .field("category", "Phần cứng")
      .field("priority", "Trung bình");
  const counts = async () =>
    (
      await pool.query(
        "SELECT (SELECT count(*) FROM tickets)::int tickets, (SELECT count(*) FROM attachments)::int attachments, (SELECT count(*) FROM ticket_events)::int events",
      )
    ).rows[0];
  const before = await counts();
  await submit()
    .attach("files", png, { filename: "ok.png", contentType: "image/png" })
    .attach("files", Buffer.from("not-an-image"), {
      filename: "invalid.png",
      contentType: "image/png",
    })
    .expect(400);
  assert.deepEqual(await counts(), before);
  const created = await submit()
    .attach("files", png, { filename: "ảnh lỗi 1.png", contentType: "image/png" })
    .attach("files", png, { filename: "screenshot-2.png", contentType: "image/png" })
    .expect(201);
  assert.equal(created.body.attachments.length, 2);
  assert.equal(created.body.attachments[0].name, "ảnh lỗi 1.png");
  const imageId = created.body.attachments[0].id;
  const file = await accounts.admin.agent
    .get(`/api/attachments/${imageId}?inline=1`)
    .expect(200)
    .expect("Content-Type", /image\/png/)
    .expect("Content-Disposition", /^inline/);
  assert(file.body.equals(png));
  await accounts.user2.agent.get(`/api/attachments/${imageId}?inline=1`).expect(404);
  let t = await act(accounts.admin, created.body, "assign", { assigneeId: accounts.technician.id });
  await accounts.technician.agent.get(`/api/attachments/${imageId}?inline=1`).expect(200);
  t = await act(accounts.admin, t, "assign", { assigneeId: accounts.helpdesk.id });
  await accounts.helpdesk.agent.get(`/api/attachments/${imageId}?inline=1`).expect(200);
  await accounts.technician.agent.get(`/api/attachments/${imageId}?inline=1`).expect(404);
  const more = await accounts.helpdesk.agent
    .post(`/api/tickets/${t.id}/attachments`)
    .set("X-CSRF-Token", accounts.helpdesk.csrf)
    .attach("files", png, { filename: "more-1.png", contentType: "image/png" })
    .attach("files", png, { filename: "more-2.png", contentType: "image/png" })
    .expect(201);
  assert.equal(more.body.attachments.length, 2);
  const detail = (await accounts.user.agent.get(`/api/tickets/${t.id}`).expect(200)).body;
  assert.equal(detail.attachments.length, 4);
});

test("Department, account CRUD, password hashing, disable and session revocation", async () => {
  await call(accounts.admin, "post", "/departments", {
    id: "QA",
    name: "Kiểm thử",
    head: "Trưởng bộ phận",
  }).expect(201);
  const body = {
    code: "NV-QA",
    name: "Người kiểm thử",
    email: "qa@nexdesk.local",
    role: "end-user",
    department_id: "QA",
    position: "Nhân viên",
    active: true,
    password,
  };
  const user = await call(accounts.admin, "post", "/users", body).expect(201);
  assert(!user.body.password_hash);
  await call(accounts.admin, "post", "/users", body).expect(409);
  const stored = (await pool.query("SELECT password_hash FROM users WHERE id=$1", [user.body.id]))
    .rows[0];
  assert(!stored.password_hash.includes(password));
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: body.email, password }).expect(200);
  const changedPassword = randomBytes(24).toString("hex");
  await call(accounts.admin, "put", "/users/" + user.body.id, {
    ...body,
    password: changedPassword,
  }).expect(200);
  await agent.get("/api/workspace").expect(401);
  await agent.post("/api/auth/login").send({ email: body.email, password }).expect(401);
  await agent
    .post("/api/auth/login")
    .send({ email: body.email, password: changedPassword })
    .expect(200);
  const { password: _, ...update } = body;
  await call(accounts.admin, "put", "/users/" + user.body.id, { ...update, active: false }).expect(
    200,
  );
  await agent.get("/api/workspace").expect(401);
  await call(accounts.admin, "put", "/users/" + accounts.admin.id, {
    ...update,
    code: accounts.admin.code,
    email: accounts.admin.email,
    role: "end-user",
  }).expect(400);
});
test("Asset uniqueness and atomic assign, transfer, return, including concurrent conflict", async () => {
  const body = {
    id: "AS-QA",
    name: "Thiết bị kiểm thử",
    type: "Laptop",
    serial: "SN-QA",
    location: "Kho",
    warranty: "2028-07-15",
    status: "Trong kho",
  };
  const created = await call(accounts.admin, "post", "/assets", body)
    .expect(201)
    .expect((r) => assert.equal(r.body.warranty, "2028-07-15"));
  const currentAsset = async () =>
    (await accounts.admin.agent.get("/api/workspace").expect(200)).body.assets.find(
      (asset) => asset.id === body.id,
    );
  await call(accounts.admin, "post", "/assets", body).expect(409);
  const payload = {
    action: "assign",
    version: created.body.version,
    userId: accounts.user.id,
    reason: "Cấp cho công việc kiểm thử",
    condition: "Hoạt động tốt",
  };
  const responses = await Promise.all(
    [1, 2].map(() => call(accounts.admin, "post", "/assets/AS-QA/assignments", payload)),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  await call(accounts.admin, "post", "/assets/AS-QA/assignments", {
    ...payload,
    action: "transfer",
    version: (await currentAsset()).version,
    userId: accounts.user2.id,
  }).expect(201);
  const history = await accounts.admin.agent.get("/api/assets/AS-QA/history").expect(200);
  assert.equal(history.body.length, 2);
  assert.equal(history.body.filter((a) => !a.ended_at).length, 1);
  await accounts.user.agent.get("/api/assets/AS-QA/history").expect(403);
  const updated = await call(accounts.admin, "put", "/assets/AS-QA", {
    ...body,
    status: "Bảo trì",
  }).expect(200);
  await call(accounts.admin, "post", "/assets/AS-QA/assignments", {
    ...payload,
    action: "return",
    version: updated.body.version,
  }).expect(201);
  assert.equal(
    (await pool.query("SELECT status FROM assets WHERE id='AS-QA'")).rows[0].status,
    "Bảo trì",
  );
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM asset_assignments WHERE asset_id='AS-QA' AND ended_at IS NULL",
        )
      ).rows[0].count,
    ),
    0,
  );
});
test("License allocation cannot exceed seat count", async () => {
  const s = await call(accounts.admin, "post", "/software", {
    name: "QA Software",
    vendor: "QA",
    version: "1",
    license_type: "Thuê bao",
    seats: 1,
    expires: null,
  }).expect(201);
  await call(accounts.admin, "post", "/software/" + s.body.id + "/installations", {
    assetId: "LT-001",
    action: "install",
  }).expect(200);
  await call(accounts.admin, "post", "/software/" + s.body.id + "/installations", {
    assetId: "PC-001",
    action: "install",
  }).expect(409);
  await call(accounts.admin, "post", "/software/" + s.body.id + "/installations", {
    assetId: "LT-001",
    action: "remove",
  }).expect(200);
});
test("Draft publication and document visibility", async () => {
  const draft = await call(accounts.helpdesk, "post", "/documents", {
    title: "Bản nháp hướng dẫn kỹ thuật",
    category: "Hướng dẫn",
    content: "Nội dung bản nháp kỹ thuật chưa công bố.",
    published: true,
    visibility: "public",
  }).expect(201);
  assert.equal(draft.body.published, false);
  await accounts.user.agent.get("/api/documents/" + draft.body.id).expect(404);
  await call(accounts.admin, "put", "/documents/" + draft.body.id, {
    title: draft.body.title,
    category: "Hướng dẫn",
    content: draft.body.content,
    published: true,
    visibility: "public",
  }).expect(200);
  await accounts.user.agent.get("/api/documents/" + draft.body.id).expect(200);
  await call(accounts.admin, "put", "/documents/" + draft.body.id, {
    title: draft.body.title,
    category: "Hướng dẫn",
    content: draft.body.content,
    published: true,
    visibility: "internal",
  }).expect(200);
  await accounts.user.agent.get("/api/documents/" + draft.body.id).expect(404);
});
test("Reports and audit reflect database data and enforce permissions", async () => {
  const report = await accounts.admin.agent.get("/api/reports").expect(200);
  assert(report.body.tickets.length > 7);
  assert(report.body.audits.some((a) => a.action === "return-to-helpdesk"));
  await accounts.admin.agent.get("/api/reports").query({ from: "bad-date" }).expect(400);
  await accounts.admin.agent
    .get("/api/reports")
    .set("Accept", "text/csv")
    .expect(200)
    .expect("Content-Type", /text\/csv/);
  await accounts.user.agent.get("/api/reports").expect(403);
  await call(accounts.user, "post", "/notifications/read", {}).expect(200);
});
test("PostgreSQL persistence across a new connection and seed is idempotent", async () => {
  assert.equal(await seed(pool, { password }), null);
  const client = await pool.connect();
  const before = (await client.query("SELECT count(*) FROM tickets")).rows[0].count;
  client.release();
  const next = await pool.connect();
  assert.equal((await next.query("SELECT count(*) FROM tickets")).rows[0].count, before);
  next.release();
});
test("Logout invalidates the server-side session", async () => {
  const agent = request.agent(app),
    auth = await agent
      .post("/api/auth/login")
      .send({ email: accounts.user.email, password })
      .expect(200);
  await agent
    .post("/api/auth/logout")
    .set("X-CSRF-Token", auth.body.csrfToken)
    .send({})
    .expect(200);
  await agent.get("/api/auth/me").expect(401);
});
test("One browser cookie jar supports independent tab sessions, CSRF and authenticated image links", async () => {
  const browser = request.agent(app);
  const tabs = [];
  for (const account of [accounts.admin, accounts.helpdesk, accounts.technician, accounts.user]) {
    const tab = randomUUID();
    const result = await browser
      .post("/api/auth/login")
      .set("X-Nexdesk-Tab", tab)
      .send({ email: account.email, password })
      .expect(200);
    assert.match(result.headers["set-cookie"][0], /HttpOnly/);
    assert(
      result.headers["set-cookie"][0].startsWith(
        "nexdesk_session_" + tab.replaceAll("-", "") + "=",
      ),
    );
    tabs.push({ tab, csrf: result.body.csrfToken, account });
  }
  for (const { tab, account } of tabs) {
    const result = await browser.get("/api/auth/me").set("X-Nexdesk-Tab", tab).expect(200);
    assert.equal(result.body.user.id, account.id);
  }
  await browser.get("/api/auth/me").set("X-Nexdesk-Tab", randomUUID()).expect(401);
  await browser.get("/api/auth/me").set("X-Nexdesk-Tab", "invalid").expect(400);
  await accounts.admin.agent.get("/api/auth/me").set("X-Nexdesk-Tab", randomUUID()).expect(401);
  await browser
    .post("/api/notifications/read")
    .set("X-Nexdesk-Tab", tabs[1].tab)
    .set("X-CSRF-Token", tabs[0].csrf)
    .send({})
    .expect(403);
  const image = (
    await pool.query(
      "SELECT a.id FROM attachments a JOIN tickets t ON t.id=a.ticket_id WHERE t.assignee_id=$1 AND t.requester_id=$2 LIMIT 1",
      [accounts.helpdesk.id, accounts.user.id],
    )
  ).rows[0];
  assert(image);
  await browser.get(`/api/attachments/${image.id}?inline=1&tab=${tabs[1].tab}`).expect(200);
  await browser.get(`/api/attachments/${image.id}?inline=1&tab=${tabs[2].tab}`).expect(404);
  await browser
    .post("/api/auth/logout")
    .set("X-Nexdesk-Tab", tabs[0].tab)
    .set("X-CSRF-Token", tabs[0].csrf)
    .send({})
    .expect(200);
  await browser.get("/api/auth/me").set("X-Nexdesk-Tab", tabs[0].tab).expect(401);
  for (const { tab } of tabs.slice(1))
    await browser.get("/api/auth/me").set("X-Nexdesk-Tab", tab).expect(200);
});

async function passwordAccount() {
  const suffix = randomBytes(6).toString("hex"),
    initialPassword = randomBytes(24).toString("base64url");
  const created = await call(accounts.admin, "post", "/users", {
    phone: "+849" + (BigInt("0x" + suffix) % 100000000n).toString().padStart(8, "0"),
    code: "AUTH-" + suffix,
    name: "Người dùng nội bộ",
    email: suffix + "@example.org",
    role: "end-user",
    department_id: "IT",
    position: "Nhân viên",
    active: true,
    password: initialPassword,
  }).expect(201);
  const agent = request.agent(app);
  const login = await agent
    .post("/api/auth/login")
    .send({ email: created.body.email, password: initialPassword })
    .expect(200);
  return { ...created.body, initialPassword, agent, csrf: login.body.csrfToken };
}

async function requestOtp(account) {
  return (
    await request(app)
      .post("/api/auth/password/otp/request")
      .send({ phone: account.phone })
      .expect(200)
  ).body.requestId;
}
async function recoveryProof(account) {
  await pool.query("DELETE FROM password_reset_otps WHERE user_id=$1", [account.id]);
  const requestId = await requestOtp(account);
  return (
    await request(app)
      .post("/api/auth/password/otp/verify")
      .send({ requestId, otp: "123456" })
      .expect(200)
  ).body.challenge;
}
test("Phone OTP recovery validates code, accepts seven characters, consumes proof and revokes all account sessions", async () => {
  const account = await passwordAccount(),
    nextPassword = "Seven7!";
  const requestId = await requestOtp(account);
  const stored = (
    await pool.query("SELECT * FROM password_reset_otps WHERE user_id=$1", [account.id])
  ).rows[0];
  assert.notEqual(stored.token_hash, requestId);
  assert.notEqual(stored.otp_hash, "123456");
  await request(app)
    .post("/api/auth/password/otp/request")
    .send({ phone: account.phone })
    .expect(429);
  const wrong = await request(app)
    .post("/api/auth/password/otp/verify")
    .send({ requestId, otp: "000000" })
    .expect(400);
  assert.equal(
    (await pool.query("SELECT attempts FROM password_reset_otps WHERE user_id=$1", [account.id]))
      .rows[0].attempts,
    1,
  );
  const missing = await request(app)
    .post("/api/auth/password/otp/request")
    .send({ phone: "+84999999999" })
    .expect(200);
  const unknown = await request(app)
    .post("/api/auth/password/otp/verify")
    .send({ requestId: missing.body.requestId, otp: "123456" })
    .expect(400);
  assert.equal(wrong.body.error, unknown.body.error);
  const challenge = (
    await request(app)
      .post("/api/auth/password/otp/verify")
      .send({ requestId, otp: "123456" })
      .expect(200)
  ).body.challenge;
  await request(app)
    .post("/api/auth/password/otp/verify")
    .send({ requestId, otp: "123456" })
    .expect(400);
  const reset = (password, confirmation = password) =>
    request(app)
      .post("/api/auth/password/reset")
      .send({ challenge, password, confirmPassword: confirmation });
  await reset("Six6!!").expect(400);
  await reset(nextPassword, "Mismatch7").expect(400);
  await reset(account.initialPassword).expect(400);
  await reset(nextPassword).expect(200);
  await account.agent.get("/api/auth/me").expect(401);
  await reset(nextPassword).expect(400);
  await request(app)
    .post("/api/auth/login")
    .send({ email: account.email, password: account.initialPassword })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: account.email, password: nextPassword })
    .expect(200);
  await accounts.admin.agent.get("/api/auth/me").expect(200);
  const audit = JSON.stringify(
    (await pool.query("SELECT details FROM audit_log WHERE actor_id=$1", [account.id])).rows,
  );
  assert(!audit.includes(challenge) && !audit.includes(nextPassword));
});
test("OTP attempt limit, expiry, password and phone binding prevent stale proof reuse and concurrent reset", async () => {
  const account = await passwordAccount();
  let requestId = await requestOtp(account);
  for (let i = 0; i < 5; i++)
    await request(app)
      .post("/api/auth/password/otp/verify")
      .send({ requestId, otp: "000000" })
      .expect(400);
  await request(app)
    .post("/api/auth/password/otp/verify")
    .send({ requestId, otp: "123456" })
    .expect(400);
  await pool.query("DELETE FROM password_reset_otps WHERE user_id=$1", [account.id]);
  requestId = await requestOtp(account);
  await pool.query(
    "UPDATE password_reset_otps SET expires_at=now()-interval '1 second' WHERE user_id=$1",
    [account.id],
  );
  await request(app)
    .post("/api/auth/password/otp/verify")
    .send({ requestId, otp: "123456" })
    .expect(400);
  let challenge = await recoveryProof(account);
  const nextPassword = "Newpass7";
  const reset = () =>
    request(app)
      .post("/api/auth/password/reset")
      .send({ challenge, password: nextPassword, confirmPassword: nextPassword });
  await pool.query(
    "UPDATE password_reset_challenges SET expires_at=now()-interval '1 second' WHERE user_id=$1",
    [account.id],
  );
  await reset().expect(400);
  challenge = await recoveryProof(account);
  const original = (await pool.query("SELECT password_hash FROM users WHERE id=$1", [account.id]))
    .rows[0].password_hash;
  await pool.query("UPDATE users SET password_hash='changed' WHERE id=$1", [account.id]);
  await reset().expect(400);
  await pool.query("UPDATE users SET password_hash=$2 WHERE id=$1", [account.id, original]);
  challenge = await recoveryProof(account);
  await pool.query("UPDATE users SET phone=NULL WHERE id=$1", [account.id]);
  await reset().expect(400);
  await pool.query("UPDATE users SET phone=$2 WHERE id=$1", [account.id, account.phone]);
  const results = await Promise.all([reset(), reset()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
});
test("Phone normalization accepts national and international display formats consistently", () => {
  for (const input of [
    "0901234567",
    "090 123 4567",
    "0901-234-567",
    "0901.234.567",
    "+84901234567",
    "84901234567",
    "+84 (0) 901 234 567",
    "0084 (0) 901 234 567",
    "０９０１２３４５６７",
    "0901–234–567",
  ])
    assert.equal(phoneSchema.parse(input), "+84901234567", input);
  assert.equal(phoneSchema.parse("028 1234 5678"), "+842812345678");
  for (const input of ["", "   ", null]) assert.equal(optionalPhoneSchema.parse(input), null);
  for (const input of ["12345", "090123456", "0901abc567", "+", "test@example.org"])
    assert.equal(phoneSchema.safeParse(input).success, false);
});
test("Linked phone numbers normalize and stay unique; only Admin may manage them", async () => {
  const account = await passwordAccount();
  const body = {
    code: account.code,
    name: account.name,
    email: account.email,
    role: account.role,
    department_id: "IT",
    position: account.position,
    active: true,
    phone: "0" + account.phone.slice(3),
  };
  const updated = await call(accounts.admin, "put", "/users/" + account.id, body).expect(200);
  assert.equal(updated.body.phone, account.phone);
  const invalid = await call(accounts.admin, "put", "/users/" + account.id, {
    ...body,
    phone: "12345",
  }).expect(400);
  assert.match(invalid.body.error, /Số điện thoại không hợp lệ/);
  assert.equal(invalid.body.fields[0].field, "phone");
  await call(accounts.admin, "post", "/users", {
    ...body,
    code: "UNIQUE-" + randomBytes(3).toString("hex"),
    email: randomBytes(3).toString("hex") + "@example.org",
    password: "1234567",
  })
    .expect(409)
    .expect((response) => assert.equal(response.body.fields[0].field, "phone"));
  await call(accounts.user, "put", "/users/" + account.id, body).expect(403);
  const challenge = await recoveryProof(account);
  await call(accounts.admin, "put", "/users/" + account.id, {
    ...body,
    phone: "+841" + account.phone.slice(4),
  }).expect(200);
  await request(app)
    .post("/api/auth/password/reset")
    .send({ challenge, password: "1234567", confirmPassword: "1234567" })
    .expect(400);
});
test("SMS adapter reports delivery only after gateway acceptance and permits retry after provider failure", async () => {
  const account = await passwordAccount();
  let status = 503,
    payload,
    authorization;
  const gateway = createServer(async (req, res) => {
    let data = "";
    for await (const chunk of req) data += chunk;
    payload = JSON.parse(data);
    authorization = req.headers.authorization;
    res.writeHead(status).end();
  });
  await new Promise((done) => gateway.listen(0, "127.0.0.1", done));
  process.env.SMS_WEBHOOK_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.SMS_API_KEY = "test-gateway-key";
  try {
    await request(app)
      .post("/api/auth/password/otp/request")
      .send({ phone: account.phone })
      .expect(503);
    assert.equal(
      (await pool.query("SELECT * FROM password_reset_otps WHERE user_id=$1", [account.id])).rows
        .length,
      0,
    );
    status = 202;
    const response = await request(app)
      .post("/api/auth/password/otp/request")
      .send({ phone: account.phone })
      .expect(200);
    assert.equal(response.body.delivery, "sms");
    assert.equal(payload.phone, account.phone);
    assert(payload.message.includes("123456"));
    assert.equal(authorization, "Bearer test-gateway-key");
  } finally {
    delete process.env.SMS_WEBHOOK_URL;
    delete process.env.SMS_API_KEY;
    await new Promise((done) => gateway.close(done));
  }
});
test("Admin must explicitly classify all three fields before assignment; handler priority follows Admin", async () => {
  let t = await create();
  const direct = (fields) =>
    accounts.admin.agent
      .post(`/api/tickets/${t.id}/assign`)
      .set("X-CSRF-Token", accounts.admin.csrf)
      .send({ version: t.version, assigneeId: accounts.helpdesk.id, ...fields });
  await direct({}).expect(400);
  await direct({ priority: "Cao", category: "Phần cứng" }).expect(400);
  await direct({ priority: "Cao", category: "Phần cứng", assetId: "" }).expect(400);
  assert.equal((await accounts.admin.agent.get(`/api/tickets/${t.id}`)).body.version, t.version);
  t = (await direct({ priority: "Thấp", category: "Khác", assetId: null }).expect(200)).body;
  assert.equal(t.classified_by, accounts.admin.id);
  for (const account of [accounts.helpdesk, accounts.technician])
    await call(account, "post", `/tickets/${t.id}/actions`, {
      action: "classify",
      version: t.version,
      priority: "Khẩn cấp",
      category: "Khác",
      assetId: null,
    }).expect(403);
  t = await act(accounts.user, t, "classify", {
    priority: "Khẩn cấp",
    category: "Phần mềm",
    assetId: null,
  });
  const handler = (await accounts.helpdesk.agent.get(`/api/tickets/${t.id}`).expect(200)).body;
  assert.equal(handler.priority, "Thấp");
  assert.equal(handler.category, "Khác");
  assert.equal(handler.requested_priority, "Khẩn cấp");
  // Legacy assigned tickets may not have an Admin classifier recorded yet.
  await pool.query("UPDATE tickets SET classified_by=NULL WHERE id=$1", [t.id]);
  t = await act(accounts.user, t, "classify", { priority: "Cao", category: "Khác", assetId: null });
  assert.equal(t.priority, "Thấp");
  await call(accounts.user2, "post", `/tickets/${t.id}/actions`, {
    action: "classify",
    version: t.version,
    priority: "Cao",
    category: "Khác",
    assetId: null,
  }).expect(404);
  await call(accounts.user, "post", `/tickets/${t.id}/actions`, {
    action: "classify",
    version: t.version,
    priority: "Cao",
    category: "Khác",
    assetId: "PC-001",
  }).expect(403);
  const due = new Date(t.due_at).getTime();
  t = await act(accounts.admin, t, "classify", {
    priority: "Cao",
    category: "Phần mềm",
    assetId: null,
  });
  assert(new Date(t.due_at).getTime() < due);
  assert.equal(new Date(t.due_at).getTime() - new Date(t.created_at).getTime(), 30 * 60000);
});
test("Admin configures auto-close; worker respects resolved time, manual closure and reopening and records system history", async () => {
  await accounts.user.agent.get("/api/settings/tickets").expect(403);
  await call(accounts.helpdesk, "put", "/settings/tickets", {
    autoCloseEnabled: true,
    autoCloseMinutes: 1,
    version: 1,
  }).expect(403);
  let policy = (await accounts.admin.agent.get("/api/settings/tickets").expect(200)).body;
  assert.equal(policy.autoCloseEnabled, false);
  let t = await act(accounts.admin, await create(), "assign", { assigneeId: accounts.helpdesk.id });
  t = await act(accounts.helpdesk, t, "resolve", { note: "Đã khắc phục xong sự cố theo yêu cầu." });
  const future = new Date(new Date(t.resolved_at).getTime() + 2 * 60000);
  await runTicketMaintenance(pool, future);
  assert.equal(
    (await accounts.user.agent.get(`/api/tickets/${t.id}`)).body.status,
    "Đã giải quyết",
  );
  policy = (
    await call(accounts.admin, "put", "/settings/tickets", {
      autoCloseEnabled: true,
      autoCloseMinutes: 1,
      version: policy.version,
    }).expect(200)
  ).body;
  await call(accounts.admin, "put", "/settings/tickets", {
    autoCloseEnabled: false,
    autoCloseMinutes: 1,
    version: 1,
  }).expect(409);
  await call(accounts.admin, "put", "/settings/tickets", {
    autoCloseEnabled: true,
    autoCloseMinutes: 0,
    version: policy.version,
  }).expect(400);
  await runTicketMaintenance(pool, new Date(new Date(t.resolved_at).getTime() + 30000));
  assert.equal(
    (await accounts.user.agent.get(`/api/tickets/${t.id}`)).body.status,
    "Đã giải quyết",
  );
  await Promise.all([runTicketMaintenance(pool, future), runTicketMaintenance(pool, future)]);
  let detail = (await accounts.user.agent.get(`/api/tickets/${t.id}`).expect(200)).body;
  assert.equal(detail.status, "Đã đóng");
  assert.equal(detail.closed_automatically, true);
  const events = detail.events.filter((e) => e.action === "auto-close");
  assert.equal(events.length, 1);
  assert.equal(events[0].actor, "Hệ thống");
  await call(accounts.user, "post", `/tickets/${t.id}/actions`, {
    action: "confirm",
    version: t.version,
  }).expect(409);
  let reopened = await act(accounts.admin, await create(), "assign", {
    assigneeId: accounts.technician.id,
  });
  reopened = await act(accounts.technician, reopened, "resolve", {
    note: "Đã hoàn tất xử lý ban đầu tại thiết bị.",
  });
  reopened = await act(accounts.user, reopened, "reopen", {
    note: "Sự cố vẫn còn khi tôi kiểm tra lại.",
  });
  await runTicketMaintenance(pool, new Date(Date.now() + 120000));
  assert.equal(
    (await accounts.user.agent.get(`/api/tickets/${reopened.id}`)).body.status,
    "Đang xử lý",
  );
  let manual = await act(accounts.admin, await create(), "assign", {
    assigneeId: accounts.helpdesk.id,
  });
  manual = await act(accounts.helpdesk, manual, "resolve", {
    note: "Đã hoàn thành xử lý và xác minh kết quả.",
  });
  manual = await act(accounts.user, manual, "confirm");
  await runTicketMaintenance(pool, new Date(Date.now() + 120000));
  assert.equal(
    (await accounts.user.agent.get(`/api/tickets/${manual.id}`)).body.closed_automatically,
    false,
  );
  await call(accounts.admin, "put", "/settings/tickets", {
    autoCloseEnabled: false,
    autoCloseMinutes: 1440,
    version: policy.version,
  }).expect(200);
});
test("Overdue SLA alerts notify Admin and current handler once per deadline and assignment", async () => {
  let t = await act(accounts.admin, await create(), "assign", {
    assigneeId: accounts.technician.id,
  });
  await pool.query("UPDATE tickets SET due_at=now()-interval '1 minute' WHERE id=$1", [t.id]);
  const count = async () =>
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM notifications WHERE ticket_id=$1 AND message LIKE '%quá hạn SLA%'",
          [t.id],
        )
      ).rows[0].count,
    );
  await runTicketMaintenance(pool);
  assert.equal(await count(), 2);
  await runTicketMaintenance(pool);
  assert.equal(await count(), 2);
  t = await act(accounts.admin, t, "assign", {
    assigneeId: accounts.helpdesk.id,
    priority: "Khẩn cấp",
    category: "Khác",
    assetId: null,
  });
  await pool.query("UPDATE tickets SET due_at=now()-interval '2 minutes' WHERE id=$1", [t.id]);
  await runTicketMaintenance(pool);
  assert.equal(await count(), 4);
  const rows = (
    await pool.query(
      "SELECT user_id FROM notifications WHERE ticket_id=$1 AND message LIKE '%quá hạn SLA%'",
      [t.id],
    )
  ).rows;
  assert(rows.some((r) => r.user_id === accounts.helpdesk.id));
  assert(!rows.some((r) => r.user_id === accounts.user.id));
});
test("Signed-in password change validates both passwords and requires signing in again", async () => {
  const account = await passwordAccount(),
    nextPassword = randomBytes(24).toString("base64url");
  await call(account, "post", "/auth/password", {
    currentPassword: account.initialPassword,
    password: nextPassword,
    confirmPassword: "wrong-confirmation-123",
  }).expect(400);
  await call(account, "post", "/auth/password", {
    currentPassword: "wrong-current",
    password: nextPassword,
    confirmPassword: nextPassword,
  }).expect(400);
  await call(account, "post", "/auth/password", {
    currentPassword: account.initialPassword,
    password: nextPassword,
    confirmPassword: nextPassword,
  }).expect(200);
  await account.agent.get("/api/auth/me").expect(401);
});

test("Encrypted backup restores all records and attachments into an empty schema", async () => {
  let deleted = await act(accounts.admin, await create(), "assign", {
    assigneeId: accounts.helpdesk.id,
  });
  deleted = await act(accounts.helpdesk, deleted, "resolve", {
    note: "Đã hoàn tất kiểm tra trước khi sao lưu.",
  });
  deleted = await act(accounts.user, deleted, "confirm");
  await call(accounts.admin, "delete", `/tickets/${deleted.id}`, {
    version: deleted.version,
  }).expect(200);
  const passphrase = randomBytes(24).toString("hex");
  const backup = await createBackup(pool, passphrase);
  assert(!backup.data.includes("nexdesk.local"));
  const restoreSchema = "test_" + randomBytes(8).toString("hex");
  await adminPool.query(`CREATE SCHEMA ${restoreSchema}`);
  const restored = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL || db.url,
    options: `-c search_path=${restoreSchema}`,
  });
  try {
    await migrate(restored);
    const counts = await restoreBackup(restored, backup, passphrase);
    const next = (await restored.query("SELECT nextval('ticket_number') AS number")).rows[0].number;
    assert(BigInt(next) > BigInt(deleted.id.slice(3)));
    assert(counts.tickets > 7);
    assert(counts.attachments > 0);
    for (const table of [
      "users",
      "tickets",
      "ticket_messages",
      "asset_assignments",
      "attachments",
      "audit_log",
    ])
      assert.equal(
        Number((await restored.query(`SELECT count(*) FROM ${table}`)).rows[0].count),
        Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count),
      );
    await assert.rejects(() => restoreBackup(restored, backup, passphrase), /database rỗng/);
    await assert.rejects(() => restoreBackup(restored, backup, "wrong-passphrase-for-test"));
    const original = await pool.query("SELECT data FROM attachments LIMIT 1"),
      copy = await restored.query("SELECT data FROM attachments LIMIT 1");
    assert(original.rows[0].data.equals(copy.rows[0].data));
  } finally {
    await restored.end();
    await adminPool.query(`DROP SCHEMA ${restoreSchema} CASCADE`);
  }
});
