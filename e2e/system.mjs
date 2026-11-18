import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
const accounts = JSON.parse(
  await readFile(process.env.E2E_ACCOUNTS_FILE || ".runtime/demo-accounts.json", "utf8"),
);
const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:5173";
const browserChannel = process.env.E2E_BROWSER || "msedge";
const browser = await chromium.launch({ channel: browserChannel, headless: true });
const errors = [],
  results = [];
const contexts = [];
await mkdir(".runtime/screenshots", { recursive: true });
async function user(role, email) {
  const credentials = accounts.find(
    (a) =>
      a.email ===
      (email ||
        { admin: "admin", helpdesk: "helpdesk", technician: "technician", "end-user": "user" }[
          role
        ] + "@nexdesk.local"),
  );
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push({ role, error: e.message }));
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500)
      errors.push({ role, error: `API ${r.status()} ${new URL(r.url()).pathname}` });
  });
  await page.goto(origin + "/");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL("**/" + role);
  await page.locator('summary[aria-label="Tài khoản"]').waitFor();
  return page;
}
try {
  for (const role of ["admin", "helpdesk", "technician", "end-user"]) {
    const page = await user(role);
    const paths = {
      admin: [
        "",
        "tickets",
        "sla",
        "employees",
        "departments",
        "assets",
        "software",
        "documents",
        "reports",
      ],
      helpdesk: ["", "queue", "resolve", "escalate", "tracking"],
      technician: ["", "assigned", "in-progress", "results", "devices"],
      "end-user": ["", "new-request", "tickets", "tracking", "feedback", "knowledge"],
    }[role];
    for (const path of paths) {
      await page.goto(origin + "/" + role + (path ? "/" + path : ""));
      await page.locator("header").waitFor();
      await page.waitForTimeout(150);
      assert(
        !(await page.locator("body").innerText()).includes("This page didn't load"),
        `${role}/${path} failed`,
      );
      results.push({ page: "/" + role + (path ? "/" + path : ""), status: "PASS" });
    }
    await page.goto(origin + "/" + role);
    await page.locator("header").waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({
      path: resolve(".runtime/screenshots/" + role + ".png"),
      fullPage: true,
    });
    if (role === "admin") {
      await page.goto(origin + "/admin/sla");
      const automatic = page.getByRole("checkbox", {
        name: "Tự động đóng khi End User chưa xác nhận",
        exact: true,
      });
      await automatic.check();
      await page.getByLabel("Thời gian chờ", { exact: true }).fill("2");
      await page.getByRole("button", { name: "Lưu cấu hình", exact: true }).click();
      await expect(page.getByText("Đã lưu chính sách Ticket.", { exact: true })).toBeVisible();
      await page.reload();
      await expect(automatic).toBeChecked();
      await expect(page.getByLabel("Thời gian chờ", { exact: true })).toHaveValue("2");
      await page.screenshot({
        path: resolve(".runtime/screenshots/" + browserChannel + "-admin-sla.png"),
        fullPage: true,
      });
      await automatic.uncheck();
      await page.getByLabel("Thời gian chờ", { exact: true }).fill("1440");
      const savedPolicy = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/settings/tickets") && response.request().method() === "PUT",
      );
      await page.getByRole("button", { name: "Lưu cấu hình", exact: true }).click();
      assert.equal((await savedPolicy).status(), 200);
      await page.goto(origin + "/admin/employees");
      await page.getByRole("button", { name: "Thêm nhân viên", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await expect(
        page.getByRole("dialog").getByText("Số điện thoại liên kết", { exact: true }),
      ).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    }
    if (role === "end-user") {
      await page.goto(origin + "/admin");
      await page.getByRole("heading", { name: "Bạn không có quyền vào cổng này" }).waitFor();
      results.push({ page: "cross-portal guard", status: "PASS" });
    }
  }
  const requester = await user("end-user"),
    helpdesk = await user("helpdesk"),
    tech = await user("technician"),
    admin = await user("admin");
  async function acknowledge(page, title) {
    const notice = page.getByRole("alertdialog", { name: title, exact: true });
    await expect(notice).toBeVisible();
    const box = await notice.boundingBox(),
      viewport = page.viewportSize();
    assert(
      Math.abs(box.x + box.width / 2 - viewport.width / 2) < 25,
      "Notice must be centered horizontally",
    );
    assert(
      Math.abs(box.y + box.height / 2 - viewport.height / 2) < 25,
      "Notice must be centered vertically",
    );
    await notice.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  }
  async function images(container, count) {
    const gallery = container.getByRole("region", { name: "Ảnh và tệp của yêu cầu", exact: true });
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery.getByRole("img")).toHaveCount(count);
    await expect
      .poll(() =>
        gallery
          .getByRole("img")
          .evaluateAll((items) => items.every((img) => img.complete && img.naturalWidth > 0)),
      )
      .toBe(true);
  }
  const title = "E2E doc fixes " + new Date().toISOString();
  await requester.goto(origin + "/end-user/new-request");
  assert.equal(await requester.getByLabel("Thiết bị liên quan", { exact: true }).count(), 0);
  assert.equal(await requester.getByText("Có thể bạn tự xử lý được", { exact: true }).count(), 0);
  assert.equal(await requester.getByText("Cam kết thời gian phản hồi", { exact: true }).count(), 0);
  await requester.locator('input[name="title"]').fill(title);
  await requester
    .locator('textarea[name="description"]')
    .fill("Kiểm thử yêu cầu hỗ trợ có ảnh chụp màn hình, phân công và xử lý qua hội thoại.");
  const png = await requester.locator("header").screenshot({ type: "png" });
  await requester.getByLabel("Tệp đính kèm yêu cầu", { exact: true }).setInputFiles([
    { name: "anh-man-hinh-1.png", mimeType: "image/png", buffer: png },
    { name: "anh-man-hinh-2.png", mimeType: "image/png", buffer: png },
  ]);
  const transfer = await requester.evaluateHandle((encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], "ảnh-lỗi-kéo-thả.png", { type: "image/png" }));
    return data;
  }, png.toString("base64"));
  await requester
    .getByText("Kéo thả ảnh chụp màn hình hoặc tệp vào đây", { exact: true })
    .locator("..")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(requester.getByRole("img", { name: /^Xem trước / })).toHaveCount(3);
  await expect
    .poll(() =>
      requester
        .getByRole("img", { name: /^Xem trước / })
        .evaluateAll((items) => items.every((img) => img.complete && img.naturalWidth > 0)),
    )
    .toBe(true);
  await requester.screenshot({
    path: resolve(".runtime/screenshots/" + browserChannel + "-multiple-image-preview.png"),
    fullPage: true,
  });
  await requester.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click();
  await requester.waitForURL("**/end-user/tickets");
  await acknowledge(requester, "Đã gửi yêu cầu hỗ trợ");
  let userRow = requester.getByRole("row").filter({ hasText: title });
  await expect(userRow).toBeVisible();
  const ticketId = (await userRow.locator("td").first().locator("p").first().innerText()).trim();
  await expect(
    userRow.getByRole("button", { name: "Xác nhận hoàn thành", exact: true }),
  ).toBeDisabled();
  assert.equal(
    await requester.getByRole("columnheader", { name: "Tiến độ", exact: true }).count(),
    0,
  );
  await userRow.click();
  const userDetails = requester.getByRole("dialog");
  await expect(userDetails.getByRole("heading", { name: title, exact: true })).toBeVisible();
  assert.equal(await userDetails.getByRole("region", { name: "Hội thoại Ticket" }).count(), 0);
  assert.equal(await userDetails.getByRole("textbox").count(), 0);
  assert.equal(await userDetails.locator('input[type="file"]').count(), 0);
  await expect(userDetails.getByRole("region", { name: "Lịch sử trạng thái" })).toBeVisible();
  await expect(userDetails.getByRole("combobox")).toHaveCount(3);
  await userDetails.getByLabel("Mức ưu tiên", { exact: true }).selectOption("Cao");
  await userDetails.getByRole("button", { name: "Lưu phân loại", exact: true }).click();
  await expect(
    requester.getByText("Đã cập nhật thông tin đề xuất.", { exact: true }),
  ).toBeVisible();
  await userDetails.getByRole("button", { name: "Close", exact: true }).click();
  await helpdesk.goto(origin + "/helpdesk/queue");
  assert.equal(await helpdesk.getByRole("row").filter({ hasText: title }).count(), 0);
  assert.equal(await helpdesk.getByRole("button", { name: "Nhận", exact: true }).count(), 0);
  await admin.goto(origin + "/admin/tickets");
  await admin.getByRole("row").filter({ hasText: title }).click();
  let adminDetails = admin.getByRole("dialog");
  await images(adminDetails, 3);
  await expect(adminDetails.getByLabel("Mức ưu tiên", { exact: true })).toHaveValue("");
  await expect(adminDetails.getByLabel("Loại yêu cầu", { exact: true })).toHaveValue("");
  await expect(adminDetails.getByLabel("Thiết bị liên quan", { exact: true })).toHaveValue("");
  async function classify(container) {
    await container.getByLabel("Mức ưu tiên", { exact: true }).selectOption("Thấp");
    await container.getByLabel("Loại yêu cầu", { exact: true }).selectOption("Phần cứng");
    await container.getByLabel("Thiết bị liên quan", { exact: true }).selectOption("none");
  }
  await classify(adminDetails);
  await adminDetails
    .getByLabel("Người xử lý", { exact: true })
    .selectOption({ label: "Phạm Đức Huy · Technician" });
  await adminDetails.getByRole("button", { name: "Xác nhận phân công", exact: true }).click();
  await acknowledge(admin, "Đã phân công");
  await tech.goto(origin + "/technician/assigned");
  const techRow = tech.getByRole("row").filter({ hasText: title });
  assert.equal(await tech.getByRole("button", { name: "Chi tiết & chat", exact: true }).count(), 0);
  await techRow.click();
  const techDetails = tech.getByRole("dialog");
  assert.equal(await techDetails.getByRole("combobox").count(), 0);
  await expect(techDetails.getByText("Thấp", { exact: true })).toBeVisible();
  await images(techDetails, 3);
  assert.equal(await techDetails.getByRole("region", { name: "Hội thoại Ticket" }).count(), 0);
  assert.equal(await techDetails.getByRole("region", { name: "Lịch sử trạng thái" }).count(), 0);
  assert.equal(await techDetails.locator('input[type="file"]').count(), 0);
  await expect(techDetails.getByLabel("Nội dung ghi chú nội bộ", { exact: true })).toBeVisible();
  await techDetails.getByRole("button", { name: "Close", exact: true }).click();
  await tech.goto(origin + "/technician/in-progress");
  await expect(tech.getByRole("heading", { name: "Xử lý sự cố", exact: true })).toBeVisible();
  await tech.getByLabel("Chọn yêu cầu đang xử lý", { exact: true }).selectOption(ticketId);
  await images(tech, 3);
  await requester.goto(origin + "/end-user/tracking");
  await requester.getByLabel("Chọn yêu cầu cần theo dõi", { exact: true }).selectOption(ticketId);
  assert.equal(
    await requester.getByRole("heading", { name: "Yêu cầu của bạn", exact: true }).count(),
    0,
  );
  assert.equal(
    await requester.getByRole("heading", { name: "Nhật ký xử lý", exact: true }).count(),
    0,
  );
  const userMessage = "Máy của tôi vẫn hiển thị lỗi, tôi đã gửi kèm ba ảnh màn hình.";
  await requester.getByLabel("Nội dung tin nhắn", { exact: true }).fill(userMessage);
  await requester.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await expect(
    tech.getByRole("region", { name: "Hội thoại Ticket" }).getByText(userMessage, { exact: true }),
  ).toBeVisible();
  const techMessage = "Tôi đang kiểm tra các ảnh và kết nối của máy, bạn giữ máy mở giúp tôi.";
  await tech.getByLabel("Nội dung tin nhắn", { exact: true }).fill(techMessage);
  await tech.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await expect(
    requester
      .getByRole("region", { name: "Hội thoại Ticket" })
      .getByText(techMessage, { exact: true }),
  ).toBeVisible();
  await tech.screenshot({
    path: resolve(".runtime/screenshots/" + browserChannel + "-technician-incident-workspace.png"),
    fullPage: true,
  });
  await tech
    .getByLabel("Lý do chuyển cho Helpdesk", { exact: true })
    .fill("Nhờ Helpdesk tiếp tục hỗ trợ tài khoản tại máy người dùng.");
  await tech.getByRole("button", { name: "Chuyển cho Helpdesk", exact: true }).click();
  await acknowledge(tech, "Đã chuyển yêu cầu cho Admin");
  await admin.reload();
  await admin.getByRole("button", { name: /Trả về Helpdesk/ }).click();
  await admin.getByRole("row").filter({ hasText: title }).click();
  adminDetails = admin.getByRole("dialog");
  await classify(adminDetails);
  assert.equal(
    await adminDetails
      .getByLabel("Người xử lý", { exact: true })
      .locator("option")
      .filter({ hasText: "Technician" })
      .count(),
    0,
  );
  await adminDetails
    .getByLabel("Người xử lý", { exact: true })
    .selectOption({ label: "Lý Mỹ Duyên · Helpdesk" });
  await adminDetails.getByRole("button", { name: "Xác nhận phân công", exact: true }).click();
  await acknowledge(admin, "Đã phân công");
  await helpdesk.reload();
  await helpdesk.getByRole("row").filter({ hasText: title }).click();
  const hdDetails = helpdesk.getByRole("dialog");
  await images(hdDetails, 3);
  assert.equal(await hdDetails.getByRole("textbox").count(), 0);
  assert.equal(await hdDetails.getByRole("region", { name: "Hội thoại Ticket" }).count(), 0);
  assert.equal(await hdDetails.getByRole("region", { name: "Lịch sử trạng thái" }).count(), 0);
  assert.equal(
    await hdDetails
      .getByRole("button", { name: /Chờ phản hồi|Ghi kết quả|Chuyển cho Helpdesk|Lưu ghi chú/ })
      .count(),
    0,
  );
  assert.equal(
    await hdDetails.getByRole("button", { name: "Lưu phân loại", exact: true }).count(),
    0,
  );
  assert.equal(await hdDetails.getByRole("combobox").count(), 0);
  await hdDetails.getByRole("button", { name: "Close", exact: true }).click();
  await helpdesk.goto(origin + "/helpdesk/resolve");
  await helpdesk.getByLabel("Chọn yêu cầu đang xử lý", { exact: true }).selectOption(ticketId);
  assert.equal(await helpdesk.getByText("Các bước xử lý nhanh", { exact: true }).count(), 0);
  assert.equal(await helpdesk.getByText("Gợi ý từ kho giải pháp", { exact: true }).count(), 0);
  assert.equal(
    await helpdesk.getByRole("button", { name: "Chi tiết & lịch sử Ticket", exact: true }).count(),
    0,
  );
  await expect(
    helpdesk
      .getByRole("region", { name: "Hội thoại Ticket" })
      .getByText(userMessage, { exact: true }),
  ).toBeVisible();
  await expect(
    helpdesk
      .getByRole("region", { name: "Hội thoại Ticket" })
      .getByText(techMessage, { exact: true }),
  ).toBeVisible();
  const hdMessage = "Helpdesk đã nhận phân công và sẽ tiếp tục hỗ trợ bạn.";
  await helpdesk.getByLabel("Nội dung tin nhắn", { exact: true }).fill(hdMessage);
  await helpdesk.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await expect(
    requester
      .getByRole("region", { name: "Hội thoại Ticket" })
      .getByText(hdMessage, { exact: true }),
  ).toBeVisible();
  await helpdesk.getByRole("button", { name: "Đã giải quyết xong", exact: true }).click();
  let resolution = helpdesk.getByRole("alertdialog", {
    name: "Bạn có chắc chắn xác nhận giải quyết xong không?",
    exact: true,
  });
  await resolution.getByRole("button", { name: "Chưa, tiếp tục xử lý", exact: true }).click();
  await helpdesk.getByRole("button", { name: "Đã giải quyết xong", exact: true }).click();
  resolution = helpdesk.getByRole("alertdialog", {
    name: "Bạn có chắc chắn xác nhận giải quyết xong không?",
    exact: true,
  });
  await resolution
    .getByLabel("Kết quả xử lý", { exact: true })
    .fill("Đã điều chỉnh cấu hình tài khoản và kiểm tra kết nối thành công.");
  await resolution.getByRole("button", { name: "Có, đã giải quyết", exact: true }).click();
  await acknowledge(helpdesk, "Đã xác nhận giải quyết xong");
  await requester.getByRole("button", { name: "Yêu cầu xử lý tiếp", exact: true }).click();
  await requester
    .getByLabel("Vấn đề còn tồn tại", { exact: true })
    .fill("Sự cố vẫn còn khi mở lại phần mềm, nhờ hỗ trợ thêm.");
  await requester.getByRole("button", { name: "Gửi yêu cầu xử lý tiếp", exact: true }).click();
  await acknowledge(requester, "Đã gửi yêu cầu xử lý tiếp");
  await helpdesk.getByRole("button", { name: "Đã giải quyết xong", exact: true }).click();
  resolution = helpdesk.getByRole("alertdialog", {
    name: "Bạn có chắc chắn xác nhận giải quyết xong không?",
    exact: true,
  });
  await resolution
    .getByLabel("Kết quả xử lý", { exact: true })
    .fill("Đã khắc phục nguyên nhân cuối cùng và kiểm tra lại hoạt động ổn định.");
  await resolution.getByRole("button", { name: "Có, đã giải quyết", exact: true }).click();
  await acknowledge(helpdesk, "Đã xác nhận giải quyết xong");
  await requester.goto(origin + "/end-user/tickets");
  userRow = requester.getByRole("row").filter({ hasText: title });
  await expect(
    userRow.getByRole("button", { name: "Xác nhận hoàn thành", exact: true }),
  ).toBeEnabled();
  await userRow.getByRole("button", { name: "Xác nhận hoàn thành", exact: true }).click();
  const complete = requester.getByRole("alertdialog", {
    name: "Xác nhận hoàn thành yêu cầu?",
    exact: true,
  });
  await complete.getByRole("button", { name: "Xác nhận hoàn thành", exact: true }).click();
  await acknowledge(requester, "Đã xác nhận hoàn thành");
  await expect(
    userRow.getByRole("button", { name: "Đã xác nhận hoàn thành", exact: true }),
  ).toBeDisabled();
  await requester.goto(origin + "/end-user/tracking");
  await requester.getByLabel("Chọn yêu cầu cần theo dõi", { exact: true }).selectOption(ticketId);
  await expect(
    requester.getByText("Ticket đã đóng. Bạn vẫn có thể đọc lịch sử hội thoại.", { exact: true }),
  ).toBeVisible();
  await requester.setViewportSize({ width: 390, height: 844 });
  assert(
    await requester.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    "Mobile tracking page must not overflow horizontally",
  );
  await requester.screenshot({
    path: resolve(".runtime/screenshots/" + browserChannel + "-end-user-tracking-mobile.png"),
    fullPage: true,
  });
  await admin.goto(origin + "/admin/tickets");
  await expect(
    admin.getByRole("row").filter({ hasText: title }).getByText("Đã đóng", { exact: true }),
  ).toBeVisible();
  results.push({
    page: "Requested doc fixes: multi-image previews/upload, readonly details, centered notices, two incident workspaces, chat, resolution/reopen and completion",
    status: "PASS",
  });
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    `.runtime/browser-verification${browserChannel === "msedge" ? "" : "-" + browserChannel}.json`,
    JSON.stringify({ results, errors, finishedAt: new Date().toISOString() }, null, 2),
  );
  console.log(
    JSON.stringify(
      { passed: results.length, errors, screenshots: ".runtime/screenshots" },
      null,
      2,
    ),
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
