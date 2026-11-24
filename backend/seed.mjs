import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { transaction } from "./db.mjs";
import { hashPassword } from "./security.mjs";

export async function seed(pool, { password, accountsFile } = {}) {
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(712047)");
    if (Number((await client.query("SELECT count(*) FROM users")).rows[0].count)) return null;
    const demoPassword = password || randomBytes(18).toString("base64url");
    const hash = await hashPassword(demoPassword);
    for (const [id, name, head] of [
      ["IT", "Công nghệ thông tin", "Nguyễn Hoàng Long"],
      ["TC", "Tài chính", "Trần Thu Hà"],
      ["KD", "Kinh doanh", "Trần Quốc Bảo"],
    ]) {
      await client.query("INSERT INTO departments(id,name,head) VALUES($1,$2,$3)", [
        id,
        name,
        head,
      ]);
    }
    const accounts = [
      ["admin", "Nguyễn Hoàng Long", "IT", "Trưởng phòng CNTT"],
      ["helpdesk", "Lý Mỹ Duyên", "IT", "Chuyên viên Helpdesk"],
      ["technician", "Phạm Đức Huy", "IT", "Kỹ thuật viên hệ thống"],
      ["end-user", "Trần Thu Hà", "TC", "Kế toán viên"],
      ["technician", "Đặng Hoàng Nam", "IT", "Kỹ thuật viên mạng"],
      ["end-user", "Trần Quốc Bảo", "KD", "Nhân viên kinh doanh"],
    ].map(([role, name, department, position], i) => ({
      id: randomUUID(),
      role,
      name,
      department,
      position,
      email:
        ["admin", "helpdesk", "technician", "user", "technician2", "user2"][i] + "@nexdesk.local",
      code: `NV-${String(i + 1).padStart(3, "0")}`,
    }));
    for (const a of accounts)
      await client.query(
        "INSERT INTO users(id,code,name,email,password_hash,role,department_id,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [a.id, a.code, a.name, a.email, hash, a.role, a.department, a.position],
      );
    const [admin, helpdesk, technician, user, technician2, user2] = accounts;
    for (const [id, name, type, location] of [
      ["LT-001", "Dell Latitude 7440", "Laptop", "Tầng 4"],
      ["PC-001", "HP EliteDesk 800", "PC", "Tầng 3"],
      ["PR-001", "Canon imageRUNNER", "Máy in", "Tầng 2"],
      ["LT-002", "Lenovo ThinkPad T14", "Laptop", "Kho CNTT"],
    ]) {
      await client.query(
        "INSERT INTO assets(id,name,type,serial,location,warranty) VALUES($1,$2,$3,$4,$5,current_date+365)",
        [id, name, type, "SN-" + id, location],
      );
    }
    for (const [asset, recipient] of [
      ["LT-001", user],
      ["PC-001", user2],
      ["PR-001", user],
    ]) {
      await client.query(
        "INSERT INTO asset_assignments(id,asset_id,user_id,department_id,actor_id,condition,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          asset,
          recipient.id,
          recipient.department,
          admin.id,
          "Hoạt động tốt",
          "Cấp phát thiết bị phục vụ công việc.",
        ],
      );
      await client.query("UPDATE assets SET status='Đang sử dụng' WHERE id=$1", [asset]);
    }
    const software = randomUUID();
    await client.query(
      "INSERT INTO software(id,name,vendor,version,license_type,seats,expires) VALUES($1,'Microsoft 365 Business','Microsoft','2026','Thuê bao',10,current_date+180)",
      [software],
    );
    await client.query(
      "INSERT INTO software_installations(software_id,asset_id,actor_id) VALUES($1,$2,$3)",
      [software, "LT-001", admin.id],
    );
    for (const [title, category, content] of [
      [
        "Khắc phục Outlook không đồng bộ email",
        "Hướng dẫn",
        "Kiểm tra kết nối Internet. Đóng và mở lại Outlook. Kiểm tra trạng thái tài khoản. Nếu lỗi vẫn tiếp diễn, tạo Ticket và đính kèm ảnh chụp màn hình; không gửi mật khẩu.",
      ],
      [
        "Quy trình xử lý sự cố CNTT",
        "Quy trình",
        "Nhân viên gửi yêu cầu. Admin phân công Helpdesk hoặc Technician. Người được giao giải quyết và chat với người yêu cầu. Technician có thể trả Ticket về hàng đợi Helpdesk kèm lý do để Admin phân công lại. Người phụ trách ghi kết quả. Người yêu cầu xác nhận đóng hoặc yêu cầu xử lý tiếp.",
      ],
      [
        "Chính sách bảo mật tài khoản",
        "Chính sách",
        "Sử dụng mật khẩu riêng cho từng hệ thống, tối thiểu 7 ký tự. Không chia sẻ mật khẩu qua Ticket. Báo ngay Helpdesk khi nghi ngờ bị lộ tài khoản.",
      ],
    ])
      await client.query(
        "INSERT INTO documents(id,title,category,content,access_level,author_id) VALUES($1,$2,$3,$4,'published_' || $5,$6)",
        [randomUUID(), title, category, content, "public", admin.id],
      );
    const examples = [
      ["Không đăng nhập được Outlook", "Email & Office", "Mới", null, user, "LT-001"],
      ["Máy in in bị mờ", "Thiết bị ngoại vi", "Đang xử lý", helpdesk, user, "PR-001"],
      ["Laptop kết nối VPN bị gián đoạn", "Mạng & VPN", "Đang xử lý", technician, user, "LT-001"],
      ["Cập nhật phần mềm kế toán", "Phần mềm", "Đã giải quyết", technician, user, "LT-001"],
      ["Không nhận màn hình thứ hai", "Phần cứng", "Đã đóng", technician, user, "LT-001"],
      ["Máy tính kinh doanh chạy chậm", "Phần cứng", "Mới", null, user2, "PC-001"],
      ["Mạng nội bộ mất kết nối", "Mạng & VPN", "Đang xử lý", technician2, user2, "PC-001"],
    ];
    for (let i = 0; i < examples.length; i++) {
      const [title, category, status, assignee, requester, asset] = examples[i];
      const solved = ["Đã giải quyết", "Đã đóng"].includes(status);
      const { rows } = await client.query(
        `INSERT INTO tickets(title,description,category,priority,status,requester_id,assignee_id,asset_id,due_at,solution,accepted_at,resolved_at,closed_at,rating,feedback,created_at,requested_priority,requested_category,requested_asset_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '2 hours',$9,$10,$11,$12,$13,$14,now()-($15::int*interval '1 day'),$4,$3,$8) RETURNING *`,
        [
          title,
          `Yêu cầu hỗ trợ: ${title}. Sự cố ảnh hưởng công việc, đề nghị bộ phận CNTT kiểm tra.`,
          category,
          i === 2 ? "Cao" : "Trung bình",
          status,
          requester.id,
          assignee?.id || null,
          asset,
          solved
            ? "Đã kiểm tra, cập nhật cấu hình và xác minh thiết bị hoạt động bình thường."
            : "",
          assignee ? new Date(Date.now() - 3600000) : null,
          solved ? new Date() : null,
          status === "Đã đóng" ? new Date() : null,
          status === "Đã đóng" ? 5 : null,
          status === "Đã đóng" ? "Hỗ trợ nhanh, cảm ơn!" : "",
          i,
        ],
      );
      const t = rows[0];
      await client.query(
        "INSERT INTO ticket_events(id,ticket_id,actor_id,action,note,to_status,assignee_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          t.id,
          requester.id,
          "create",
          "Yêu cầu hỗ trợ được ghi nhận.",
          status,
          assignee?.id || null,
        ],
      );
      if (assignee) {
        await client.query(
          "UPDATE tickets SET assigned_by=$2,classified_by=$2,classification_confirmed_at=now() WHERE id=$1",
          [t.id, admin.id],
        );
        await client.query(
          "INSERT INTO ticket_events(id,ticket_id,actor_id,action,note,from_status,to_status,assignee_id) VALUES($1,$2,$3,'assign',$4,'Mới',$5,$6)",
          [randomUUID(), t.id, admin.id, "Admin phân công người xử lý.", status, assignee.id],
        );
        await client.query(
          "INSERT INTO ticket_messages(id,ticket_id,sender_id,body) VALUES($1,$2,$3,$4)",
          [
            randomUUID(),
            t.id,
            assignee.id,
            solved ? t.solution : "Đã nhận thông tin, đang kiểm tra và xử lý.",
          ],
        );
      }
    }
    await client.query(
      "INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        admin.id,
        "initialize",
        "system",
        "initial",
        JSON.stringify({ initialized: true }),
      ],
    );
    const credentials = accounts.map((a) => ({
      email: a.email,
      role: a.role,
      password: demoPassword,
    }));
    if (accountsFile) {
      await mkdir(new URL("../.runtime/", import.meta.url), { recursive: true });
      await writeFile(accountsFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
    }
    return { accounts, credentials };
  });
}
