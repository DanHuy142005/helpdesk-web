import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { upload, validateAttachments, saveAttachments } from "./attachments.mjs";
import { transaction } from "./db.mjs";
import { optionalPhoneSchema } from "./phone.mjs";
import {
  assert,
  audit,
  hashPassword,
  publicUser,
  getTicket,
  assertAssetAccess,
} from "./security.mjs";

const s = (min = 1, max = 200) => z.string().trim().min(min).max(max);
const code = s(2, 60).regex(/^[A-Za-z0-9_-]+$/);
const date = z.union([z.string().date(), z.literal(""), z.null()]).transform((v) => v || null);
const schemas = {
  departments: z.object({ id: code, name: s(), head: s(0) }).strict(),
  users: z
    .object({
      code,
      name: s(),
      email: z
        .string()
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      phone: optionalPhoneSchema.optional(),
      role: z.enum(["admin", "helpdesk", "technician", "end-user"]),
      department_id: s().nullable(),
      position: s(0),
      active: z.boolean(),
      password: z.string().min(7).max(128).optional(),
    })
    .strict(),
  assets: z
    .object({
      id: code,
      name: s(),
      type: s(),
      serial: s(0).nullable(),
      location: s(0),
      warranty: date,
      notes: s(0, 5000),
      status: z.enum(["Trong kho", "Đang sử dụng", "Bảo trì", "Thanh lý"]),
      specs: z
        .object({
          cpu: s(0),
          ram: s(0),
          storage: s(0),
          os: s(0),
          health: z.number().min(0).max(100),
        })
        .optional(),
    })
    .strict(),
  software: z
    .object({
      name: s(),
      vendor: s(0),
      version: s(0),
      license_type: z.enum(["Thuê bao", "Vĩnh viễn", "Mã nguồn mở"]),
      seats: z.number().int().min(1).max(1000000),
      expires: date,
    })
    .strict(),
  documents: z
    .object({
      title: s(5),
      category: s(),
      content: s(10, 100000),
      visibility: z.enum(["public", "internal"]),
      published: z.boolean(),
    })
    .strict(),
};

export async function assertDocument(client, user, id) {
  const { rows } = await client.query("SELECT * FROM documents WHERE id=$1", [id]);
  const doc = rows[0];
  assert(
    doc &&
      (user.role === "admin" ||
        (doc.published && (user.role !== "end-user" || doc.visibility === "public")) ||
        (user.role !== "end-user" && doc.author_id === user.id)),
    404,
    "Không tìm thấy tài liệu hoặc bạn không có quyền đọc.",
  );
  return doc;
}

