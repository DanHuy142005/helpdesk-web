import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password, stored) {
  const [, salt, hash] = stored.split(":");
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(hash, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, status, message) => {
  if (!condition) throw new HttpError(status, message);
};
export const publicUser = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  email: row.email,
  role: row.role,
  departmentId: row.department_id,
  position: row.position,
  active: row.active,
});
export async function audit(client, actor, action, entity, entityId, details = {}) {
  await client.query(
    "INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), actor, action, entity, entityId, JSON.stringify(details)],
  );
}
export function ticketScope(user, alias = "t", offset = 1) {
  if (user.role === "end-user")
    return { sql: `${alias}.requester_id = $${offset}`, values: [user.id] };
  if (user.role === "technician")
    return { sql: `${alias}.assignee_id = $${offset}`, values: [user.id] };
  return { sql: "TRUE", values: [] };
}
export async function getTicket(client, user, id, lock = false) {
  const scope = ticketScope(user, "t", 2);
  const { rows } = await client.query(
    `SELECT t.* FROM tickets t WHERE t.id=$1 AND ${scope.sql}${lock ? " FOR UPDATE OF t" : ""}`,
    [id, ...scope.values],
  );
  assert(rows[0], 404, "Không tìm thấy Ticket hoặc bạn không có quyền truy cập.");
  return rows[0];
}
export async function assertAssetAccess(client, user, id) {
  const { rows } = await client.query(
    `SELECT a.id FROM assets a WHERE a.id=$1 AND ($2::text <> 'end-user' OR EXISTS(SELECT 1 FROM asset_assignments aa WHERE aa.asset_id=a.id AND aa.user_id=$3 AND aa.ended_at IS NULL))`,
    [id, user.role, user.id],
  );
  assert(rows.length, 403, "Thiết bị không thuộc phạm vi truy cập.");
}
