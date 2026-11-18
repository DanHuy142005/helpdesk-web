import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { transaction } from "./db.mjs";
import { assert, newToken, tokenHash } from "./security.mjs";
import { phoneSchema, maskPhone } from "./phone.mjs";

// Fixed verification code requested for the current deployment. SMS delivery
// is reported only when a configured gateway actually accepts the message.
const fixedCode = "123456";
async function sendCode(phone, code) {
  if (!process.env.SMS_WEBHOOK_URL) return false;
  const response = await fetch(process.env.SMS_WEBHOOK_URL, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      ...(process.env.SMS_API_KEY ? { Authorization: "Bearer " + process.env.SMS_API_KEY } : {}),
    },
    body: JSON.stringify({
      phone,
      message: `Ma xac minh NexDesk cua ban la ${code}. Ma co hieu luc trong 5 phut.`,
    }),
  });
  assert(response.ok, 503, "Chưa gửi được mã xác minh. Vui lòng thử lại sau.");
  return true;
}
export function mountOtpRoutes(app, pool) {
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút." },
  });
  app.post("/api/auth/password/otp/request", limit, async (req, res) => {
    const { phone } = z.object({ phone: phoneSchema }).strict().parse(req.body);
    const requestId = newToken();
    const user = (
      await pool.query("SELECT id,phone,password_hash FROM users WHERE phone=$1 AND active", [
        phone,
      ])
    ).rows[0];
    if (user) {
      await transaction(pool, async (client) => {
        const current = (
          await client.query(
            "SELECT id,phone,password_hash,active FROM users WHERE id=$1 FOR UPDATE",
            [user.id],
          )
        ).rows[0];
        assert(
          current?.active && current.phone === phone,
          400,
          "Thông tin xác minh không còn hợp lệ.",
        );
        const prior = (
          await client.query("SELECT created_at FROM password_reset_otps WHERE user_id=$1", [
            user.id,
          ])
        ).rows[0];
        assert(
          !prior || Date.now() - new Date(prior.created_at).getTime() >= 60000,
          429,
          "Vui lòng chờ 60 giây trước khi yêu cầu mã mới.",
        );
        await client.query("DELETE FROM password_reset_otps WHERE user_id=$1", [user.id]);
        await client.query(
          "INSERT INTO password_reset_otps(token_hash,user_id,phone,otp_hash,password_fingerprint,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes')",
          [
            tokenHash(requestId),
            user.id,
            phone,
            tokenHash(requestId + fixedCode),
            tokenHash(current.password_hash),
          ],
        );
      });
      try {
        await sendCode(phone, fixedCode);
      } catch {
        await pool.query("DELETE FROM password_reset_otps WHERE token_hash=$1", [
          tokenHash(requestId),
        ]);
        assert(false, 503, "Chưa gửi được mã xác minh. Vui lòng thử lại sau.");
      }
    }
    res.json({
      requestId,
      phone: maskPhone(phone),
      expiresIn: 300,
      delivery: process.env.SMS_WEBHOOK_URL ? "sms" : "fixed",
    });
  });
  app.post("/api/auth/password/otp/verify", limit, async (req, res) => {
    const input = z
      .object({ requestId: z.string().regex(/^[a-f0-9]{64}$/), otp: z.string().regex(/^\d{6}$/) })
      .strict()
      .parse(req.body);
    const result = await transaction(pool, async (client) => {
      const initial = (
        await client.query("SELECT user_id FROM password_reset_otps WHERE token_hash=$1", [
          tokenHash(input.requestId),
        ])
      ).rows[0];
      if (!initial) return null;
      const user = (
        await client.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [initial.user_id])
      ).rows[0];
      const request = (
        await client.query("SELECT * FROM password_reset_otps WHERE token_hash=$1 FOR UPDATE", [
          tokenHash(input.requestId),
        ])
      ).rows[0];
      if (
        !request ||
        !user?.active ||
        user.phone !== request.phone ||
        request.verified_at ||
        new Date(request.expires_at) <= new Date() ||
        request.attempts >= 5 ||
        request.password_fingerprint !== tokenHash(user.password_hash)
      )
        return null;
      if (request.otp_hash !== tokenHash(input.requestId + input.otp)) {
        await client.query(
          "UPDATE password_reset_otps SET attempts=attempts+1 WHERE token_hash=$1",
          [request.token_hash],
        );
        return null;
      }
      const challenge = newToken();
      await client.query("UPDATE password_reset_otps SET verified_at=now() WHERE token_hash=$1", [
        request.token_hash,
      ]);
      await client.query("DELETE FROM password_reset_challenges WHERE user_id=$1", [user.id]);
      await client.query(
        "INSERT INTO password_reset_challenges(token_hash,user_id,password_fingerprint,phone,expires_at) VALUES($1,$2,$3,$4,now()+interval '5 minutes')",
        [tokenHash(challenge), user.id, tokenHash(user.password_hash), user.phone],
      );
      return challenge;
    });
    assert(result, 400, "Mã OTP không đúng hoặc đã hết hiệu lực. Vui lòng yêu cầu mã mới khi cần.");
    res.json({ challenge: result, expiresIn: 300 });
  });
}
