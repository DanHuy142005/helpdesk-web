import "../backend/config.mjs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { startLocalDatabase } from "./database.mjs";
import { createPool, migrate } from "../backend/db.mjs";
import { seed } from "../backend/seed.mjs";
import { createApp } from "../backend/app.mjs";
import { startTicketMaintenance } from "../backend/maintenance.mjs";
import { createServer } from "node:net";
import { startCloudflare } from "./cloudflare.mjs";

const args = process.argv.slice(2);
const useCloudflare = args.includes("--cloudflare");
async function freePort(start) {
  for (let port = start; port <= Math.min(65535, start + 100); port++) {
    const available = await new Promise((done) => {
      const probe = createServer();
      probe.once("error", () => done(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => done(true)));
    });
    if (available) return port;
  }
  throw new Error("Không tìm được cổng trống.");
}
const port = await freePort(
  args.includes("--port") ? Number(args[args.indexOf("--port") + 1]) : 5173,
);
const apiPort = process.env.API_PORT ? Number(process.env.API_PORT) : await freePort(3001);
let db,
  pool,
  server,
  web,
  tunnel,
  stopMaintenance,
  stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  tunnel?.kill();
  web?.kill("SIGTERM");
  if (server) await new Promise((done) => server.close(done));
  await stopMaintenance?.();
  await pool?.end();
  await db?.stop();
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
try {
  if (!process.env.DATABASE_URL) db = await startLocalDatabase();
  pool = createPool(process.env.DATABASE_URL || db.url);
  await migrate(pool);
  if (db) {
    const created = await seed(pool, {
      accountsFile: resolve(".runtime/demo-accounts.json"),
      includeWorkspace: true,
    });
    if (created) console.log("Tai khoan demo: .runtime/demo-accounts.json");
  }
  const localOrigins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  let publicOrigin;
  if (useCloudflare) {
    console.log("Dang xin link Cloudflare Tunnel...");
    const cloudflare = startCloudflare(port);
    tunnel = cloudflare.process;
    publicOrigin = await cloudflare.ready;
    tunnel.once("exit", () => {
      if (stopping) return;
      console.error("Cloudflare Tunnel da ngat. Chay lai run-cloudflare.bat de mo link moi.");
      void stop(1);
    });
  }
  server = createApp(pool, {
    origins: publicOrigin
      ? [...localOrigins, publicOrigin]
      : process.env.APP_ORIGIN?.split(",") || localOrigins,
  }).listen(apiPort, "127.0.0.1");
  await new Promise((done, reject) => {
    server.once("listening", done);
    server.once("error", reject);
  });
  console.log(`NexDesk API ready: http://127.0.0.1:${apiPort}`);
  stopMaintenance = startTicketMaintenance(pool);
  web = spawn(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
      ...(args.includes("--open") ? ["--open"] : []),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        API_PORT: String(apiPort),
        ...(publicOrigin
          ? { __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: new URL(publicOrigin).hostname }
          : {}),
      },
    },
  );
  web.on("exit", (code) => stop(code || 0));
  web.on("error", () => stop(1));
  if (publicOrigin) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const response = await fetch(`${localOrigins[0]}/api/health`, {
        signal: AbortSignal.timeout(1500),
      }).catch(() => null);
      if (response?.ok) {
        console.log(
          `\nCloudflare URL: ${publicOrigin}\nGiu cua so nay mo khi su dung. Nhan Ctrl+C de dung.\n`,
        );
        break;
      }
      if (attempt === 49) throw new Error("Web chưa sẵn sàng qua cổng đã chọn.");
      await new Promise((done) => setTimeout(done, 500));
    }
  }
} catch (error) {
  console.error("Khong the khoi dong:", error.message);
  await stop(1);
}