export function resourceRouter(pool) {
  const router = Router();
  for (const [entity, schema] of Object.entries(schemas)) {
    for (const method of ["post", "put"])
      router[method](`/${entity}${method === "put" ? "/:id" : ""}`, async (req, res) => {
        const documentWriter =
          entity === "documents" && ["helpdesk", "technician"].includes(req.user.role);
        assert(
          req.user.role === "admin" || documentWriter,
          403,
          "Chỉ Admin có quyền quản lý danh mục.",
        );
        const input = schema.parse(req.body);
        const update = method === "put";
        const recordId = update ? req.params.id : input.id || randomUUID();
        const result = await transaction(pool, async (client) => {
          let previous;
          if (update) {
            previous = (
              await client.query(`SELECT * FROM ${entity} WHERE id=$1 FOR UPDATE`, [recordId])
            ).rows[0];
            assert(previous, 404, "Không tìm thấy bản ghi.");
            if (input.id) assert(input.id === recordId, 400, "Không thay đổi mã đã tạo.");
          }
          const record = { ...input };
          delete record.id;
          if (entity === "users") {
            const password = record.password;
            delete record.password;
            assert(update || password, 400, "Tài khoản mới cần mật khẩu ít nhất 7 ký tự.");
            if (password) record.password_hash = await hashPassword(password);
            if (
              update &&
              (password ||
                (input.phone !== undefined && input.phone !== previous.phone) ||
                !input.active ||
                input.role !== previous.role)
            ) {
              await client.query("DELETE FROM password_reset_otps WHERE user_id=$1", [recordId]);
              await client.query("DELETE FROM password_reset_challenges WHERE user_id=$1", [
                recordId,
              ]);
            }
            if (update && password)
              await client.query("DELETE FROM sessions WHERE user_id=$1", [recordId]);
            if (update) {
              assert(
                recordId !== req.user.id || (input.active && input.role === "admin"),
                400,
                "Không tự khóa hoặc thu hồi quyền Admin của chính bạn.",
              );
              if (!input.active || input.role !== previous.role) {
                const count = await client.query(
                  "SELECT id FROM tickets WHERE assignee_id=$1 AND status <> 'Đã đóng' LIMIT 1",
                  [recordId],
                );
                assert(
                  !count.rows.length,
                  409,
                  "Nhân viên còn Ticket chưa hoàn tất; cần xử lý trước khi khóa hoặc đổi vai trò.",
                );
                await client.query("DELETE FROM sessions WHERE user_id=$1", [recordId]);
              }
            }
          }
          if (entity === "documents") {
            if (documentWriter) {
              assert(
                !update || previous.author_id === req.user.id,
                403,
                "Chỉ sửa bản nháp do bạn tạo.",
              );
              assert(!update || !previous.published, 403, "Bài đã công bố cần Admin chỉnh sửa.");
              record.published = false;
              record.visibility = "internal";
            }
            if (!update) record.author_id = req.user.id;
            record.updated_at = new Date();
          }
          if (entity === "assets") {
            record.serial = record.serial || null;
            if (update) {
              const assigned =
                (
                  await client.query(
                    "SELECT id FROM asset_assignments WHERE asset_id=$1 AND ended_at IS NULL",
                    [recordId],
                  )
                ).rows.length > 0;
              assert(
                assigned
                  ? ["Đang sử dụng", "Bảo trì"].includes(record.status)
                  : record.status !== "Đang sử dụng",
                409,
                "Tình trạng phải khớp cấp phát. Dùng thao tác cấp phát/thu hồi để đổi người sử dụng.",
              );
            } else
              assert(
                record.status !== "Đang sử dụng",
                400,
                "Tạo thiết bị trong kho trước khi cấp phát.",
              );
            if (record.specs) record.specs = JSON.stringify(record.specs);
          }
          if (entity === "software" && update) {
            const used = Number(
              (
                await client.query(
                  "SELECT count(*) FROM software_installations WHERE software_id=$1",
                  [recordId],
                )
              ).rows[0].count,
            );
            assert(record.seats >= used, 409, "Số license không được thấp hơn số đang cấp.");
          }
          const keys = Object.keys(record);
          const values = Object.values(record);
          const sql = update
            ? `UPDATE ${entity} SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(",")}${entity === "assets" ? ",version=version+1" : ""} WHERE id=$1 RETURNING *`
            : `INSERT INTO ${entity}(id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => `$${i + 2}`).join(",")}) RETURNING *`;
          const { rows } = await client.query(sql, [recordId, ...values]);
          await audit(client, req.user.id, update ? "update" : "create", entity, recordId, {
            fields: keys.filter((k) => k !== "password_hash"),
            changes: Object.fromEntries(
              keys
                .filter((k) => k !== "password_hash")
                .map((key) => [key, { from: previous?.[key] ?? null, to: record[key] }]),
            ),
          });
          return entity === "users" ? publicUser(rows[0]) : rows[0];
        });
        res.status(update ? 200 : 201).json(result);
      });
    router.delete(`/${entity}/:id`, async (req, res) => {
      assert(req.user.role === "admin", 403, "Chỉ Admin được xóa bản ghi.");
      assert(entity !== "users", 400, "Dùng khóa tài khoản để bảo toàn lịch sử nhân viên.");
      await transaction(pool, async (client) => {
        const { rowCount } = await client.query(`DELETE FROM ${entity} WHERE id=$1`, [
          req.params.id,
        ]);
        assert(rowCount, 404, "Không tìm thấy bản ghi.");
        await audit(client, req.user.id, "delete", entity, req.params.id);
      });
      res.json({ ok: true });
    });
  }
  router.post("/assets/:id/assignments", async (req, res) => {
    assert(req.user.role === "admin", 403, "Chỉ Admin được cấp phát/thu hồi/điều chuyển.");
    const input = z
      .object({
        action: z.enum(["assign", "return", "transfer"]),
        userId: z.string().uuid().optional(),
        reason: s(5, 2000),
        condition: s(2, 2000),
        version: z.number().int().positive(),
      })
      .strict()
      .parse(req.body);
    await transaction(pool, async (client) => {
      const asset = (
        await client.query("SELECT * FROM assets WHERE id=$1 FOR UPDATE", [req.params.id])
      ).rows[0];
      assert(asset, 404, "Không tìm thấy tài sản.");
      assert(asset.version === input.version, 409, "Tài sản vừa thay đổi, hãy tải lại.");
      const current = (
        await client.query(
          "SELECT * FROM asset_assignments WHERE asset_id=$1 AND ended_at IS NULL FOR UPDATE",
          [asset.id],
        )
      ).rows[0];
      assert(
        input.action === "assign" ? !current : !!current,
        409,
        "Trạng thái cấp phát không phù hợp.",
      );
      assert(
        input.action === "return" || (asset.status !== "Thanh lý" && asset.status !== "Bảo trì"),
        409,
        "Tài sản đang bảo trì hoặc thanh lý.",
      );
      if (current)
        await client.query("UPDATE asset_assignments SET ended_at=now() WHERE id=$1", [current.id]);
      if (input.action !== "return") {
        const user = (
          await client.query("SELECT * FROM users WHERE id=$1 AND active FOR SHARE", [input.userId])
        ).rows[0];
        assert(user, 400, "Chọn người nhận đang hoạt động.");
        assert(
          !current || user.id !== current.user_id,
          400,
          "Người nhận mới phải khác người đang giữ.",
        );
        await client.query(
          "INSERT INTO asset_assignments(id,asset_id,user_id,department_id,actor_id,condition,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            randomUUID(),
            asset.id,
            user.id,
            user.department_id,
            req.user.id,
            input.condition,
            input.reason,
          ],
        );
      }
      await client.query("UPDATE assets SET status=$2,version=version+1 WHERE id=$1", [
        asset.id,
        input.action === "return"
          ? asset.status === "Bảo trì"
            ? "Bảo trì"
            : "Trong kho"
          : "Đang sử dụng",
      ]);
      await audit(client, req.user.id, input.action, "assets", asset.id, {
        previousUser: current?.user_id || null,
        userId: input.action === "return" ? null : input.userId || null,
        reason: input.reason,
        condition: input.condition,
      });
    });
    res.status(201).json({ ok: true });
  });
  router.get("/assets/:id/history", async (req, res) => {
    await assertAssetAccess(pool, req.user, req.params.id);
    // Technicians may only inspect assets connected to their assigned work.
    if (["helpdesk", "technician"].includes(req.user.role))
      assert(
        (
          await pool.query("SELECT id FROM tickets WHERE asset_id=$1 AND assignee_id=$2", [
            req.params.id,
            req.user.id,
          ])
        ).rows.length,
        403,
        "Thiết bị không liên quan công việc của bạn.",
      );
    const { rows } = await pool.query(
      `SELECT aa.*,u.name recipient,a.name actor,d.name department FROM asset_assignments aa JOIN users u ON u.id=aa.user_id JOIN users a ON a.id=aa.actor_id LEFT JOIN departments d ON d.id=aa.department_id WHERE aa.asset_id=$1 ORDER BY aa.started_at DESC`,
      [req.params.id],
    );
    res.json(rows);
  });
  router.post("/software/:id/installations", async (req, res) => {
    assert(req.user.role === "admin", 403, "Chỉ Admin được cấp/thu hồi license.");
    const input = z
      .object({ assetId: code, action: z.enum(["install", "remove"]) })
      .strict()
      .parse(req.body);
    await transaction(pool, async (client) => {
      const software = (
        await client.query("SELECT * FROM software WHERE id=$1 FOR UPDATE", [req.params.id])
      ).rows[0];
      assert(software, 404, "Không tìm thấy phần mềm.");
      if (input.action === "install") {
        const used = Number(
          (
            await client.query("SELECT count(*) FROM software_installations WHERE software_id=$1", [
              software.id,
            ])
          ).rows[0].count,
        );
        assert(used < software.seats, 409, "Đã dùng hết license.");
        assert(
          !software.expires ||
            new Date(software.expires).getTime() >= new Date().setHours(0, 0, 0, 0),
          409,
          "License đã hết hạn.",
        );
        const asset = (
          await client.query("SELECT id FROM assets WHERE id=$1 AND status <> 'Thanh lý'", [
            input.assetId,
          ])
        ).rows[0];
        assert(asset, 400, "Thiết bị không hợp lệ.");
        await client.query(
          "INSERT INTO software_installations(software_id,asset_id,actor_id) VALUES($1,$2,$3)",
          [software.id, input.assetId, req.user.id],
        );
      } else {
        assert(
          (
            await client.query(
              "DELETE FROM software_installations WHERE software_id=$1 AND asset_id=$2",
              [software.id, input.assetId],
            )
          ).rowCount,
          404,
          "Thiết bị chưa được cấp license.",
        );
      }
      await audit(client, req.user.id, input.action, "software", software.id, {
        assetId: input.assetId,
      });
    });
    res.json({ ok: true });
  });
  router.get("/documents/:id", async (req, res) => {
    await assertDocument(pool, req.user, req.params.id);
    const { rows } = await pool.query(
      `UPDATE documents SET views=views+1 WHERE id=$1 RETURNING *`,
      [req.params.id],
    );
    const attachments = (
      await pool.query("SELECT id,name,mime,size FROM attachments WHERE document_id=$1", [
        req.params.id,
      ])
    ).rows;
    res.json({ ...rows[0], attachments });
  });

  router.post(
    "/:entity/:id/attachments",
    upload.fields([
      { name: "file", maxCount: 1 },
      { name: "files", maxCount: 10 },
    ]),
    async (req, res) => {
      const { entity, id } = req.params;
      assert(["tickets", "documents"].includes(entity), 404, "Không tìm thấy tài nguyên.");
      const files = [...(req.files?.file || []), ...(req.files?.files || [])];
      assert(files.length, 400, "Chọn tệp cần tải lên.");
      validateAttachments(files);
      const attachment = await transaction(pool, async (client) => {
        if (entity === "tickets") {
          const t = await getTicket(client, req.user, id, true);
          assert(t.status !== "Đã đóng", 409, "Ticket đã đóng.");
        } else {
          const d = await assertDocument(client, req.user, id);
          assert(
            req.user.role === "admin" ||
              (req.user.role !== "end-user" && d.author_id === req.user.id && !d.published),
            403,
            "Không được đính kèm tài liệu này.",
          );
        }
        const saved = await saveAttachments(client, req.user, entity, id, files);
        return { id: saved[0].id, attachments: saved };
      });
      res.status(201).json(attachment);
    },
  );
  router.get("/attachments/:id", async (req, res) => {
    const file = (await pool.query("SELECT * FROM attachments WHERE id=$1", [req.params.id]))
      .rows[0];
    assert(file, 404, "Không tìm thấy tệp.");
    if (file.ticket_id) await getTicket(pool, req.user, file.ticket_id);
    else await assertDocument(pool, req.user, file.document_id);
    res
      .set({
        "Content-Type": file.mime,
        "Content-Disposition": `${req.query.inline === "1" && ["image/png", "image/jpeg"].includes(file.mime) ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
      })
      .send(file.data);
  });
  return router;
}
