# IT Helpdesk — Cài đặt và vận hành localhost

Hệ thống đã được tích hợp trực tiếp vào source hiện tại theo yêu cầu trong
`Bao_cao_IT_Helpdesk_ok.docx`. Giao diện Premium SaaS, CSS và bốn portal được
giữ lại; các trang sử dụng chung API Express và PostgreSQL.

## 1. Chạy nhanh trên Windows bằng VS Code

1. Mở **toàn bộ thư mục dự án** bằng VS Code → File → Open Folder.
2. Mở Terminal → New Terminal, chạy `./run.bat` hoặc nhấp đúp `run.bat`.
3. Lần đầu cần Internet để tải Node.js 24 portable và dependencies.
4. Bộ chạy tự khởi tạo PostgreSQL thật trong `.runtime/postgres`, áp dụng
   migration và seed khi database chưa có người dùng. Các lần chạy tiếp theo
   giữ nguyên dữ liệu.
5. Mở địa chỉ Local do Vite in ra, mặc định `http://127.0.0.1:5173`.
6. Xem tài khoản demo bằng `Get-Content .runtime/demo-accounts.json` trong
   terminal của bạn. Mật khẩu được sinh ngẫu nhiên khi seed, không đưa vào Git.

| Email demo                | Vai trò            | Portal      |
| ------------------------- | ------------------ | ----------- |
| admin@nexdesk.local       | Admin              | /admin      |
| helpdesk@nexdesk.local    | Helpdesk           | /helpdesk   |
| technician@nexdesk.local  | Technician         | /technician |
| user@nexdesk.local        | End User           | /end-user   |
| technician2@nexdesk.local | Technician bổ sung | /technician |
| user2@nexdesk.local       | End User bổ sung   | /end-user   |

Đăng nhập sẽ đưa người dùng đến cổng đúng vai trò. Truy cập URL của cổng khác
bị chặn. Đăng xuất/đổi mật khẩu ở menu **⋯** cạnh tên tài khoản. Đổi mật khẩu
sẽ thu hồi các phiên đăng nhập đang tồn tại.

Giữ terminal chạy khi sử dụng. **Ctrl+C** dừng bộ chạy. Không xóa `.runtime`
khi cần giữ database hoặc tài khoản demo. Dữ liệu PostgreSQL và file đính kèm
không nằm trong Git; hãy sao lưu trước khi di chuyển hoặc cài lại môi trường.
Không dùng lại bộ cấu hình cũ trong `golden sample` để ghi đè bản full-stack.

Nếu đã cài Node.js 24:

```powershell
npm ci
npm run dev
```

`npm run dev` chạy database, API và frontend cùng nhau. Tùy chọn:

```powershell
.\run.bat -Port 5174 -NoBrowser
npm run dev -- --port 5174
```

Cổng frontend mặc định 5173, API 3001, PostgreSQL portable 55432. Bộ chạy chọn
cổng web/API trống tiếp theo nếu cần. Khi đặt `API_PORT` trong `.env`, cổng API
được giữ cố định. PostgreSQL chỉ lắng nghe trên loopback và dùng xác thực SCRAM.
PostgreSQL portable mặc định hỗ trợ Windows x64; trên Windows ARM64 hãy dùng
PostgreSQL cài riêng và cấu hình `DATABASE_URL`.

## 2. Dùng PostgreSQL cài riêng hoặc Docker

Phương án này thay thế PostgreSQL portable. Không cần thực hiện nếu dùng mục 1.

Với PostgreSQL đã cài, mở pgAdmin/psql bằng tài khoản quản trị và tạo một role
riêng có quyền sở hữu database `nexdesk`, không cấp quyền superuser cho ứng dụng:

```sql
CREATE ROLE nexdesk_app LOGIN PASSWORD 'THAY_BANG_MAT_KHAU_RIENG';
CREATE DATABASE nexdesk OWNER nexdesk_app;
```

Sao chép `.env.example` thành `.env`, đặt `DATABASE_URL` với mật khẩu vừa tạo:

```dotenv
DATABASE_URL=postgresql://nexdesk_app:MAT_KHAU_DA_URL_ENCODE@127.0.0.1:5432/nexdesk
API_PORT=3001
APP_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
```

