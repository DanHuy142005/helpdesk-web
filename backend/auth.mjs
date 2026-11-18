import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { transaction } from "./db.mjs";
import { mountOtpRoutes } from "./otp.mjs";
import {
  assert,
  audit,
  checkPassword,
  hashPassword,
  newToken,
  publicUser,
  tokenHash,
} from "./security.mjs";

const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/api",
  maxAge: 8 * 60 * 60 * 1000,
};
const dummyHash = hashPassword(newToken());
const password = z.string().min(7).max(128);
const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

function sessionCookie(req) {
  const tab =
    req.headers["x-nexdesk-tab"] ??
    (["GET", "HEAD"].includes(req.method) ? req.query.tab : undefined);
  if (tab === undefined) return "nexdesk_session";
  assert(
    typeof tab === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(tab),
    400,
    "Phiên làm việc không hợp lệ. Vui lòng tải lại trang.",
  );
  return "nexdesk_session_" + tab.toLowerCase().replaceAll("-", "");
}
function readCookie(req, name) {
  return req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1);
}
function limiter(limit, error, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error },
  });
}

export function mountAuthentication(app, pool) {
  app.post(
    "/api/auth/login",
    limiter(30, "Đăng nhập quá nhiều lần. Thử lại sau 15 phút.", true),
    async (req, res) => {
      const input = z
        .object({ email, password: z.string().min(1).max(128) })
        .strict()
        .parse(req.body);
      const cookie = sessionCookie(req);
      const user = (await pool.query("SELECT * FROM users WHERE email=$1", [input.email])).rows[0];
      const matches = await checkPassword(input.password, user?.password_hash || (await dummyHash));
      assert(
        matches && user?.active,
        401,
        "Email hoặc mật khẩu không đúng, hoặc tài khoản bị khóa.",
      );
      const token = newToken(),
        csrfToken = newToken();
      await transaction(pool, async (client) => {
        const current = (
          await client.query("SELECT password_hash,active FROM users WHERE id=$1 FOR SHARE", [
            user.id,
          ])
        ).rows[0];
        assert(
          current?.active && current.password_hash === user.password_hash,
          401,
          "Thông tin tài khoản vừa thay đổi. Vui lòng đăng nhập lại.",
        );
        await client.query("DELETE FROM sessions WHERE expires_at < now()");
        const previous = readCookie(req, cookie);
        if (previous && /^[a-f0-9]{64}$/.test(previous))
          await client.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(previous)]);
        await client.query(
          "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
          [tokenHash(token), user.id, csrfToken],
        );
        await audit(client, user.id, "login", "users", user.id);
      });
      res.cookie(cookie, token, cookieOptions).json({ user: publicUser(user), csrfToken });
    },
  );

  mountOtpRoutes(app, pool);
  app.post(
    "/api/auth/password/reset",
    limiter(20, "Đặt lại mật khẩu quá nhiều lần. Thử lại sau 15 phút."),
    async (req, res) => {
      const input = z
        .object({ challenge: tokenSchema, password, confirmPassword: password })
        .strict()
        .parse(req.body);
      assert(input.password === input.confirmPassword, 400, "Mật khẩu nhập lại chưa khớp.");
      await transaction(pool, async (client) => {
        const initial = (
          await client.query("SELECT user_id FROM password_reset_challenges WHERE token_hash=$1", [
            tokenHash(input.challenge),
          ])
        ).rows[0];
        assert(initial, 400, "Phiên xác minh đã hết hạn. Vui lòng xác minh lại bằng OTP.");
        const user = (
          await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [initial.user_id])
        ).rows[0];
        const challenge = (
          await client.query(
            "SELECT * FROM password_reset_challenges WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
            [tokenHash(input.challenge)],
          )
        ).rows[0];
        assert(
          user?.active &&
            challenge &&
            challenge.phone === user.phone &&
            challenge.password_fingerprint === tokenHash(user.password_hash),
          400,
          "Phiên xác minh đã hết hạn. Vui lòng xác minh lại bằng OTP.",
        );
        assert(
          !(await checkPassword(input.password, user.password_hash)),
          400,
          "Mật khẩu mới cần khác mật khẩu cũ.",
        );
        await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
          user.id,
          await hashPassword(input.password),
        ]);
        await client.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
        await client.query("DELETE FROM password_reset_challenges WHERE user_id=$1", [user.id]);
        await client.query("DELETE FROM password_reset_otps WHERE user_id=$1", [user.id]);
        await audit(client, user.id, "password_reset", "users", user.id);
      });
      res.json({ ok: true });
    },
  );

  app.use("/api", async (req, _res, next) => {
    const cookie = sessionCookie(req),
      token = readCookie(req, cookie);
    assert(token && /^[a-f0-9]{64}$/.test(token), 401, "Vui lòng đăng nhập.");
    const session = (
      await pool.query(
        `SELECT u.*,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
        [tokenHash(token)],
      )
    ).rows[0];
    assert(session, 401, "Phiên đăng nhập hết hạn.");
    req.user = session;
    req.sessionHash = tokenHash(token);
    req.sessionCookie = cookie;
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
    res.clearCookie(req.sessionCookie, { ...cookieOptions, maxAge: undefined }).json({ ok: true });
  });
  app.post("/api/auth/password", async (req, res) => {
    const input = z
      .object({ currentPassword: z.string().min(1).max(128), password, confirmPassword: password })
      .strict()
      .parse(req.body);
    assert(input.password === input.confirmPassword, 400, "Mật khẩu nhập lại chưa khớp.");
    await transaction(pool, async (client) => {
      const current = (
        await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [req.user.id])
      ).rows[0];
      assert(
        current?.active && current.password_hash === req.user.password_hash,
        401,
        "Thông tin tài khoản vừa thay đổi. Vui lòng đăng nhập lại.",
      );
      assert(
        await checkPassword(input.currentPassword, current.password_hash),
        400,
        "Mật khẩu hiện tại không đúng.",
      );
      assert(input.password !== input.currentPassword, 400, "Mật khẩu mới cần khác mật khẩu cũ.");
      await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
        req.user.id,
        await hashPassword(input.password),
      ]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [req.user.id]);
      await client.query("DELETE FROM password_reset_challenges WHERE user_id=$1", [req.user.id]);
      await client.query("DELETE FROM password_reset_otps WHERE user_id=$1", [req.user.id]);
      await audit(client, req.user.id, "password_change", "users", req.user.id);
    });
    res.clearCookie(req.sessionCookie, { ...cookieOptions, maxAge: undefined }).json({ ok: true });
  });
}
