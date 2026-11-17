import "../backend/config.mjs";
import { resolve } from "node:path";
import { createPool, migrate } from "../backend/db.mjs";
import { seed } from "../backend/seed.mjs";
import { startLocalDatabase } from "./database.mjs";

const command = process.argv[2] || "local";
let database;
if (!process.env.DATABASE_URL) database = await startLocalDatabase();
const pool = createPool(process.env.DATABASE_URL || database.url);
if (command === "local" || command === "migrate") {
  await migrate(pool);
  console.log("Database schema ready.");
}
if (command === "local" || command === "seed") {
  await migrate(pool);
  const result = await seed(pool, { accountsFile: resolve(".runtime/demo-accounts.json") });
  console.log(
    result
      ? "Demo accounts created. Credentials: .runtime/demo-accounts.json"
      : "Existing data preserved; seed skipped.",
  );
}
if (command === "local") {
  console.log("PostgreSQL ready on 127.0.0.1:55432. Keep this terminal open.");
  const keepAlive = setInterval(() => {}, 60000);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      clearInterval(keepAlive);
      await pool.end();
      await database?.stop();
      process.exit(0);
    });
} else {
  await pool.end();
  await database?.stop();
}
