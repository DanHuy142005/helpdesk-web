import { Router } from "express";
import { z } from "zod";
import { transaction } from "./db.mjs";
import { assert, audit } from "./security.mjs";

const serialize = (row) => ({
  autoCloseEnabled: row.auto_close_enabled,
  autoCloseMinutes: row.auto_close_minutes,
  version: row.version,
  updatedAt: row.updated_at,
});
export function ticketPolicyRouter(pool) {
  const router = Router();
  router.use((req, _res, next) => {
    assert(req.user.role === "admin", 403, "Chỉ Admin được quản lý chính sách Ticket.");
    next();
  });
  router.get("/", async (_req, res) =>
    res.json(serialize((await pool.query("SELECT * FROM ticket_policy WHERE id=true")).rows[0])),
  );
  router.put("/", async (req, res) => {
    const input = z
      .object({
        autoCloseEnabled: z.boolean(),
        autoCloseMinutes: z.number().int().min(1).max(525600),
        version: z.number().int().positive(),
      })
      .strict()
      .parse(req.body);
    const result = await transaction(pool, async (client) => {
      const current = (await client.query("SELECT * FROM ticket_policy WHERE id=true FOR UPDATE"))
        .rows[0];
      assert(current.version === input.version, 409, "Cấu hình vừa thay đổi. Vui lòng tải lại.");
      const updated = (
        await client.query(
          "UPDATE ticket_policy SET auto_close_enabled=$1,auto_close_minutes=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=true RETURNING *",
          [input.autoCloseEnabled, input.autoCloseMinutes, req.user.id],
        )
      ).rows[0];
      await audit(client, req.user.id, "ticket-policy", "settings", "tickets", {
        from: serialize(current),
        to: serialize(updated),
      });
      return serialize(updated);
    });
    res.json(result);
  });
  return router;
}
