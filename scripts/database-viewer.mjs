import "../backend/config.mjs";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { promisify } from "node:util";
import pg from "pg";
import { startLocalDatabase } from "./database.mjs";

const host = "127.0.0.1";
const pageSize = 50;
const exec = promisify(execFile);
let localDatabase, pool, databaseName;
const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => entities[char]);
const identifier = pg.escapeIdentifier;
const tableUrl = (table, page = 1) => `/?table=${encodeURIComponent(table)}&amp;page=${page}`;

const server = createServer(async (request, response) => {
  if (request.method !== "GET" || request.headers.host !== `${host}:${server.address().port}`) {
    response.writeHead(403).end();
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname !== "/") {
      response.writeHead(404).end();
      return;
    }
    const { rows: tables } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const selected = url.searchParams.get("table") ?? "tickets";
    const table = tables.find((entry) => entry.table_name === selected) ?? tables[0];
    const links = tables
      .map(
        ({ table_name }) =>
          `<a href="${tableUrl(table_name)}" ${table_name === table?.table_name ? 'aria-current="page"' : ""}>${escape(table_name)}</a>`,
      )
      .join("");
    let content = "<p>Schema public chưa có bảng nào.</p>";
    if (table) {
      const name = table.table_name;
      const { rows: columns } = await pool.query(
        `
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `,
        [name],
      );
      const projection = columns
        .map(({ column_name, data_type }) => {
          const column = identifier(column_name);
          if (/password|token|secret|otp_hash/.test(column_name)) return `'[đã ẩn]' AS ${column}`;
          if (data_type === "bytea") return `octet_length(${column})::text || ' byte' AS ${column}`;
          return `${column}::text AS ${column}`;
        })
        .join(", ");
      const relation = `public.${identifier(name)}`;
      const {
        rows: [{ total }],
      } = await pool.query(`SELECT count(*)::text AS total FROM ${relation}`);
      const pages = Math.max(1, Math.ceil(Number(total) / pageSize));
      const requestedPage = Number(url.searchParams.get("page"));
      const page = Number.isSafeInteger(requestedPage)
        ? Math.min(pages, Math.max(1, requestedPage))
        : 1;
      const { rows } = await pool.query(
        `SELECT ${projection} FROM ${relation} ORDER BY ctid LIMIT $1 OFFSET $2`,
        [pageSize, (page - 1) * pageSize],
      );
      const headings = columns
        .map(
          ({ column_name, data_type }) =>
            `<th scope="col">${escape(column_name)}<small>${escape(data_type)}</small></th>`,
        )
        .join("");
      const records = rows
        .map(
          (row) =>
            `<tr>${columns.map(({ column_name }) => `<td>${row[column_name] === null ? '<span class="null">NULL</span>' : escape(row[column_name])}</td>`).join("")}</tr>`,
        )
        .join("");
      content = `<h1>${escape(name)}</h1><p>${Number(total).toLocaleString("vi-VN")} dòng</p>
        <div class="data" tabindex="0" aria-label="Dữ liệu bảng"><table><thead><tr>${headings}</tr></thead><tbody>${records || `<tr><td colspan="${columns.length}">Bảng chưa có dữ liệu.</td></tr>`}</tbody></table></div>
        <nav class="pages" aria-label="Phân trang"><span>Trang ${page} / ${pages}</span>${page > 1 ? `<a href="${tableUrl(name, page - 1)}">Trang trước</a>` : ""}${page < pages ? `<a href="${tableUrl(name, page + 1)}">Trang sau</a>` : ""}</nav>`;
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    }).end(`<!doctype html>
      <html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>PostgreSQL · NexDesk</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font: 15px/1.5 system-ui, sans-serif; color: #172234; background: #f4f6fa; }
        header { background: #153253; color: white; padding: 14px 22px; }
        .layout { display: grid; grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr); min-height: calc(100vh - 53px); }
        aside { background: white; border-right: 1px solid #dce4ee; padding: 18px 12px; }
        aside h2 { margin: 0 10px 9px; font-size: 14px; color: #4b5b71; }
        aside a { display: block; padding: 6px 10px; border-radius: 5px; overflow-wrap: anywhere; }
        a { color: #11477e; text-decoration: none; }
        a:hover { text-decoration: underline; }
        a[aria-current] { background: #e1ebfa; font-weight: 650; }
        main { padding: 24px; min-width: 0; }
        h1 { margin: 0; }
        p { margin: 4px 0 16px; color: #4b5b71; }
        .data { max-height: 72vh; overflow: auto; border: 1px solid #dce4ee; border-radius: 6px; background: white; }
        table { border-spacing: 0; min-width: 100%; font-size: 13px; }
        td, th { padding: 8px 12px; border-bottom: 1px solid #e8edf5; text-align: left; vertical-align: top; }
        th { position: sticky; top: 0; background: #edf2f8; white-space: nowrap; }
        td { min-width: 8rem; max-width: 36rem; white-space: pre-wrap; overflow-wrap: anywhere; }
        small, .null { display: block; color: #4b5b71; font-weight: 400; }
        tbody tr:nth-child(even) { background: #f8fafd; }
        .pages { display: flex; gap: 16px; margin-top: 14px; }
        @media (max-width: 650px) { .layout { grid-template-columns: 1fr; } aside { border-right: 0; } aside nav { max-height: 9rem; overflow: auto; } main { padding: 16px; } }
      </style>
      <header><strong>NexDesk</strong> · PostgreSQL · Chỉ đọc</header>
      <div class="layout"><aside><h2>${escape(databaseName)} / public</h2><nav aria-label="Các bảng">${links}</nav></aside><main>${content}</main></div></html>`);
  } catch (error) {
    console.error(error.code ?? error.name);
    response
      .writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Không thể đọc dữ liệu PostgreSQL.");
  }
});

try {
  if (!process.env.DATABASE_URL) {
    if (
      !existsSync(".runtime/postgres/credentials.json") ||
      !existsSync(".runtime/postgres/data/PG_VERSION")
    ) {
      throw new Error("Chua co database local. Chay run.bat de khoi tao, sau do mo lai file nay.");
    }
    localDatabase = await startLocalDatabase();
  }
  const connection = new URL(process.env.DATABASE_URL || localDatabase.url);
  const existingOptions = connection.searchParams.get("options");
  connection.searchParams.set(
    "options",
    [existingOptions, "-c default_transaction_read_only=on -c statement_timeout=5000"]
      .filter(Boolean)
      .join(" "),
  );
  pool = new pg.Pool({ connectionString: connection.href, connectionTimeoutMillis: 5000 });
  const { rows } = await pool.query("SELECT current_database() AS name");
  databaseName = rows[0].name;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
} catch (error) {
  console.error(
    "Khong the mo co so du lieu:",
    error?.code ?? error?.message ?? "Kiem tra PostgreSQL.",
  );
  await pool?.end();
  await localDatabase?.stop();
  process.exit(1);
}

async function stop() {
  server.close();
  await pool.end();
  await localDatabase?.stop();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

const viewerUrl = `http://${host}:${server.address().port}/`;
console.log(`Co so du lieu: ${viewerUrl}`);
console.log("Giu cua so nay mo trong luc xem database. Nhan Ctrl+C de dung.");
if (!process.argv.includes("--no-browser")) {
  try {
    await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Start-Process '${viewerUrl}' -ErrorAction Stop`,
      ],
      { windowsHide: true },
    );
  } catch {
    console.error("Khong tu mo duoc trinh duyet. Hay mo dia chi o tren.");
  }
}
