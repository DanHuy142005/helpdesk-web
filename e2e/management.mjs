import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const accounts = JSON.parse(await readFile(".runtime/demo-accounts.json", "utf8"));
const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext(),
  page = await context.newPage();
const errors = [],
  results = [];
const suffix = Date.now().toString(36).toUpperCase();
page.on("pageerror", (e) => errors.push(e.message));
async function login(email) {
  const a = accounts.find((a) => a.email === email);
  await page.goto(origin + "/");
  await page.getByLabel("Email", { exact: true }).fill(a.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL("**/admin");
  await page.locator('summary[aria-label="Tài khoản"]').waitFor();
}
async function save() {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lưu thông tin", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
async function close() {
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
}
try {
  await login("admin@nexdesk.local");
  await page.goto(origin + "/admin/departments");
  await page.getByRole("button", { name: "Thêm phòng ban", exact: true }).click();
  await page.getByLabel("Mã phòng ban", { exact: true }).fill("QA-" + suffix);
  await page.getByLabel("Tên phòng ban", { exact: true }).fill("Bộ phận QA " + suffix);
  await save();
  await page.getByRole("heading", { name: "Bộ phận QA " + suffix, exact: true }).waitFor();
  results.push("Department create");
  await page.goto(origin + "/admin/employees");
  await page.getByRole("button", { name: "Thêm nhân viên", exact: true }).click();
  await page.getByLabel("Mã nhân viên", { exact: true }).fill("NV-" + suffix);
  await page.getByLabel("Họ tên", { exact: true }).fill("Nhân viên QA " + suffix);
  await page
    .getByLabel("Email", { exact: true })
    .fill("qa-" + suffix.toLowerCase() + "@nexdesk.local");
  await page.getByLabel("Vai trò", { exact: true }).selectOption("end-user");
  await page.getByLabel("Phòng ban", { exact: true }).selectOption("QA-" + suffix);
  await page.getByLabel("Chức vụ", { exact: true }).fill("Nhân viên kiểm thử");
  await page
    .getByLabel("Mật khẩu (ít nhất 7 ký tự)", { exact: true })
    .fill(randomBytes(20).toString("hex"));
  await save();
  results.push("Employee create");
  await page.goto(origin + "/admin/assets");
  await page.getByRole("button", { name: "Thêm tài sản", exact: true }).click();
  await page.getByLabel("Mã tài sản", { exact: true }).fill("AS-" + suffix);
  await page.getByLabel("Tên tài sản", { exact: true }).fill("Laptop QA " + suffix);
  await page.getByLabel("Vị trí", { exact: true }).fill("Phòng QA");
  await save();
  await page
    .getByRole("row")
    .filter({ hasText: "AS-" + suffix })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Người nhận", { exact: true })
    .selectOption({ label: "Trần Thu Hà · NV-004" });
  await dialog
    .getByLabel("Lý do cấp phát", { exact: true })
    .fill("Cấp phát kiểm thử từ trình duyệt");
  await dialog.getByLabel("Tình trạng bàn giao", { exact: true }).fill("Tốt");
  await dialog.getByRole("button", { name: "Lưu cấp phát", exact: true }).click();
  await dialog.getByText("Người đang giữ: Trần Thu Hà", { exact: true }).waitFor();
  await dialog.getByLabel("Thao tác tài sản", { exact: true }).selectOption("transfer");
  await dialog
    .getByLabel("Người nhận", { exact: true })
    .selectOption({ label: "Trần Quốc Bảo · NV-006" });
  await dialog.getByRole("button", { name: "Lưu cấp phát", exact: true }).click();
  await dialog.getByText("Người đang giữ: Trần Quốc Bảo", { exact: true }).waitFor();
  await dialog.getByLabel("Thao tác tài sản", { exact: true }).selectOption("return");
  await dialog.getByRole("button", { name: "Lưu cấp phát", exact: true }).click();
  await dialog.getByText("Người đang giữ: Trong kho", { exact: true }).waitFor();
  await close();
  results.push("Asset create, assign, transfer, return");
  await page.goto(origin + "/admin/software");
  await page.getByRole("button", { name: "Thêm phần mềm", exact: true }).click();
  await page.getByLabel("Tên phần mềm", { exact: true }).fill("Software QA " + suffix);
  await page.getByLabel("Nhà cung cấp", { exact: true }).fill("QA");
  await page.getByLabel("Phiên bản", { exact: true }).fill("1.0");
  await page.getByLabel("Số license", { exact: true }).fill("1");
  await save();
  await page
    .getByRole("row")
    .filter({ hasText: "Software QA " + suffix })
    .click();
  await dialog.getByLabel("Thiết bị nhận license", { exact: true }).selectOption("AS-" + suffix);
  await dialog.getByRole("button", { name: "Lưu license", exact: true }).click();
  await dialog.getByText("Cấp / thu hồi license · 1/1", { exact: true }).waitFor();
  await dialog.getByLabel("Thao tác license", { exact: true }).selectOption("remove");
  await dialog.getByRole("button", { name: "Lưu license", exact: true }).click();
  await dialog.getByText("Cấp / thu hồi license · 0/1", { exact: true }).waitFor();
  await close();
  results.push("Software create, license allocation/revocation");
  await page.goto(origin + "/admin/documents");
  await page.getByRole("button", { name: "Tải lên", exact: true }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("Tài liệu QA " + suffix);
  await page.getByLabel("Danh mục", { exact: true }).fill("Hướng dẫn");
  await page
    .getByLabel("Nội dung", { exact: true })
    .fill("Nội dung tài liệu kỹ thuật để kiểm thử công bố và đính kèm.");
  await page.getByLabel("Công bố cho người đọc", { exact: true }).check();
  await page.getByLabel("Tệp đính kèm (tùy chọn, tối đa 5 MB)", { exact: true }).setInputFiles({
    name: "qa.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Test document attachment"),
  });
  await save();
  await page
    .getByRole("button")
    .filter({ hasText: "Tài liệu QA " + suffix })
    .click();
  await dialog.getByRole("link", { name: /qa.txt/ }).waitFor();
  await close();
  results.push("Document upload and publication");
  await page.goto(origin + "/admin/reports");
  await page.getByRole("button", { name: "Kỳ báo cáo", exact: true }).click();
  await dialog.getByLabel("Từ ngày", { exact: true }).fill("2020-01-01");
  await dialog.getByLabel("Đến ngày", { exact: true }).fill("2030-12-31");
  await dialog.getByRole("button", { name: "Áp dụng", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất báo cáo", exact: true }).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), "nexdesk-report.csv");
  results.push("Date range and CSV export");
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Lịch sử thao tác", exact: true }).click();
  await dialog.getByText("Nguyễn Hoàng Long", { exact: true }).first().waitFor();
  await close();
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).waitFor();
  results.push("Audit viewer and logout");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    ".runtime/management-verification.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, errors }));
} finally {
  await context.close();
  await browser.close();
}
