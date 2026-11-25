import "../backend/config.mjs";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startLocalDatabase } from "./database.mjs";
import { createPool, transaction } from "../backend/db.mjs";
import { createBackup } from "../backend/backup.mjs";
import { addSampleWorkspace, getSampleAccounts } from "../backend/seed-workspace.mjs";

// Match both the identifier and metadata written by the browser test fixtures.
const qa = {
  tickets: `SELECT id FROM tickets WHERE
    (title ~ '^E2E (doc fixes )?[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$'
      AND description IN ('Kiểm thử luồng Ticket hoàn chỉnh từ giao diện trình duyệt.',
        'Kiểm thử yêu cầu hỗ trợ có ảnh chụp màn hình, phân công và xử lý qua hội thoại.'))
    OR (title ~ '^E2E thu hồi [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$'
      AND description='Yêu cầu sẽ được thu hồi trước khi phân công.')
    OR (title ~ '^QA SLA (msedge|chrome) (helpdesk|technician) [0-9]+$'
      AND description='Kiểm tra cảnh báo SLA và tự động đóng sau khi xử lý.')`,
  documents: `SELECT id FROM documents d
    WHERE title ~ '^Tài liệu QA [A-Z0-9]{8}$'
    AND content='Nội dung tài liệu kỹ thuật để kiểm thử công bố và đính kèm.'
    AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.document_id=d.id AND a.name<>'qa.txt')`,
  software: `SELECT id FROM software s WHERE name ~ '^Software QA [A-Z0-9]{8}$' AND vendor='QA'
    AND version='1.0' AND seats=1
    AND NOT EXISTS (SELECT 1 FROM software_installations i WHERE i.software_id=s.id)`,
  assets: `SELECT id FROM assets a WHERE id ~ '^AS-[A-Z0-9]{8}$'
    AND name='Laptop QA ' || substring(id from 4) AND location='Phòng QA'
    AND NOT EXISTS (SELECT 1 FROM asset_assignments aa WHERE aa.asset_id=a.id AND aa.ended_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM software_installations i WHERE i.asset_id=a.id)
    AND NOT EXISTS (SELECT 1 FROM tickets t WHERE a.id IN (t.asset_id,t.requested_asset_id))`,
  departments: `SELECT id FROM departments WHERE id ~ '^QA-[A-Z0-9]{8}$'
    AND name='Bộ phận QA ' || substring(id from 4) AND head=''`,
};
qa.users = `SELECT u.id FROM users u JOIN (${qa.departments}) d ON u.department_id=d.id
  WHERE u.code='NV-' || substring(d.id from 4) AND u.name='Nhân viên QA ' || substring(d.id from 4)
  AND u.email='qa-' || lower(substring(d.id from 4)) || '@nexdesk.local'
  AND u.position='Nhân viên kiểm thử' AND u.role='end-user'
  AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id=u.id)
  AND NOT EXISTS (SELECT 1 FROM audit_log l WHERE l.actor_id=u.id)
  AND NOT EXISTS (SELECT 1 FROM tickets t WHERE u.id IN (t.requester_id,t.assignee_id,t.assigned_by,t.classified_by))`;

async function removeTestData(client, admin) {
  const removed = {};
  const remove = async (entity, after = [], excluded = "") => {
    const ids = (await client.query(qa[entity] + excluded)).rows.map(({ id }) => id);
    for (const [table, reference] of after)
      await client.query(`DELETE FROM ${table} WHERE ${reference}=ANY($1)`, [ids]);
    if (ids.length) await client.query(`DELETE FROM ${entity} WHERE id=ANY($1)`, [ids]);
    removed[entity] = ids;
  };

  await remove(
    "tickets",
    ["notifications", "attachments", "ticket_comments", "ticket_messages", "ticket_events"].map(
      (table) => [table, "ticket_id"],
    ),
  );
  await remove("documents", [["attachments", "document_id"]]);
  await remove("software");
  await remove("assets", [["asset_assignments", "asset_id"]]);
  await remove("users");
  await remove(
    "departments",
    [],
    `
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.department_id=departments.id)
    AND NOT EXISTS (SELECT 1 FROM asset_assignments aa WHERE aa.department_id=departments.id)`,
  );
  if (Object.values(removed).some((ids) => ids.length)) {
    await client.query(
      "INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details) VALUES($1,$2,'remove-browser-fixtures','system','workspace-v1',$3)",
      [randomUUID(), admin, JSON.stringify(removed)],
    );
    if (removed.tickets.length) {
      await client.query(
        `INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details)
         SELECT gen_random_uuid(),$1,'delete','tickets',id,'{"source":"browser-fixture-cleanup"}'
         FROM unnest($2::text[]) ids(id)`,
        [admin, removed.tickets],
      );
    }
  }
  return Object.fromEntries(Object.entries(removed).map(([entity, ids]) => [entity, ids.length]));
}

let database, pool;
try {
  if (!process.env.DATABASE_URL) database = await startLocalDatabase();
  pool = createPool(process.env.DATABASE_URL || database.url);
  const apply = process.argv.includes("--apply");
  if (!apply) {
    const counts = await transaction(pool, async (client) => {
      await client.query("SET TRANSACTION READ ONLY");
      await getSampleAccounts(client);
      const summary = {};
      for (const [entity, sql] of Object.entries(qa))
        summary[entity] = Number(
          (await client.query(`SELECT count(*) FROM (${sql}) candidates`)).rows[0].count,
        );
      return summary;
    });
    console.log("Bản ghi có dấu hiệu kiểm thử:", counts);
  } else {
    await transaction(pool, async (client) => {
      await client.query("SET LOCAL lock_timeout='8s'");
      await client.query("SELECT pg_advisory_xact_lock(712047)");
      const accounts = await getSampleAccounts(client);
      const admin = accounts.find((account) => account.code === "NV-001").id;
      await client.query(`LOCK TABLE departments,users,assets,asset_assignments,software,
        software_installations,documents,tickets,ticket_comments,ticket_messages,ticket_events,
        attachments,audit_log,notifications IN SHARE ROW EXCLUSIVE MODE`);
      const passphrase = process.env.BACKUP_PASSPHRASE || randomBytes(32).toString("base64url");
      const directory = resolve(".runtime/backups");
      const basename = "before-workspace-refresh-" + Date.now();
      await mkdir(directory, { recursive: true });
      const backup = await createBackup(pool, passphrase);
      if (!process.env.BACKUP_PASSPHRASE)
        await writeFile(resolve(directory, basename + ".key"), passphrase, {
          mode: 0o600,
          flag: "wx",
        });
      await writeFile(resolve(directory, basename + ".json"), JSON.stringify(backup), {
        mode: 0o600,
        flag: "wx",
      });
      const removed = await removeTestData(client, admin);
      const added = await addSampleWorkspace(client, accounts);
      return { removed, added, backup: basename + ".json" };
    }).then(console.log);
  }
} catch (error) {
  // PostgreSQL transport errors can contain connection details.
  console.error(error.code ? "Cập nhật dữ liệu thất bại (" + error.code + ")." : error.message);
  process.exitCode = 1;
} finally {
  await pool?.end();
  await database?.stop();
}
