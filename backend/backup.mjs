import { randomBytes, randomUUID, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { transaction } from "./db.mjs";
const tables = [
  "departments",
  "users",
  "ticket_policy",
  "assets",
  "asset_assignments",
  "software",
  "software_installations",
  "documents",
  "tickets",
  "ticket_comments",
  "ticket_messages",
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
  // Older backups stored public conversations in ticket_comments.
  snapshot.ticket_policy ||= [{ id: true, auto_close_enabled: false, auto_close_minutes: 1440 }];
  for (const policy of snapshot.ticket_policy) {
    delete policy.version;
    delete policy.updated_by;
  }
  for (const asset of snapshot.assets || []) {
    if (asset.notes || (Object.hasOwn(asset, "specs") && JSON.stringify(asset.specs) !== "{}")) {
      snapshot.audit_log.push({
        id: randomUUID(),
        action: "archive-asset-details",
        entity: "assets",
        entity_id: asset.id,
        details: { notes: asset.notes ?? "", specs: asset.specs === undefined ? {} : asset.specs },
      });
    }
    delete asset.notes;
    delete asset.specs;
    delete asset.version;
  }
  for (const document of snapshot.documents || []) {
    if (Object.hasOwn(document, "published") && Object.hasOwn(document, "visibility")) {
      document.access_level ??= `${document.published ? "published" : "draft"}_${document.visibility}`;
      delete document.published;
      delete document.visibility;
    }
  }
  for (const ticket of snapshot.tickets || []) {
    ticket.requested_priority ??= ticket.priority;
    ticket.requested_category ??= ticket.category;
    if (!("requested_asset_id" in ticket)) ticket.requested_asset_id = ticket.asset_id || null;
  }
  if (!snapshot.ticket_messages && Array.isArray(snapshot.ticket_comments))
    snapshot.ticket_messages = snapshot.ticket_comments
      .filter((comment) => !comment.internal)
      .map((comment) => ({
        id: comment.id,
        ticket_id: comment.ticket_id,
        sender_id: comment.author_id,
        body: comment.body,
        created_at: comment.created_at,
      }));
  await transaction(pool, async (client) => {
    await client.query("LOCK TABLE " + tables.join(",") + " IN ACCESS EXCLUSIVE MODE");
    await client.query(
      "DELETE FROM ticket_policy WHERE id=true AND auto_close_enabled=false AND auto_close_minutes=1440",
    );
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
    // Keep codes recorded in the deletion audit from being issued again after restore.
    await client.query(`SELECT setval('ticket_number', GREATEST(10000,
      (SELECT max(substring(id from 4)::bigint) FROM tickets),
      (SELECT max(substring(entity_id from 4)::bigint) FROM audit_log
       WHERE entity='tickets' AND action='delete' AND entity_id ~ '^TK-[0-9]+$')))`);
    await client.query(
      "UPDATE tickets SET status='Đang xử lý' WHERE status='Đã chuyển' AND assignee_id IS NOT NULL",
    );
  });
  return Object.fromEntries(tables.map((table) => [table, snapshot[table].length]));
}
