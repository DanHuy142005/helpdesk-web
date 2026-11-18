import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:5173";
const channel = process.env.E2E_BROWSER || "msedge";
const accounts = JSON.parse(
  await readFile(process.env.E2E_ACCOUNTS_FILE || ".runtime/demo-accounts.json", "utf8"),
);
const browser = await chromium.launch({ channel, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const results = [],
  errors = [];
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
async function signIn(page, account) {
  await page.goto(origin + "/");
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
  const loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const response = await loginResponse;
  if (!response.ok()) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Login request failed");
  }
  await page.waitForURL("**/" + account.role);
  await page.locator('summary[aria-label="Tài khoản"]').waitFor();
}
async function identity(page) {
  return page.evaluate(async () => {
    const tab = sessionStorage.getItem("nexdesk.tab-id");
    const response = await fetch("/api/auth/me", { headers: { "X-Nexdesk-Tab": tab } });
    const body = await response.json();
    return { status: response.status, role: body.user?.role, id: body.user?.id, tab };
  });
}
try {
  await mkdir(".runtime/screenshots", { recursive: true });
  const landing = await context.newPage();
  await landing.goto(origin + "/");
  await expect(landing.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(landing.getByRole("button", { name: "Đăng nhập", exact: true })).toBeEnabled();
  assert.equal(
    await landing
      .getByRole("link", {
        name: /Admin Portal|Helpdesk Portal|Technician Portal|End User Portal|Danh sách cổng/,
      })
      .count(),
    0,
  );
  assert(!/demo|kiểm thử|thử nghiệm|minh họa/i.test(await landing.locator("body").innerText()));
  await landing.screenshot({
    path: ".runtime/screenshots/" + channel + "-login-desktop.png",
    fullPage: true,
  });
  await landing.setViewportSize({ width: 390, height: 844 });
  assert(await landing.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await landing.screenshot({
    path: ".runtime/screenshots/" + channel + "-login-mobile.png",
    fullPage: true,
  });
  await landing.close();
  results.push(
    "Root opens the production login page; desktop and mobile render without portal picker",
  );

  const pages = new Map();
  for (const role of ["admin", "helpdesk", "technician", "end-user"]) {
    const account = accounts.find((item) => item.role === role),
      page = await context.newPage();
    await signIn(page, account);
    pages.set(role, page);
  }
  const before = [];
  for (const [role, page] of pages) {
    const me = await identity(page);
    assert.equal(me.status, 200);
    assert.equal(me.role, role);
    before.push(me.tab);
  }
  assert.equal(new Set(before).size, 4);
  const cookies = await context.cookies(origin + "/api");
  const sessions = cookies.filter((cookie) => cookie.name.startsWith("nexdesk_session_"));
  assert.equal(sessions.length, 4);
  assert(sessions.every((cookie) => cookie.httpOnly && cookie.sameSite === "Strict"));
  for (const [role, page] of pages) {
    const tab = (await identity(page)).tab;
    await page.reload();
    await page.locator('summary[aria-label="Tài khoản"]').waitFor();
    const me = await identity(page);
    assert.equal(me.role, role);
    assert.equal(me.tab, tab);
    assert(!(await page.evaluate(() => document.cookie)).includes("nexdesk_session"));
  }
  results.push("Four roles remain independent in four tabs of one browser and survive reload");

  const parent = pages.get("end-user"),
    popupPromise = parent.waitForEvent("popup");
  await parent.evaluate(() => window.open("/", "_blank"));
  const duplicate = await popupPromise;
  await expect(duplicate.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  const helpdeskAccount = accounts.find((item) => item.role === "helpdesk");
  await duplicate.getByLabel("Email", { exact: true }).fill(helpdeskAccount.email);
  await duplicate.getByLabel("Mật khẩu", { exact: true }).fill(helpdeskAccount.password);
  await duplicate.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await duplicate.locator('summary[aria-label="Tài khoản"]').waitFor();
  const duplicateId = await duplicate.evaluate(() => sessionStorage.getItem("nexdesk.tab-id"));
  assert.notEqual(duplicateId, (await identity(parent)).tab);
  assert.equal((await identity(duplicate)).role, "helpdesk");
  assert.equal((await identity(parent)).role, "end-user");
  await duplicate.close();
  results.push("Opening a tab from another signed-in tab does not copy or replace its session");

  const admin = pages.get("admin");
  await admin.goto(origin + "/admin/reports");
  const downloadPromise = admin.waitForEvent("download");
  await admin.getByRole("button", { name: "Xuất báo cáo", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  results.push("CSV download uses the correct tab session");
  await admin.getByLabel("Tài khoản", { exact: true }).click();
  await admin.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await admin.waitForURL(origin + "/");
  await expect(admin.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  for (const [role, page] of pages)
    if (role !== "admin") assert.equal((await identity(page)).role, role);
  results.push("Signing out one tab leaves the other three roles signed in");

  await signIn(
    admin,
    accounts.find((item) => item.role === "admin"),
  );
  const initialPassword = randomBytes(24).toString("base64url"),
    nextPassword = "Seven7!";
  const email = randomBytes(8).toString("hex") + "@example.org";
  const phone =
    "+849" +
    (BigInt("0x" + randomBytes(6).toString("hex")) % 100000000n).toString().padStart(8, "0");
  const account = await admin.evaluate(
    async ({ email, password, phone }) => {
      const tab = sessionStorage.getItem("nexdesk.tab-id"),
        headers = { "X-Nexdesk-Tab": tab };
      const auth = await (await fetch("/api/auth/me", { headers })).json();
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "X-CSRF-Token": auth.csrfToken },
        body: JSON.stringify({
          code: "NV-" + email.slice(0, 8),
          name: "Nguyễn Minh An",
          email,
          password,
          role: "end-user",
          department_id: "IT",
          position: "Nhân viên",
          active: true,
        }),
      });
      if (!response.ok) throw new Error("Could not prepare account");
      return response.json();
    },
    { email, phone, password: initialPassword },
  );
  await admin.goto(origin + "/admin/employees");
  await admin.getByPlaceholder("Tìm nhân viên...", { exact: true }).fill(email);
  await admin.getByRole("row").filter({ hasText: email }).click();
  let employee = admin.getByRole("dialog");
  await employee.getByLabel("Số điện thoại liên kết", { exact: true }).fill("12345");
  await employee.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
  await expect(employee.getByRole("alert")).toContainText("Số điện thoại không hợp lệ");
  const nationalPhone = "0" + phone.slice(3);
  await employee.getByLabel("Số điện thoại liên kết", { exact: true }).fill(nationalPhone);
  const savedPhone = admin.waitForResponse(
    (response) =>
      response.url().endsWith("/api/users/" + account.id) && response.request().method() === "PUT",
  );
  await employee.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
  const saved = await savedPhone;
  if (!saved.ok()) throw new Error(JSON.stringify((await saved.json()).fields));
  await expect(employee).not.toBeVisible();
  await admin.reload();
  await admin.getByPlaceholder("Tìm nhân viên...", { exact: true }).fill(email);
  await admin.getByRole("row").filter({ hasText: email }).click();
  employee = admin.getByRole("dialog");
  await expect(employee.getByLabel("Số điện thoại liên kết", { exact: true })).toHaveValue(phone);
  await employee.getByRole("button", { name: "Close", exact: true }).click();
  results.push(
    "Employee form saves a national phone number, persists after reload and identifies invalid phone input",
  );
  const oldSession = await context.newPage(),
    secondSession = await context.newPage();
  await signIn(oldSession, { ...account, password: initialPassword });
  await signIn(secondSession, { ...account, password: initialPassword });
  const reset = await context.newPage();
  await reset.goto(origin + "/");
  await reset.getByRole("button", { name: "Quên mật khẩu?", exact: true }).click();
  assert.equal(await reset.getByLabel("Mật khẩu mới", { exact: true }).count(), 0);
  await reset.getByLabel("Số điện thoại", { exact: true }).fill("12345");
  await reset.getByRole("button", { name: "Yêu cầu mã OTP", exact: true }).click();
  await expect(reset.getByRole("alert")).toContainText("Số điện thoại không hợp lệ");
  await reset.getByLabel("Số điện thoại", { exact: true }).fill(nationalPhone);
  await reset.getByRole("button", { name: "Yêu cầu mã OTP", exact: true }).click();
  await expect(reset.getByLabel("Mã OTP", { exact: true })).toBeVisible();
  await reset.getByLabel("Mã OTP", { exact: true }).fill("000000");
  await reset.getByRole("button", { name: "Xác minh OTP", exact: true }).click();
  await expect(reset.getByRole("alert")).toContainText("Mã OTP không đúng hoặc đã hết hiệu lực");
  assert.equal(await reset.getByLabel("Mật khẩu mới", { exact: true }).count(), 0);
  await reset.getByLabel("Mã OTP", { exact: true }).fill("123456");
  await reset.getByRole("button", { name: "Xác minh OTP", exact: true }).click();
  await expect(reset.getByLabel("Mật khẩu mới", { exact: true })).toBeVisible();
  assert.equal(await reset.getByLabel("Mật khẩu cũ", { exact: true }).count(), 0);
  await reset.getByLabel("Mật khẩu mới", { exact: true }).fill(nextPassword);
  await reset.getByLabel("Nhập lại mật khẩu mới", { exact: true }).fill("different-password-123");
  await reset.getByRole("button", { name: "Lưu mật khẩu mới", exact: true }).click();
  await expect(reset.getByRole("alert")).toHaveText("Mật khẩu nhập lại chưa khớp.");
  await reset.getByLabel("Nhập lại mật khẩu mới", { exact: true }).fill(nextPassword);
  await reset.getByRole("button", { name: "Lưu mật khẩu mới", exact: true }).click();
  await expect(
    reset.getByRole("heading", { name: "Mật khẩu đã được cập nhật", exact: true }),
  ).toBeVisible();
  for (const page of [oldSession, secondSession]) {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  }
  for (const [role, page] of pages) assert.equal((await identity(page)).role, role);
  await reset.getByRole("button", { name: "Về đăng nhập", exact: true }).click();
  await reset.getByLabel("Email", { exact: true }).fill(email);
  await reset.getByLabel("Mật khẩu", { exact: true }).fill(initialPassword);
  await reset.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(reset.getByRole("alert")).toContainText("Email hoặc mật khẩu không đúng");
  await reset.getByLabel("Mật khẩu", { exact: true }).fill(nextPassword);
  await reset.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await reset.locator('summary[aria-label="Tài khoản"]').waitFor();
  assert.equal((await identity(reset)).id, account.id);
  results.push(
    "Linked-phone OTP, seven-character password confirmation and session revocation work through the UI",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    ".runtime/auth-verification-" + channel + ".json",
    JSON.stringify({ results, errors, finishedAt: new Date().toISOString() }, null, 2),
  );
  console.log(JSON.stringify({ authenticationChecks: results.length, errors }));
} finally {
  await context.close();
  await browser.close();
}
