import "./config.mjs";
import { createPool, migrate } from "./db.mjs";
import { createApp } from "./app.mjs";
const pool = createPool();
await migrate(pool);
const port = Number(process.env.API_PORT || 3001);
const server = createApp(pool).listen(port, "127.0.0.1", () =>
  console.log(`NexDesk API: http://127.0.0.1:${port}/api/health`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
