import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import {
  tokenHash,
  newToken,
  checkPassword,
  hashPassword,
  publicUser,
  assert,
  HttpError,
  audit,
} from "./security.mjs";
import { transaction } from "./db.mjs";
import { ticketRouter } from "./tickets.mjs";
import { resourceRouter } from "./resources.mjs";
import { workspace } from "./workspace.mjs";

const cookieName = "nexdesk_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/api",
  maxAge: 8 * 60 * 60 * 1000,
};
const dummyHash = hashPassword(newToken());
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
  app.post(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Đăng nhập quá nhiều lần. Thử lại sau 15 phút." },
    }),
    async (req, res) => {
      const input = z
        .object({ email: z.string().email().max(254), password: z.string().min(1).max(128) })
        .strict()
        .parse(req.body);
      const user = (
        await pool.query("SELECT * FROM users WHERE email=$1", [input.email.toLowerCase()])
      ).rows[0];
      const matches = await checkPassword(input.password, user?.password_hash || (await dummyHash));
      assert(
        matches && user?.active,
        401,
        "Email hoặc mật khẩu không đúng, hoặc tài khoản bị khóa.",
      );
      const token = newToken(),
        csrfToken = newToken();
      await transaction(pool, async (client) => {
        const lockedUser = (
          await client.query("SELECT password_hash,active FROM users WHERE id=$1 FOR SHARE", [
            user.id,
          ])
        ).rows[0];
        assert(
          lockedUser?.active && lockedUser.password_hash === user.password_hash,
          401,
          "Thông tin tài khoản vừa thay đổi. Vui lòng đăng nhập lại.",
        );
        await client.query("DELETE FROM sessions WHERE expires_at < now()");
        const previous = req.headers.cookie?.match(
          /(?:^|;\s*)nexdesk_session=([a-f0-9]{64})(?:;|$)/,
        )?.[1];
        if (previous)
          await client.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(previous)]);
        await client.query(
          "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
          [tokenHash(token), user.id, csrfToken],
        );
        await audit(client, user.id, "login", "users", user.id);
      });
      res.cookie(cookieName, token, cookieOptions).json({ user: publicUser(user), csrfToken });
    },
  );
  app.use("/api", async (req, _res, next) => {
    const token = req.headers.cookie?.match(/(?:^|;\s*)nexdesk_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    assert(token, 401, "Vui lòng đăng nhập.");
    const session = (
      await pool.query(
        `SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
        [tokenHash(token)],
      )
    ).rows[0];
    assert(session, 401, "Phiên đăng nhập hết hạn.");
    req.user = session;
    req.sessionHash = tokenHash(token);
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
      assert(
        req.headers["x-csrf-token"] === session.csrf_token,
        403,
        "Phiên xác thực không hợp lệ. Hãy tải lại trang.",
      );
    next();
  });
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user), csrfToken: req.user.csrf_token }),
  );
  app.post("/api/auth/logout", async (req, res) => {
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [req.sessionHash]);
    await audit(pool, req.user.id, "logout", "users", req.user.id);
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }).json({ ok: true });
  });
  app.post("/api/auth/password", async (req, res) => {
    const input = z
      .object({ currentPassword: z.string().max(128), password: z.string().min(12).max(128) })
      .strict()
      .parse(req.body);
    assert(
      await checkPassword(input.currentPassword, req.user.password_hash),
      400,
      "Mật khẩu hiện tại không đúng.",
    );
    await transaction(pool, async (client) => {
      await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
        req.user.id,
        await hashPassword(input.password),
      ]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [req.user.id]);
      await audit(client, req.user.id, "password_change", "users", req.user.id);
    });
    res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }).json({ ok: true });
  });
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
    if (error instanceof ZodError)
      return res.status(400).json({
        error: "Dữ liệu không hợp lệ.",
        fields: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
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
    const status = error.status || 400;
    if (status >= 500 || (!error.status && !error.code && !(error instanceof SyntaxError))) {
      console.error("API failure:", error.name, error.code || "unexpected");
      return res.status(500).json({ error: "Không thể xử lý yêu cầu. Vui lòng thử lại." });
    }
    res.status(status).json({ error: error.status ? error.message : "Yêu cầu không hợp lệ." });
  });
  return app;
}