Nếu dùng Docker Desktop, đặt thêm `POSTGRES_PASSWORD` (mật khẩu quản trị
PostgreSQL) trong `.env` rồi chạy `docker compose up -d`. Mở
`docker compose exec postgres psql -U postgres`, chạy hai câu SQL tạo role và
database ở trên. `DATABASE_URL` dùng mật khẩu riêng của role `nexdesk_app`;
không kết nối ứng dụng bằng role quản trị `postgres`. Sau đó:

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Seed chỉ thêm dữ liệu vào database chưa có người dùng. Lệnh không reset, không
ghi đè mật khẩu và không xóa dữ liệu đang có. Tài khoản demo được lưu tại
`.runtime/demo-accounts.json`. Không chạy seed demo trên database nghiệp vụ thật.

Có thể chạy tách terminal khi cần debug:

```powershell
# Terminal 1, nếu dùng PostgreSQL portable
npm run db:local

# Terminal 2, dùng DATABASE_URL đã cấu hình trong .env
npm run dev:api

# Terminal 3
npm run dev:frontend
```

`dev:api` yêu cầu `DATABASE_URL`. Với portable, dùng `npm run dev` là cách đơn
giản hơn vì tự truyền kết nối mà không cần chép mật khẩu database vào terminal.

## 3. Luồng Ticket

1. **End User** vào Tạo yêu cầu: nhập tiêu đề, mô tả, loại, mức ảnh hưởng;
   liên kết thiết bị được cấp nếu có; có thể đính kèm tệp. API tạo mã duy nhất.
2. **Helpdesk** vào Tiếp nhận Ticket → Nhận. Chỉ một người nhận thành công khi
   nhiều yêu cầu đến đồng thời. Có thể chỉnh phân loại/mức ưu tiên/thiết bị.
3. Helpdesk tự xử lý trong Xử lý sự cố: gửi phản hồi, ghi chú nội bộ ở chi tiết,
   đính kèm và ghi kết quả. Hoặc vào Chuyển Technician, chọn người nhận đang
   hoạt động và ghi lý do/các bước đã thử.
4. **Technician** vào Công việc được giao → Bắt đầu; cập nhật ghi chú, chờ phản
   hồi/tiếp tục, ghi giải pháp và kết quả. Chỉ xem/xử lý Ticket được giao.
5. **End User** mở Ticket của tôi hoặc Theo dõi trạng thái → Chi tiết. Khi
   trạng thái là Đã giải quyết, chọn Xác nhận đóng hoặc nhập lý do và chọn
   Yêu cầu xử lý tiếp. Không có chức năng tự đóng thay người gửi.
6. Ticket đã đóng được đánh giá tại Phản hồi & đánh giá. Mỗi Ticket có một
   đánh giá. Ticket đã đóng không nhận thêm bình luận/tệp.

Mới → Đang xử lý → [Đã chuyển → Đang xử lý] → Đã giải quyết → Đã đóng.
Đã giải quyết có thể quay lại Đang xử lý khi requester báo chưa đạt.
Đang xử lý có thể chuyển Chờ phản hồi và tiếp tục trở lại.

Mỗi chuyển trạng thái kiểm tra phiên, vai trò, người phụ trách và phiên bản
bản ghi. Cập nhật Ticket, sự kiện và audit được commit trong cùng transaction.
Khi có xung đột, API trả 409 và giao diện tải lại dữ liệu. Checklist hướng dẫn
trên màn hình tuyến 1 là bản nháp thao tác; lưu nội dung thực tế vào phản hồi
hoặc kết quả để ghi lịch sử.

## 4. Quản trị và dữ liệu liên thông

- **Nhân viên:** thêm bằng nút đầu trang, nhấp hàng để sửa thông tin, vai trò,
  đặt mật khẩu mới hoặc khóa tài khoản. Khóa/đổi vai trò thu hồi phiên đăng nhập.
  Không tự khóa hoặc tự bỏ quyền Admin. Người còn Ticket đang phụ trách cần
  được người gửi xác nhận đóng trước khi bị khóa/đổi vai trò.
- **Phòng ban:** thêm, nhấp thẻ để sửa/xóa; số nhân viên, tài sản và Ticket được
  tính từ quan hệ thực tế. Chỉ xóa khi không còn dữ liệu tham chiếu.
