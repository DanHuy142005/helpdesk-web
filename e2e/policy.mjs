import { chromium, expect } from "@playwright/test";
import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Backdating is limited to the explicitly isolated QA database.
assert.equal(process.env.E2E_POLICY_QA, "1", "Run policy checks through the isolated QA helper.");
const origin = process.env.E2E_ORIGIN;
assert.equal(new URL(origin).port, "5193");
assert.equal(new URL(process.env.TEST_DATABASE_URL).port, "55434");
const accounts = JSON.parse(await readFile(process.env.E2E_ACCOUNTS_FILE, "utf8"));
const channel = process.env.E2E_BROWSER || "msedge";
const browser = await chromium.launch({ channel, headless: true });
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pages = {},
  users = {},
  contexts = [],
  errors = [],
  results = [];
async function call(page, path, body, method = "POST") {
  return page.evaluate(
    async ({ path, body, method }) => {
      const tab = sessionStorage.getItem("nexdesk.tab-id");
      const auth = await (
        await fetch("/api/auth/me", { headers: { "X-Nexdesk-Tab": tab } })
      ).json();
      const response = await fetch("/api" + path, {
        method,
        headers: {
          "X-Nexdesk-Tab": tab,
          "X-CSRF-Token": auth.csrfToken,
          "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "API request failed");
      return result;
    },
    { path, body, method },
  );
}
let originalPolicy;
try {
  for (const role of ["admin", "end-user", "helpdesk", "technician"]) {
    const account = accounts.find(
      (account) =>
        account.email ===
        { admin: "admin", "end-user": "user", helpdesk: "helpdesk", technician: "technician" }[
          role
        ] +
          "@nexdesk.local",
    );
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    contexts.push(context);
    const page = (pages[role] = await context.newPage());
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + "/");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL("**/" + role);
    await page.locator('summary[aria-label="Tài khoản"]').waitFor();
    users[role] = (await call(page, "/auth/me", undefined, "GET")).user;
  }
  const admin = pages.admin,
    requester = pages["end-user"];
  originalPolicy = await call(admin, "/settings/tickets", undefined, "GET");
  await call(
    admin,
    "/settings/tickets",
    { autoCloseEnabled: true, autoCloseMinutes: 1, version: originalPolicy.version },
    "PUT",
  );
  for (const role of ["helpdesk", "technician"]) {
    const title = `QA SLA ${channel} ${role} ${Date.now()}`;
    let ticket = await call(requester, "/tickets", {
      title,
      description: "Kiểm tra cảnh báo SLA và tự động đóng sau khi xử lý.",
      priority: "Cao",
      category: "Phần cứng",
    });
    ticket = await call(admin, `/tickets/${ticket.id}/assign`, {
      version: ticket.version,
      assigneeId: users[role].id,
      priority: "Khẩn cấp",
      category: "Phần cứng",
      assetId: null,
    });
    await pool.query(
      "UPDATE tickets SET created_at=now()-interval '16 minutes',due_at=now()-interval '1 minute' WHERE id=$1 AND requester_id=$2",
      [ticket.id, users["end-user"].id],
    );
    const handler = pages[role];
    await handler.goto(
      origin + (role === "helpdesk" ? "/helpdesk/resolve" : "/technician/in-progress"),
    );
    await handler.getByLabel("Chọn yêu cầu đang xử lý", { exact: true }).selectOption(ticket.id);
    await expect(handler.getByText("Đã quá hạn SLA", { exact: true })).toBeVisible();
    await handler.getByRole("button", { name: "Xem Ticket quá hạn SLA", exact: true }).click();
    await handler.getByRole("dialog").getByRole("button").filter({ hasText: ticket.id }).click();
    const detail = handler.getByRole("dialog");
    await expect(detail.getByText("Đã quá hạn SLA", { exact: true })).toBeVisible();
    assert.equal(await detail.getByRole("combobox").count(), 0);
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await expect
      .poll(
        async () => {
          const workspace = await call(handler, "/workspace", undefined, "GET");
          return workspace.notifications.some(
            (item) => item.ticket_id === ticket.id && item.message.includes("quá hạn SLA"),
          );
        },
        { timeout: 25000 },
      )
      .toBe(true);
    await handler.screenshot({
      path: `.runtime/screenshots/${channel}-${role}-sla-overdue.png`,
      fullPage: true,
    });
    await handler.getByRole("button", { name: "Đã giải quyết xong", exact: true }).click();
    const resolution = handler.getByRole("alertdialog");
    await resolution
      .getByLabel("Kết quả xử lý", { exact: true })
      .fill("Đã khắc phục sự cố và xác minh hoạt động ổn định.");
    await resolution.getByRole("button", { name: "Có, đã giải quyết", exact: true }).click();
    await handler
      .getByRole("alertdialog", { name: "Đã xác nhận giải quyết xong", exact: true })
      .getByRole("button", { name: "Đã hiểu", exact: true })
      .click();
    await requester.goto(origin + "/end-user/tracking");
    await requester
      .getByLabel("Chọn yêu cầu cần theo dõi", { exact: true })
      .selectOption(ticket.id);
    await expect(requester.getByText(/^Yêu cầu sẽ tự động đóng lúc/)).toBeVisible();
    await pool.query(
      "UPDATE tickets SET resolved_at=now()-interval '65 seconds' WHERE id=$1 AND requester_id=$2 AND status='Đã giải quyết'",
      [ticket.id, users["end-user"].id],
    );
    await expect(requester.getByText(/^Hệ thống đã tự động đóng yêu cầu lúc/)).toBeVisible({
      timeout: 25000,
    });
    const closed = await call(admin, `/tickets/${ticket.id}`, undefined, "GET");
    assert.equal(closed.status, "Đã đóng");
    assert.equal(closed.events.filter((event) => event.action === "auto-close").length, 1);
    assert.equal(closed.events.find((event) => event.action === "auto-close").actor, "Hệ thống");
    await admin.goto(origin + "/admin/sla");
    await admin.getByRole("tab", { name: /^Đã tự động đóng/ }).click();
    await admin.getByPlaceholder("Tìm kiếm...", { exact: true }).fill(ticket.id);
    await expect(admin.getByRole("row").filter({ hasText: title })).toBeVisible();
    await admin.setViewportSize({ width: 390, height: 844 });
    assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await admin.screenshot({
      path: `.runtime/screenshots/${channel}-sla-mobile.png`,
      fullPage: true,
    });
    await admin.setViewportSize({ width: 1440, height: 1000 });
    results.push(
      `${role}: overdue banner, private classification controls, scheduled alert, resolved deadline, scheduled closure, Admin list and mobile`,
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `.runtime/policy-verification-${channel}.json`,
    JSON.stringify({ results, errors, finishedAt: new Date().toISOString() }, null, 2),
  );
  console.log(JSON.stringify({ scheduledPolicyChecks: results.length, errors }));
} finally {
  if (originalPolicy && pages.admin) {
    const current = await call(pages.admin, "/settings/tickets", undefined, "GET").catch(
      () => null,
    );
    if (current)
      await call(
        pages.admin,
        "/settings/tickets",
        {
          autoCloseEnabled: originalPolicy.autoCloseEnabled,
          autoCloseMinutes: originalPolicy.autoCloseMinutes,
          version: current.version,
        },
        "PUT",
      ).catch(() => {});
  }
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
  await pool.end();
}
