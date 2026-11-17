import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { transaction } from "./db.mjs";
const tables = [
  "departments",
  "users",
  "assets",
  "asset_assignments",
  "software",
  "software_installations",
  "documents",
  "tickets",
  "ticket_comments",
  "ticket_events",
  "attachments",
  "audit_log",
  "notifications",
];
export async function createBackup(pool, passphrase) {
  if (!passphrase || passphrase.length < 16)
    throw new Error("BACKUP_PASSPHRASE cần ít nhất 16 ký tự.");
  const data = await transaction(pool, async (client) => {
    await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = {};
    for (const table of tables) {
      const { rows } = await client.query(`SELECT * FROM ${table}`);
      snapshot[table] = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            Buffer.isBuffer(value) ? { $binary: value.toString("base64") } : value,
          ]),
        ),
      );
    }
    return snapshot;
  });
  const salt = randomBytes(16),
    iv = randomBytes(12),
    key = scryptSync(passphrase, salt, 32),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return {
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
    createdAt: new Date().toISOString(),
  };
}
export async function restoreBackup(pool, backup, passphrase) {
  if (backup.version !== 1) throw new Error("Phiên bản backup không được hỗ trợ.");
  const key = scryptSync(passphrase, Buffer.from(backup.salt, "base64"), 32),
    decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(backup.iv, "base64"));
  decipher.setAuthTag(Buffer.from(backup.tag, "base64"));
  const snapshot = JSON.parse(
    Buffer.concat([decipher.update(Buffer.from(backup.data, "base64")), decipher.final()]).toString(
      "utf8",
    ),
  );
  await transaction(pool, async (client) => {
    await client.query("LOCK TABLE " + tables.join(",") + " IN ACCESS EXCLUSIVE MODE");
    for (const table of tables) {
      if (Number((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count))
        throw new Error(
          "Chỉ khôi phục vào database rỗng đã chạy migration; dữ liệu hiện có được giữ nguyên.",
        );
    }
    for (const table of tables) {
      const allowed = (
        await client.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",
          [table],
        )
      ).rows.map((r) => r.column_name);
      if (!Array.isArray(snapshot[table])) throw new Error("Backup thiếu bảng " + table);
      for (const row of snapshot[table]) {
        const keys = Object.keys(row);
        if (keys.some((k) => !allowed.includes(k)))
          throw new Error("Backup chứa cột không hợp lệ.");
        const values = keys.map((k) => {
          const v = row[k];
          return v && typeof v === "object" && "$binary" in v
            ? Buffer.from(v.$binary, "base64")
            : v;
        });
        await client.query(
          `INSERT INTO ${table}(${keys.map((k) => '"' + k + '"').join(",")}) VALUES(${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
          values,
        );
      }
    }
    await client.query(
      "SELECT setval('ticket_number',GREATEST(10000,COALESCE(max(substring(id from 4)::bigint),10000))) FROM tickets",
    );
  });
  return Object.fromEntries(tables.map((table) => [table, snapshot[table].length]));
}
