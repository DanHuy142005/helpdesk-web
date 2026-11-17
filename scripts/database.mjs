import "../backend/config.mjs";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";

export async function startLocalDatabase({
  directory = resolve(".runtime/postgres"),
  port = 55432,
} = {}) {
  await mkdir(directory, { recursive: true });
  const configPath = resolve(directory, "credentials.json");
  const config = existsSync(configPath)
    ? JSON.parse(await readFile(configPath, "utf8"))
    : {
        port,
        user: "postgres",
        password: randomBytes(24).toString("hex"),
        appPassword: randomBytes(24).toString("hex"),
      };
  if (!existsSync(configPath)) await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  const url = `postgresql://nexdesk_app:${config.appPassword}@127.0.0.1:${config.port}/nexdesk`;
  const probe = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1000 });
  try {
    await probe.connect();
    await probe.end();
    return { url, stop: async () => {}, owned: false };
  } catch {
    await probe.end().catch(() => {});
  }
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const instance = new EmbeddedPostgres({
    databaseDir: resolve(directory, "data"),
    port: config.port,
    user: config.user,
    password: config.password,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", "127.0.0.1"],
    autoRehydrateSymlinks: true,
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(resolve(directory, "data/PG_VERSION"))) await instance.initialise();
  await instance.start();
  const admin = new pg.Client({
    host: "127.0.0.1",
    port: config.port,
    user: config.user,
    password: config.password,
    database: "postgres",
  });
  try {
    await admin.connect();
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='nexdesk_app'")).rows.length) {
      const sql = (
        await admin.query("SELECT format('CREATE ROLE nexdesk_app LOGIN PASSWORD %L', $1::text)", [
          config.appPassword,
        ])
      ).rows[0].format;
      await admin.query(sql);
    }
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='nexdesk'")).rows.length)
      await admin.query("CREATE DATABASE nexdesk OWNER nexdesk_app");
  } catch (error) {
    await instance.stop();
    throw error;
  } finally {
    await admin.end();
  }
  return { url, stop: () => instance.stop(), owned: true };
}
