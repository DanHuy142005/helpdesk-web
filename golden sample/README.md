# Golden sample — Bộ mẫu chạy web Lovable trên Windows

Thư mục này lưu bản sao 5 file cấu hình và khởi động của dự án Helpdesk Harmony, để tham khảo, lưu trữ hoặc chép lại khi cần.

Đây là **bộ mẫu khởi động**, chưa gồm mã nguồn website trong `src/`, tài nguyên và các cấu hình khác của dự án. Muốn chạy web cần dùng cùng toàn bộ mã nguồn dự án.

## Cấu trúc

```text
golden sample/
├── README.md
├── run.bat
├── scripts/
│   └── run-local.ps1
├── package.json
├── package-lock.json
└── vite.config.ts
```

## Hướng dẫn từng file

### 1. `run.bat` — File nhấp đúp để chạy

- Gọi `scripts/run-local.ps1` bằng Windows PowerShell.
- Tự tìm script theo vị trí của chính file `.bat`, nên không cần mở terminal đúng thư mục trước.
- Giữ cửa sổ hiển thị lỗi nếu khởi động thất bại.

**Cách đặt:** ở thư mục gốc dự án, cùng cấp với `package.json`. Giữ script PowerShell trong thư mục con `scripts` như cấu trúc trên.

**Cách dùng:** nhấp đúp `run.bat`. Khi web sẵn sàng, trình duyệt tự mở. Giữ cửa sổ terminal mở khi sử dụng; nhấn **Ctrl+C** để dừng.

### 2. `scripts/run-local.ps1` — Tự thiết lập môi trường và chạy web

Script này thực hiện các việc chính:

1. Kiểm tra file dự án và kiến trúc Windows x64/ARM64.
2. Tải Node.js 24 portable từ `nodejs.org` nếu chưa có, kiểm tra SHA256 và giải nén vào `.runtime`.
3. Dùng Node.js/npm portable, không yêu cầu cài Node.js hệ thống hoặc quyền Administrator.
4. Chạy `npm ci` để cài dependencies theo `package-lock.json` khi cần; thử lại nếu cài đặt thất bại.
5. Dùng lại môi trường đã tải ở các lần sau. Cài lại thư viện khi đổi máy, đổi đường dẫn dự án, đổi phiên bản Node.js hoặc đổi file khai báo dependencies.
6. Khởi động Vite tại `127.0.0.1`, mặc định cổng 5173; tự chọn cổng khác nếu cổng này bận.

**Cách đặt:** `scripts/run-local.ps1` bên trong thư mục gốc dự án. Nên chạy qua `run.bat` để có thông báo lỗi dễ đọc.

**Tùy chọn khi chạy từ PowerShell tại thư mục gốc dự án:**

```powershell
# Chạy bình thường, tự mở trình duyệt
.\run.bat

# Chọn cổng khởi đầu khác
.\run.bat -Port 5174

# Chạy web nhưng không tự mở trình duyệt
.\run.bat -NoBrowser
```

### 3. `package.json` — Khai báo thư viện và lệnh của dự án

- `dependencies`: các thư viện ứng dụng sử dụng, như React và TanStack.
- `devDependencies`: công cụ chạy và phát triển, như Vite, TypeScript và cấu hình Lovable.
- `scripts`: các lệnh như `dev`, `build`, `test` và `lint`.
- `overrides`: phiên bản ghi đè cho dependency cụ thể.

**Cách dùng:** đặt ở gốc dự án và dùng cùng `package-lock.json` tương ứng. Nếu thay đổi danh sách thư viện, cần cập nhật lockfile bằng npm trong môi trường Node.js.

### 4. `package-lock.json` — Cố định phiên bản dependencies

- Lưu phiên bản cụ thể của thư viện và các dependency con, địa chỉ tải và thông tin kiểm tra toàn vẹn.
- Giúp `npm ci` cài cùng bộ phiên bản trên các máy.
- Do npm tạo và cập nhật; không nên sửa thủ công.

**Cách dùng:** luôn đi cùng `package.json` tương ứng. Nếu hai file không khớp, `npm ci` sẽ báo lỗi và cần cập nhật lại lockfile.

### 5. `vite.config.ts` — Cấu hình chạy và build website

- Dùng cấu hình nền từ `@lovable.dev/vite-tanstack-config` cho dự án React/TanStack Start hiện tại.
- Khai báo server entry `src/server.ts` thông qua tùy chọn `server: { entry: "server" }`.
- Cấu hình Lovable đã tích hợp các plugin cần thiết như React, Tailwind CSS và TanStack Start; đọc các chú thích trong file trước khi bổ sung plugin.

**Cách dùng:** đặt ở gốc dự án. File này phụ thuộc vào mã nguồn và dependencies của dự án Helpdesk Harmony; cần kiểm tra sự tương thích trước khi dùng cho dự án khác.

## Chạy dự án hiện tại

Nhấp đúp [run.bat ở thư mục gốc dự án](../run.bat). Các file gốc vẫn là bộ file mà dự án đang sử dụng.

Không chạy bản `run.bat` trong `golden sample` để mở website ngay: thư mục mẫu này không chứa toàn bộ mã nguồn website.

## Chép bộ mẫu vào một bản dự án Helpdesk Harmony đầy đủ

1. Giải nén toàn bộ mã nguồn website vào thư mục có quyền ghi.
2. Nếu thư mục đó đã có các file tương ứng, lưu bản sao trước khi thay thế.
3. Chép `run.bat`, `package.json`, `package-lock.json` và `vite.config.ts` từ đây vào gốc dự án đích.
4. Chép `scripts/run-local.ps1` vào thư mục `scripts` của dự án đích.
5. Nhấp đúp `run.bat` tại gốc dự án đích.

Nếu áp dụng cho một dự án Lovable khác, giữ `package.json`, `package-lock.json` và cấu hình Vite phù hợp với dự án đó. Không dùng bộ khai báo dependencies của Helpdesk Harmony thay cho một dự án có thư viện hoặc cấu trúc khác. Script mẫu hiện tại dành cho ứng dụng Vite tương thích Node.js 24 và yêu cầu `vite.config.ts`.

## Điều kiện và thư mục tự sinh

- Windows 10/11 bản 64-bit (Intel/AMD hoặc ARM64), có Windows PowerShell 5.1.
- Có Internet trong lần thiết lập đầu hoặc khi cần tải lại Node.js/thư viện.
- Giải nén toàn bộ dự án trước khi chạy; không chạy trực tiếp bên trong file ZIP.
- `.runtime/`: Node.js portable và thông tin môi trường đã thiết lập.
- `node_modules/`: các dependencies được npm cài đặt.

Khi gửi toàn bộ dự án sang máy khác, có thể bỏ `.runtime` và `node_modules` để giảm dung lượng; script sẽ tạo lại khi chạy.

Nếu cài thư viện báo file đang bận, đóng các cửa sổ web/terminal đang chạy dự án rồi thử lại. Nếu tải file thất bại, kiểm tra kết nối tới `nodejs.org` và `registry.npmjs.org`.

Các file trong `golden sample` là bản sao tại thời điểm tạo, không tự đồng bộ khi file gốc thay đổi. Khi cập nhật bộ mẫu, chép lại các file tương ứng; giữ `package.json` và `package-lock.json` đồng bộ với nhau.
