import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "./security.mjs";
import { slaMinutes } from "./tickets.mjs";
import { assets, departments, documents, software, staff } from "./seed-catalog.mjs";
import { requests } from "./seed-requests.mjs";

const minute = 60_000;
const day = 1440;
const action = "add-sample-workspace";

// Table and column names below are owned by the fixture, never entered by users.
async function insertRows(client, table, columns, rows, returning = "") {
  if (!rows.length) return [];
  const placeholders = rows.map(
    (row, index) =>
      "(" + row.map((_, column) => "$" + (index * columns.length + column + 1)).join(",") + ")",
  );
  return (
    await client.query(
      `INSERT INTO ${table}(${columns.join(",")}) VALUES ${placeholders.join(",")}${returning ? " RETURNING " + returning : ""}`,
      rows.flat(),
    )
  ).rows;
}

export async function getSampleAccounts(client) {
  const { rows } = await client.query(
    `SELECT u.id,u.code,u.role,u.department_id FROM users u
     JOIN (VALUES ('NV-001','admin','admin'), ('NV-002','helpdesk','helpdesk'),
       ('NV-003','technician','technician'), ('NV-004','user','end-user'),
       ('NV-005','technician2','technician'), ('NV-006','user2','end-user')) a(code,email,role)
       ON u.code=a.code AND u.email=a.email || '@nexdesk.local' AND u.role=a.role
     WHERE u.active`,
  );
  const initial = await client.query(
    `SELECT 1 FROM audit_log WHERE action='initialize' AND entity='system' AND entity_id='initial'
      AND details @> '{"initialized":true}'
      AND actor_id=$1`,
    [rows.find((user) => user.code === "NV-001")?.id ?? null],
  );
  if (rows.length !== 6 || !initial.rowCount)
    throw new Error("Không tìm thấy đủ dấu hiệu của cơ sở dữ liệu khởi tạo NexDesk.");
  return rows;
}

const feedback = {
  4: "Đã làm việc lại bình thường. Cảm ơn đội hỗ trợ đã theo dõi đến lúc xử lý xong.",
  5: "Hướng dẫn rõ, đã kiểm tra lại và sử dụng bình thường. Cảm ơn đội hỗ trợ!",
};

