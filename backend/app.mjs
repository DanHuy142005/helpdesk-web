import express from "express";
import helmet from "helmet";
import { z, ZodError } from "zod";
import { assert, HttpError } from "./security.mjs";
import { mountAuthentication } from "./auth.mjs";
import { ticketRouter } from "./tickets.mjs";
import { resourceRouter } from "./resources.mjs";
import { workspace } from "./workspace.mjs";
import { ticketPolicyRouter } from "./ticket-policy.mjs";

export function createApp(
  pool,
  {
    origins = (process.env.APP_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173").split(","),
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", express.json({ limit: "160kb" }));
  app.use("/api", (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      assert(!origin || origins.includes(origin), 403, "Nguồn truy cập không hợp lệ.");
      if (!req.is("application/json") && !req.is("multipart/form-data"))
        throw new HttpError(415, "Yêu cầu cần dùng JSON hoặc multipart/form-data.");
    }
    next();
  });
  app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "nexdesk-api" });
  });
  mountAuthentication(app, pool);
  app.use("/api/settings/tickets", ticketPolicyRouter(pool));
  app.get("/api/workspace", async (req, res) => res.json(await workspace(pool, req.user)));
  app.get("/api/reports", async (req, res) => {
    assert(req.user.role === "admin", 403, "Chỉ Admin được xuất báo cáo.");
    const range = z
      .object({ from: z.string().date().optional(), to: z.string().date().optional() })
      .parse(req.query);
    assert(!range.from || !range.to || range.from <= range.to, 400, "Khoảng ngày không hợp lệ.");
    const data = await workspace(pool, req.user, range);
    if (req.headers.accept?.includes("text/csv")) {
      const csv = (v) => {
        let value = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(value)) value = "'" + value;
        return '"' + value.replaceAll('"', '""') + '"';
      };
      const rows = [
        [
          "Mã",
          "Tiêu đề",
          "Người yêu cầu",
          "Phòng ban",
          "Trạng thái",
          "Ưu tiên",
          "Người xử lý",
          "Ngày tạo",
          "Ngày giải quyết",
          "Đánh giá",
        ],
        ...data.tickets.map((t) => [
          t.id,
          t.title,
          t.requester,
          t.department,
          t.status,
          t.priority,
          t.assignee,
          t.created_at?.toISOString(),
          t.resolved_at?.toISOString(),
          t.rating,
        ]),
        [],
        ["TÀI SẢN"],
        ["Mã", "Tên", "Loại", "Người giữ", "Phòng ban", "Tình trạng"],
        ...data.assets.map((a) => [a.id, a.name, a.type, a.owner, a.department, a.status]),
      ];
      res
        .set({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="nexdesk-report.csv"',
        })
        .send("\uFEFF" + rows.map((r) => r.map(csv).join(",")).join("\r\n"));
    } else res.json(data);
  });
  app.post("/api/notifications/read", async (req, res) => {
    await pool.query(
      "UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
      [req.user.id],
    );
    res.json({ ok: true });
  });
  app.use("/api/tickets", ticketRouter(pool));
  app.use("/api", resourceRouter(pool));
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "API không tồn tại.")));
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError) {
      const fields = error.issues.map((issue) => ({
        field: issue.path.join("."),
        message:
          issue.path[0] === "phone"
            ? "Số điện thoại không hợp lệ. Ví dụ: 0901234567 hoặc +84901234567."
            : issue.message,
      }));
      return res
        .status(400)
        .json({
          error:
            fields.find((field) => field.field === "phone")?.message || "Dữ liệu không hợp lệ.",
          fields,
        });
    }
    if (error.code === "23505" && error.constraint === "users_phone_key") {
      const message = "Số điện thoại này đã liên kết với tài khoản khác.";
      return res.status(409).json({ error: message, fields: [{ field: "phone", message }] });
    }
    if (error.code === "23505")
      return res.status(409).json({ error: "Mã, email hoặc bản ghi đã tồn tại." });
    if (error.code === "23503")
      return res
        .status(409)
        .json({ error: "Bản ghi đang được liên kết hoặc dữ liệu tham chiếu không hợp lệ." });
    if (error.code === "23514" || error.code === "22P02")
      return res.status(400).json({ error: "Giá trị dữ liệu không hợp lệ." });
    if (error.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({ error: "Tệp vượt quá 5 MB." });
    if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE")
      return res.status(400).json({ error: "Chỉ được đính kèm tối đa 10 tệp trong mỗi lần gửi." });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    const status = error.status || 400;
    if (status >= 500 || (!error.status && !error.code && !(error instanceof SyntaxError))) {
      console.error("API failure:", error.name, error.code || "unexpected");
      return res.status(500).json({ error: "Không thể xử lý yêu cầu. Vui lòng thử lại." });
    }
    res.status(status).json({ error: error.status ? error.message : "Yêu cầu không hợp lệ." });
  });
  return app;
}
