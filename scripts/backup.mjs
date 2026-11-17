import "../backend/config.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { startLocalDatabase } from "./database.mjs";
import { createPool, migrate } from "../backend/db.mjs";
import { createBackup, restoreBackup } from "../backend/backup.mjs";
const mode = process.argv[2] || "create",
  file = resolve(process.argv[3] || `.runtime/backups/nexdesk-${Date.now()}.json`);
let database, pool;
try {
  if (!process.env.BACKUP_PASSPHRASE || process.env.BACKUP_PASSPHRASE.length < 16)
    throw new Error("Đặt BACKUP_PASSPHRASE ít nhất 16 ký tự trong môi trường hoặc .env.");
  if (!process.env.DATABASE_URL) database = await startLocalDatabase();
  pool = createPool(process.env.DATABASE_URL || database.url);
  await migrate(pool);
  if (mode === "create") {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(await createBackup(pool, process.env.BACKUP_PASSPHRASE)), {
      mode: 0o600,
    });
    console.log("Encrypted backup saved:", file);
  } else if (mode === "restore") {
    console.log(
      "Restored rows:",
      await restoreBackup(
        pool,
        JSON.parse(await readFile(file, "utf8")),
        process.env.BACKUP_PASSPHRASE,
      ),
    );
  } else throw new Error("Dùng create hoặc restore.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool?.end();
  await database?.stop();
}
