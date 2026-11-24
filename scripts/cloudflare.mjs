import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export function startCloudflare(port) {
  const process = spawn("cloudflared", ["tunnel", "--url", `http://127.0.0.1:${port}`], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise((resolve, reject) => {
    const lines = [process.stdout, process.stderr].map((input) => createInterface({ input }));
    const logs = [];
    const timer = setTimeout(() => {
      process.kill();
      reject(new Error("Cloudflare chưa cấp link sau 45 giây. Kiểm tra Internet rồi chạy lại."));
    }, 45000);
    for (const reader of lines) {
      reader.on("line", (line) => {
        logs.push(line);
        if (logs.length > 8) logs.shift();
        const origin = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/iu)?.[0];
        if (origin) {
          clearTimeout(timer);
          resolve(new URL(origin).origin);
        }
      });
    }
    process.once("error", (error) => {
      clearTimeout(timer);
      reject(
        error.code === "ENOENT"
          ? new Error("Không tìm thấy cloudflared. Cài Cloudflare Tunnel rồi chạy lại.")
          : error,
      );
    });
    process.once("close", (code) => {
      clearTimeout(timer);
      reject(new Error(`Cloudflare Tunnel đã dừng (${code ?? "signal"}).\n${logs.join("\n")}`));
    });
  });
  return { process, ready };
}
