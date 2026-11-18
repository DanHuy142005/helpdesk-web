import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
// PostgreSQL DATE is a calendar date, not a timestamp; keep YYYY-MM-DD across time zones.
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString)
    throw new Error("Chưa cấu hình DATABASE_URL. Chạy npm run db:local hoặc cấu hình .env.");
  return new pg.Pool({ connectionString, max: 12, connectionTimeoutMillis: 5000 });
}

export async function transaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate(pool) {
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(712046)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_versions (version integer PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    const { rows } = await client.query("SELECT version FROM schema_versions");
    const applied = new Set(rows.map((row) => row.version));
    const files = (await readdir(new URL("./db/", import.meta.url)))
      .filter((file) => /^\d+-.*\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const version = Number(file.split("-")[0]);
      if (applied.has(version)) continue;
      await client.query(await readFile(new URL(`./db/${file}`, import.meta.url), "utf8"));
      await client.query("INSERT INTO schema_versions(version) VALUES($1)", [version]);
    }
  });
}