- **Tài sản:** thêm/sửa serial, loại, vị trí, bảo hành, cấu hình, tình trạng.
  Nhấp hàng để cấp phát, thu hồi, điều chuyển và xem lịch sử. Một thiết bị chỉ
  có một cấp phát hiệu lực; điều chuyển kết thúc cấp phát cũ trong transaction.
  Thiết bị đang bảo trì/thanh lý không được cấp phát.
- **Phần mềm/license:** quản lý phiên bản, nhà cung cấp, hạn dùng, số license;
  nhấp hàng để cấp/thu hồi cho thiết bị. Không cấp vượt số chỗ hoặc license hết
  hạn; không giảm số chỗ thấp hơn số đang cấp.
- **Tài liệu:** Admin soạn hoặc tải tệp kèm nội dung, chỉnh sửa và công bố;
  chọn phạm vi toàn công ty hoặc nội bộ CNTT. Helpdesk/Technician soạn bản nháp
  trong menu tài khoản; Admin duyệt công bố. End User chỉ đọc bài đã công bố
  cho toàn công ty. Văn bản được hiển thị an toàn, không thực thi HTML nhập vào.
- **Tìm kiếm:** ô tìm kiếm ở topbar + Enter tìm trong dữ liệu được phép; các
  bảng có tìm kiếm/phân trang thật. Trang Ticket Admin có bộ lọc ưu tiên,
  người xử lý và khoảng ngày.
- **Báo cáo:** chọn kỳ, xem biểu đồ và tải CSV; số liệu tính từ database, không
  dùng KPI mẫu. SLA hiện tại là thời hạn **phản hồi đầu tiên** theo mức ưu tiên
  (15/30/120/1440 phút, thời gian lịch, không loại ngày nghỉ).
- **Lịch sử/thông báo:** menu tài khoản Admin có audit; biểu tượng chuông xem
  thông báo, biểu tượng lịch liệt kê Ticket đang mở theo hạn SLA. Giao diện tự
  làm mới mỗi 3 giây và làm mới ngay sau thay đổi, không cần mở lại portal.

Tệp nhận PNG/JPEG/PDF/TXT tối đa **5 MB**, được kiểm tra định dạng và quyền tải.
Tệp lưu dạng `bytea` trong PostgreSQL, được bao gồm trong bản sao lưu ứng dụng.
Ghi chú nội bộ được lọc tại API, không đưa xuống trình duyệt End User.

## 5. Sao lưu và khôi phục

Đặt `BACKUP_PASSPHRASE` riêng ít nhất 16 ký tự trong `.env` hoặc biến môi trường.
Ghi nhớ mật khẩu này ở nơi an toàn; không có cơ chế giải mã khi mất mật khẩu.

```powershell
npm run db:backup
# Hoặc chỉ định đường dẫn file
npm run db:backup -- .runtime/backups/nexdesk.json
```

Backup dùng snapshot nhất quán và mã hóa AES-256-GCM với khóa dẫn xuất bằng
scrypt. Bao gồm users, Ticket, tài sản, cấp phát, phần mềm/license, tài liệu,
tệp, lịch sử và thông báo; không sao lưu phiên đăng nhập. Sao chép file backup
ra nơi lưu trữ khác để tránh mất cùng máy.

Để khôi phục, tạo **database rỗng mới**, đặt `DATABASE_URL` trỏ đến database đó,
giữ đúng `BACKUP_PASSPHRASE`, rồi chạy:

```powershell
npm run db:migrate
npm run db:restore -- DUONG_DAN_FILE_BACKUP.json
npm run dev
```

Restore sẽ từ chối database đã có dữ liệu. Toàn bộ restore nằm trong một
transaction, khôi phục cả binary attachments và sequence mã Ticket. Với hệ
thống lớn hơn, có thể dùng công cụ PostgreSQL `pg_dump`/`pg_restore` do quản trị
database vận hành thay cho backup cấp ứng dụng.

## 6. Kiểm tra trên máy phát triển

```powershell
npm run typecheck
npm test
npm run test:api
npm run build

# Chạy khi npm run dev đang mở, mặc định dùng Microsoft Edge đã cài trên Windows
npm run test:e2e
node e2e/management.mjs

# Kiểm tra luồng chính trên Google Chrome đã cài
$env:E2E_BROWSER = 'chrome'
npm run test:e2e
Remove-Item Env:E2E_BROWSER
```

