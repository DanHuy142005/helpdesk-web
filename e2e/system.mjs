import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
const accounts = JSON.parse(await readFile(".runtime/demo-accounts.json", "utf8"));
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
  await page.goto(origin + "/" + role);
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.locator("header").waitFor();
  return page;
}
try {
  for (const role of ["admin", "helpdesk", "technician", "end-user"]) {
    const page = await user(role);
    const paths = {
      admin: [
        "",
        "tickets",
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
      await page.goto(origin + "/admin/employees");
      await page.getByRole("button", { name: "Thêm nhân viên", exact: true }).click();
      await page.getByRole("dialog").waitFor();
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
  const title = "E2E " + new Date().toISOString();
  await requester.goto(origin + "/end-user/new-request");
  await requester.locator('input[name="title"]').fill(title);
  await requester
    .locator('textarea[name="description"]')
    .fill("Kiểm thử luồng Ticket hoàn chỉnh từ giao diện trình duyệt.");
  await requester.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click();
  await requester.waitForURL("**/end-user/tickets");
  await requester.getByText(title, { exact: true }).waitFor();
  const row = helpdesk.getByRole("row").filter({ hasText: title });
  await helpdesk.goto(origin + "/helpdesk/queue");
  await row.getByRole("button", { name: "Nhận", exact: true }).click();
  await helpdesk.goto(origin + "/helpdesk/resolve");
  await helpdesk.getByRole("button").filter({ hasText: title }).click();
  await helpdesk.getByRole("button", { name: "Chi tiết & lịch sử Ticket" }).click();
  const hdDialog = helpdesk.getByRole("dialog");
  await hdDialog
    .getByRole("textbox")
    .first()
    .fill("Đã kiểm tra các bước cơ bản, cần Technician kiểm tra chuyên sâu.");
  await hdDialog.getByRole("combobox").first().selectOption({ label: "Phạm Đức Huy" });
  await hdDialog.getByRole("button", { name: "Chuyển Technician", exact: true }).click();
  await tech.goto(origin + "/technician/assigned");
  const techRow = tech.getByRole("row").filter({ hasText: title });
  await techRow.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  const techDialog = tech.getByRole("dialog");
  await techDialog.waitFor();
  await techDialog
    .getByRole("textbox")
    .first()
    .fill("Đã sửa cấu hình và kiểm tra hoạt động ổn định bằng trình duyệt.");
  await techDialog.getByRole("button", { name: "Ghi kết quả giải quyết", exact: true }).click();
  await requester.reload();
  await requester.getByRole("row").filter({ hasText: title }).click();
  const userDialog = requester.getByRole("dialog");
  await userDialog
    .getByRole("textbox")
    .first()
    .fill("Sự cố vẫn chưa hết, cần tiếp tục kiểm tra đường truyền.");
  await userDialog.getByRole("button", { name: "Yêu cầu xử lý tiếp", exact: true }).click();
  await techDialog
    .getByRole("textbox")
    .first()
    .fill("Đã khắc phục nguyên nhân cuối cùng và người dùng kiểm tra lại ổn định.");
  await techDialog.getByRole("button", { name: "Ghi kết quả giải quyết", exact: true }).click();
  await userDialog.getByRole("button", { name: "Xác nhận đóng Ticket", exact: true }).click();
  await userDialog.getByText("Đã đóng", { exact: true }).first().waitFor();
  await admin.goto(origin + "/admin/tickets");
  await admin
    .getByRole("row")
    .filter({ hasText: title })
    .getByText("Đã đóng", { exact: true })
    .waitFor();
  results.push({ page: "Full ticket workflow through 4 browser sessions", status: "PASS" });
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
