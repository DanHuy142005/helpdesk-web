import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import request from "supertest";
import { createApp } from "../app.mjs";
import { migrate } from "../db.mjs";
import { seed } from "../seed.mjs";
import { startLocalDatabase } from "../../scripts/database.mjs";
import { createBackup, restoreBackup } from "../backup.mjs";

const schema = "test_" + randomBytes(8).toString("hex");
let db, pool, adminPool, app, fixture, accounts;
const password = randomBytes(24).toString("base64url");
before(async () => {
  db = process.env.TEST_DATABASE_URL ? null : await startLocalDatabase();
  const url = process.env.TEST_DATABASE_URL || db.url;
  adminPool = new pg.Pool({ connectionString: url });
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
  await migrate(pool);
  fixture = await seed(pool, { password });
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
  t = await act(accounts.helpdesk, t, "accept");
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
test("Complete escalation, technician result, requester rejection, second resolution, closure", async () => {
  let t = await create();
  t = await act(accounts.helpdesk, t, "accept");
  t = await act(accounts.helpdesk, t, "escalate", {
    assigneeId: accounts.technician.id,
    note: "Cần chuyên môn kỹ thuật, đã kiểm tra các bước cơ bản.",
  });
  assert.equal(t.assignee_id, accounts.technician.id);
  t = await act(accounts.technician, t, "start");
  t = await act(accounts.technician, t, "wait", { note: "Chờ người dùng xác minh thiết bị." });
  t = await act(accounts.technician, t, "resume");
  t = await act(accounts.technician, t, "resolve", {
    note: "Đã cập nhật driver và kiểm tra hoạt động ổn định.",
  });
  t = await act(accounts.user, t, "reopen", {
    note: "Sự cố vẫn xảy ra sau khi khởi động lại máy.",
  });
  assert.equal(t.status, "Đang xử lý");
  t = await act(accounts.technician, t, "resolve", {
    note: "Đã thay thế cáp và kiểm thử lại hoàn tất.",
  });
  t = await act(accounts.user, t, "confirm");
  const detail = await accounts.user.agent.get("/api/tickets/" + t.id).expect(200);
  assert.equal(detail.body.events.length, 10);
});
test("Concurrent ticket acceptance has one winner and one audit event", async () => {
  const t = await create();
  const results = await Promise.all(
    [1, 2].map(() =>
      call(accounts.helpdesk, "post", "/tickets/" + t.id + "/actions", {
        action: "accept",
        version: t.version,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM ticket_events WHERE ticket_id=$1 AND action='accept'",
          [t.id],
        )
      ).rows[0].count,
    ),
    1,
  );
});
test("Disabled technician escalation rolls back the ticket and event", async () => {
  let t = await create();
  t = await act(accounts.helpdesk, t, "accept");
  await pool.query("UPDATE users SET active=false WHERE id=$1", [accounts.technician2.id]);
  await call(accounts.helpdesk, "post", "/tickets/" + t.id + "/actions", {
    action: "escalate",
    version: t.version,
    assigneeId: accounts.technician2.id,
    note: "Cần chuyển cho kỹ thuật viên chuyên môn.",
  }).expect(400);
  const unchanged = await accounts.helpdesk.agent.get("/api/tickets/" + t.id).expect(200);
  assert.equal(unchanged.body.version, t.version);
  assert.equal(unchanged.body.events.length, 2);
  await accounts.technician2.agent.get("/api/workspace").expect(401);
  await pool.query("UPDATE users SET active=true WHERE id=$1", [accounts.technician2.id]);
});
test("Internal notes are hidden from End User", async () => {
  const t = await create();
  await call(accounts.helpdesk, "post", "/tickets/" + t.id + "/comments", {
    body: "Ghi chú nội bộ chỉ IT được xem.",
    internal: true,
  }).expect(201);
  const user = await accounts.user.agent.get("/api/tickets/" + t.id).expect(200),
    staff = await accounts.helpdesk.agent.get("/api/tickets/" + t.id).expect(200);
  assert.equal(user.body.comments.length, 0);
  assert.equal(staff.body.comments.length, 1);
  await call(accounts.user, "post", "/tickets/" + t.id + "/comments", {
    body: "Xâm phạm",
    internal: true,
  }).expect(403);
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
    notes: "",
    status: "Trong kho",
  };
  await call(accounts.admin, "post", "/assets", body)
    .expect(201)
    .expect((r) => assert.equal(r.body.warranty, "2028-07-15"));
  await call(accounts.admin, "post", "/assets", body).expect(409);
  const payload = {
    action: "assign",
    version: 1,
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
    version: 2,
    userId: accounts.user2.id,
  }).expect(201);
  const history = await accounts.admin.agent.get("/api/assets/AS-QA/history").expect(200);
  assert.equal(history.body.length, 2);
  assert.equal(history.body.filter((a) => !a.ended_at).length, 1);
  await accounts.user.agent.get("/api/assets/AS-QA/history").expect(403);
  await call(accounts.admin, "put", "/assets/AS-QA", { ...body, status: "Bảo trì" }).expect(200);
  await call(accounts.admin, "post", "/assets/AS-QA/assignments", {
    ...payload,
    action: "return",
    version: 4,
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
  assert(report.body.audits.some((a) => a.action === "escalate"));
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
test("Encrypted backup restores all records and attachments into an empty schema", async () => {
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
    assert(counts.tickets > 7);
    assert(counts.attachments > 0);
    for (const table of ["users", "tickets", "asset_assignments", "attachments", "audit_log"])
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
