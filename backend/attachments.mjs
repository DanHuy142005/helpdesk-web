import multer from "multer";
import { randomUUID } from "node:crypto";
import { assert } from "./security.mjs";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 12 },
});

export function validateAttachments(files) {
  assert(files.length <= 10, 400, "Mỗi lần chỉ được đính kèm tối đa 10 tệp.");
  for (const { buffer, mimetype } of files) {
    const valid =
      (mimetype === "image/png" &&
        buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mimetype === "image/jpeg" && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ||
      (mimetype === "application/pdf" && buffer.subarray(0, 5).toString() === "%PDF-") ||
      (mimetype === "text/plain" && !buffer.includes(0));
    assert(
      valid && buffer.length > 0 && buffer.length <= 5242880,
      400,
      "Chỉ nhận PNG, JPEG, PDF, TXT đúng định dạng; tối đa 5 MB mỗi tệp.",
    );
  }
}

export async function saveAttachments(client, user, entity, id, files) {
  const result = [];
  for (const file of files) {
    const decoded = Buffer.from(file.originalname, "latin1").toString("utf8");
    const name = (decoded.includes("\uFFFD") ? file.originalname : decoded)
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 200);
    const attachmentId = randomUUID();
    await client.query(
      `WITH saved AS (
         INSERT INTO attachments(id,ticket_id,document_id,author_id,name,mime,data,size)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
       )
       INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details)
       SELECT gen_random_uuid(),$4,'upload',$9,$10,jsonb_build_object('attachmentId',id,'size',$8)
       FROM saved`,
      [
        attachmentId,
        entity === "tickets" ? id : null,
        entity === "documents" ? id : null,
        user.id,
        name,
        file.mimetype,
        file.buffer,
        file.buffer.length,
        entity,
        id,
      ],
    );
    result.push({ id: attachmentId, name, mime: file.mimetype, size: file.buffer.length });
  }
  return result;
}