async function insertRequests(client, people, admin, at) {
  const helpdesk = ["NV-002", "NV-124"];
  const technicians = ["NV-003", "NV-005", "NV-125"];
  const tickets = [];
  const logs = [];
  for (const [index, scenario] of requests.entries()) {
    const [code, asset, category, priority, state, title, description, outcome, stars = null] =
      scenario;
    const returned = state === "Chờ phân công Helpdesk";
    const status = returned ? "Mới" : state;
    const closed = status === "Đã đóng";
    const solved = closed || status === "Đã giải quyết";
    const assigned = returned || !["Mới", "Đã thu hồi"].includes(status);
    const requester = people.get(code).id;
    const handlers =
      returned || ["Mạng & VPN", "Phần cứng", "Thiết bị ngoại vi"].includes(category)
        ? technicians
        : helpdesk;
    const handlerCodes = handlers.filter((candidate) => candidate !== code);
    const handler = assigned ? people.get(handlerCodes[index % handlerCodes.length]).id : null;
    const assignee = returned ? null : handler;
    const age = closed
      ? (1 + ((index * 11) % 42)) * day + index * 14
      : solved
        ? 175 + index * 6
        : [22, 65, 190, 270, 920, 2340][index % 6];
    const created = at(-age);
    const accepted = assigned ? at(-age + (priority === "Khẩn cấp" ? 4 : 9)) : null;
    const resolved = solved ? at(-age + 25 + (index % 7) * 19) : null;
    const confirmed = closed ? at(-age + 170 + (index % 6) * 11) : null;
    const followUp = at(-age + 13);
    const lastEvent = at(-age + 20);
    tickets.push([
      title,
      description,
      category,
      priority,
      status,
      requester,
      assignee,
      asset,
      at(-age + slaMinutes[priority]),
      solved ? outcome : "",
      accepted,
      resolved,
      confirmed,
      stars,
      stars ? feedback[stars] : "",
      created,
      confirmed ?? resolved ?? (assigned || status === "Đã thu hồi" ? lastEvent : created),
      priority,
      category,
      asset,
      assignee ? admin : null,
      assigned ? admin : null,
      accepted,
      returned ? "helpdesk" : null,
    ]);
    const events = [
      [requester, "create", "Đã ghi nhận yêu cầu hỗ trợ.", null, "Mới", null, created],
    ];
    if (assigned) {
      events.push([
        admin,
        "assign",
        "Đã phân công theo nhóm chuyên môn.",
        "Mới",
        "Đang xử lý",
        handler,
        accepted,
      ]);
    }
    if (returned)
      events.push([handler, "return-to-helpdesk", outcome, "Đang xử lý", "Mới", null, lastEvent]);
    if (status === "Chờ phản hồi")
      events.push([handler, "wait", outcome, "Đang xử lý", status, handler, lastEvent]);
    if (solved)
      events.push([handler, "resolve", outcome, "Đang xử lý", "Đã giải quyết", handler, resolved]);
    if (closed)
      events.push([
        requester,
        "confirm",
        "Đã kiểm tra lại và xác nhận kết quả.",
        "Đã giải quyết",
        status,
        handler,
        confirmed,
      ]);
    if (status === "Đã thu hồi")
      events.push([requester, "withdraw", outcome, "Mới", status, null, lastEvent]);
    const messages = assigned
      ? [
          [
            handler,
            status === "Chờ phản hồi" || returned
              ? outcome
              : "Mình đã tiếp nhận yêu cầu và đang kiểm tra thông tin bạn gửi.",
            followUp,
          ],
        ]
      : [];
    if (solved) messages.push([handler, outcome, resolved]);
    if (closed) messages.push([requester, "Mình xác nhận đã sử dụng lại bình thường.", confirmed]);
    logs.push({ title, events, messages });
  }
  const saved = await insertRows(
    client,
    "tickets",
    [
      "title",
      "description",
      "category",
      "priority",
      "status",
      "requester_id",
      "assignee_id",
      "asset_id",
      "due_at",
      "solution",
      "accepted_at",
      "resolved_at",
      "closed_at",
      "rating",
      "feedback",
      "created_at",
      "updated_at",
      "requested_priority",
      "requested_category",
      "requested_asset_id",
      "assigned_by",
      "classified_by",
      "classification_confirmed_at",
      "queue_role",
    ],
    tickets,
    "id,title",
  );
  const ids = new Map(saved.map(({ id, title }) => [title, id]));
  await insertRows(
    client,
    "ticket_events",
    [
      "id",
      "ticket_id",
      "actor_id",
      "action",
      "note",
      "from_status",
      "to_status",
      "assignee_id",
      "created_at",
    ],
    logs.flatMap(({ title, events }) =>
      events.map((event) => [randomUUID(), ids.get(title), ...event]),
    ),
  );
  await insertRows(
    client,
    "ticket_messages",
    ["id", "ticket_id", "sender_id", "body", "created_at"],
    logs.flatMap(({ title, messages }) =>
      messages.map((message) => [randomUUID(), ids.get(title), ...message]),
    ),
  );
}