`test:api` dùng schema `test_<random>` riêng, không xóa dữ liệu ứng dụng; cuối
lượt xóa schema thử nghiệm. Có thể đặt `TEST_DATABASE_URL` để dùng database
kiểm thử riêng. E2E dùng tài khoản demo trong `.runtime/demo-accounts.json` và
tạo các bản ghi có tiền tố E2E/QA để lưu bằng chứng thao tác thực tế.

Ảnh kiểm tra bốn portal: `.runtime/screenshots/`. Kết quả trình duyệt:
`.runtime/browser-verification.json`, `.runtime/management-verification.json`.
Đây là kiểm thử phát triển nội bộ; không thay thế UAT tại doanh nghiệp.

## 7. Cấu trúc source và API

| Vị trí                  | Vai trò                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `backend/app.mjs`       | Express, xác thực, CSRF, báo cáo, xử lý lỗi                |
| `backend/tickets.mjs`   | Vòng đời Ticket, bình luận, đánh giá                       |
| `backend/resources.mjs` | CRUD, cấp phát, license, tài liệu/tệp                      |
| `backend/workspace.mjs` | Truy vấn dữ liệu đúng phạm vi quyền                        |
| `backend/db/`           | SQL migration local, độc lập schema cloud Lovable          |
| `backend/security.mjs`  | scrypt, phiên, quyền theo bản ghi, audit                   |
| `src/shared/api/`       | Client API, auth gate, dữ liệu biểu đồ và dialog nghiệp vụ |
| `src/portals/<portal>/` | Giao diện riêng từng vai trò                               |
| `scripts/dev.mjs`       | Điều phối frontend/API/PostgreSQL localhost                |

API chính: `/api/auth/login`, `/me`, `/logout`, `/password` (các đường sau nằm
dưới `/api/auth`); `/api/workspace`; `/api/tickets`, `/:id`, `/:id/actions`,
`/:id/comments`, `/:id/feedback`; `/api/users`, `/departments`, `/assets`,
`/software`, `/documents` (đều dưới `/api`); `/api/assets/:id/assignments`,
`/api/assets/:id/history`, `/api/software/:id/installations`,
`/api/:entity/:id/attachments`, `/api/attachments/:id`, `/api/reports`.

Mã lỗi: 400 dữ liệu không hợp lệ; 401 chưa đăng nhập/hết phiên; 403 thiếu quyền
hoặc CSRF/origin không hợp lệ; 404 không tìm thấy trong phạm vi được phép;
409 xung đột phiên bản/quan hệ/trạng thái; 413 tệp quá lớn.

Backend chỉ lắng nghe localhost. Phiên dùng cookie HttpOnly/SameSite Strict,
token được băm trong database; mật khẩu dùng scrypt có salt. Không lưu token
đăng nhập trong localStorage. Nếu triển khai ngoài localhost cần thiết lập
reverse proxy HTTPS, `NODE_ENV=production`, `APP_ORIGIN`, PostgreSQL riêng và
giám sát/backup phù hợp. Bản build frontend không tự chứa tiến trình Express.

## 8. Đối chiếu báo cáo Word

| Yêu cầu trong báo cáo  | Phần thực hiện                                           |
| ---------------------- | -------------------------------------------------------- |
| FR-01–04, NFR-01/02    | Login/logout, tài khoản, API RBAC, audit                 |
| FR-05–10, BR-01–05/08  | Ticket, chuyển giao có lý do, kết quả, xác nhận/mở lại   |
| FR-11/12/20            | Giám sát, tìm/lọc, báo cáo và CSV                        |
| FR-13–16, BR-06/07     | Asset, cấp phát duy nhất, lịch sử và liên kết Ticket     |
| FR-17                  | Phần mềm, phiên bản, license và thiết bị sử dụng         |
| FR-18/19, BR-11        | Bản nháp, quyền công bố và phạm vi đọc                   |
| FR-21, NFR-03          | Upload và download theo quyền, kiểm kích thước/định dạng |
| NFR-04/05, TC-04/08/10 | Transaction, audit, cạnh tranh đồng thời, backup/restore |

Theo báo cáo, hệ thống không tự cấp quyền trên ERP/AD, không tự cài phần mềm
đến máy trạm và không tự kiểm kê mạng. Các yêu cầu đó được ghi nhận thành
Ticket để nhân viên IT thực hiện. Seed, file tài liệu gốc và backup nguồn được
giữ riêng; không nhận số liệu demo là kết quả vận hành tại doanh nghiệp.