// Called inside the same transaction as seed, or as a one-time refresh of that seed.
export async function addSampleWorkspace(client, accounts) {
  const previous = await client.query(
    "SELECT 1 FROM audit_log WHERE action=$1 AND entity='system' AND entity_id='workspace-v1'",
    [action],
  );
  if (previous.rowCount) return null;
  const now = Date.now();
  const at = (minutes) => new Date(now + minutes * minute);
  const onDay = (days) =>
    at(days * day)
      .toISOString()
      .slice(0, 10);
  const people = new Map(accounts.map((account) => [account.code, account]));
  const admin = people.get("NV-001").id;
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  await insertRows(client, "departments", ["id", "name", "head"], departments);
  for (const [code, , department, , role = "end-user"] of staff) {
    people.set(code, { id: randomUUID(), department_id: department, role });
  }
  await insertRows(
    client,
    "users",
    [
      "id",
      "code",
      "name",
      "email",
      "password_hash",
      "role",
      "department_id",
      "position",
      "created_at",
    ],
    staff.map(([code, name, department, position], index) => {
      const { id, role } = people.get(code);
      return [
        id,
        code,
        name,
        code.toLowerCase() + "@nexdesk.invalid",
        passwordHash,
        role,
        department,
        position,
        at(-(165 - index) * day),
      ];
    }),
  );
  await insertRows(
    client,
    "assets",
    ["id", "name", "type", "serial", "location", "warranty", "status", "updated_at"],
    assets.map(([id, name, type, location, holder, warranty, stock = "Trong kho"], index) => [
      id,
      name,
      type,
      "NX-" + id,
      location,
      onDay(warranty),
      holder ? "Đang sử dụng" : stock,
      at(-(1 + index) * day),
    ]),
  );
  const allocations = [];
  for (const [index, [id, , , , holder]] of assets.entries()) {
    if (!holder) continue;
    const person = people.get(holder);
    const transferred = ["LT-110", "LT-117", "PC-121"].includes(id);
    if (transferred)
      allocations.push([
        randomUUID(),
        id,
        people.get("NV-125").id,
        "IT",
        admin,
        at(-130 * day),
        at(-(97 - index) * day),
        "Đã kiểm tra và xóa hồ sơ làm việc cũ",
        "Thu hồi máy dự phòng để điều chuyển theo kế hoạch thay thiết bị.",
      ]);
    allocations.push([
      randomUUID(),
      id,
      person.id,
      person.department_id,
      admin,
      at(-(97 - index) * day),
      null,
      "Hoạt động tốt, đủ phụ kiện",
      transferred
        ? "Điều chuyển sau khi kiểm tra và bàn giao thiết bị."
        : "Bàn giao thiết bị theo vị trí công việc.",
    ]);
  }
  await insertRows(
    client,
    "asset_assignments",
    [
      "id",
      "asset_id",
      "user_id",
      "department_id",
      "actor_id",
      "started_at",
      "ended_at",
      "condition",
      "reason",
    ],
    allocations,
  );
  const subscriptions = software.map(
    ([name, vendor, version, license, seats, expires, devices]) => ({
      row: [
        randomUUID(),
        name,
        vendor,
        version,
        license,
        seats,
        expires === null ? null : onDay(expires),
      ],
      devices,
    }),
  );
  await insertRows(
    client,
    "software",
    ["id", "name", "vendor", "version", "license_type", "seats", "expires"],
    subscriptions.map(({ row }) => row),
  );
  await insertRows(
    client,
    "software_installations",
    ["software_id", "asset_id", "actor_id", "installed_at"],
    subscriptions.flatMap(({ row, devices }, index) =>
      devices.map((asset) => [row[0], asset, admin, at(-(38 - index) * day)]),
    ),
  );
  await insertRows(
    client,
    "documents",
    ["id", "title", "category", "content", "access_level", "author_id", "views", "updated_at"],
    documents.map(([title, category, access, views, content], index) => [
      randomUUID(),
      title,
      category,
      content,
      access,
      people.get(index % 2 ? "NV-002" : "NV-001").id,
      views,
      at(-(2 * index + 1) * day),
    ]),
  );
  await insertRequests(client, people, admin, at);

  const counts = {
    departments: departments.length,
    employees: staff.length,
    assets: assets.length,
    software: software.length,
    documents: documents.length,
    tickets: requests.length,
  };
  await client.query(
    "INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details) VALUES($1,$2,$3,'system','workspace-v1',$4)",
    [randomUUID(), admin, action, JSON.stringify(counts)],
  );
  return counts;
}
