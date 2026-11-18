# IT Helpdesk — Cài đặt và vận hành localhost

Hệ thống đã được tích hợp trực tiếp vào source hiện tại theo yêu cầu trong
`Helpdesk đổi nghiệp vụ.docx` (bản cập nhật ngày 18/11/2026). Giao diện Premium SaaS và bốn portal được
giữ lại; các trang sử dụng chung API Express và PostgreSQL.
Giao diện thao tác Ticket được cập nhật tiếp theo `doc/cần sửa .docx` ngày 18/11/2026.
Quên mật khẩu OTP, phân loại theo quyết định Admin và SLA/tự đóng đã cập nhật
theo yêu cầu tiếp theo. Nếu ứng dụng đang chạy từ trước lần cập nhật, dừng
terminal bằng **Ctrl+C** và chạy lại `run.bat` để nạp API mới; không xóa database.

## 1. Chạy nhanh trên Windows bằng VS Code

1. Mở **toàn bộ thư mục dự án** bằng VS Code → File → Open Folder.
2. Mở Terminal → New Terminal, chạy `./run.bat` hoặc nhấp đúp `run.bat`.
3. Lần đầu cần Internet để tải Node.js 24 portable và dependencies.
4. Bộ chạy tự khởi tạo PostgreSQL thật trong `.runtime/postgres`, áp dụng
   migration và seed khi database chưa có người dùng. Các lần chạy tiếp theo
   giữ nguyên dữ liệu.
5. Mở địa chỉ Local do Vite in ra, mặc định `http://127.0.0.1:5173`.
6. Xem tài khoản khởi tạo bằng `Get-Content .runtime/demo-accounts.json` trong
   terminal của bạn. Mật khẩu được sinh ngẫu nhiên khi seed, không đưa vào Git.

| Email khởi tạo            | Vai trò            | Portal      |
| ------------------------- | ------------------ | ----------- |
| admin@nexdesk.local       | Admin              | /admin      |
| helpdesk@nexdesk.local    | Helpdesk           | /helpdesk   |
| technician@nexdesk.local  | Technician         | /technician |
| user@nexdesk.local        | End User           | /end-user   |
| technician2@nexdesk.local | Technician bổ sung | /technician |
| user2@nexdesk.local       | End User bổ sung   | /end-user   |

Địa chỉ gốc `/` mở trực tiếp trang đăng nhập, không còn màn chọn bốn cổng.
Đăng nhập sẽ đưa người dùng đến trang đúng vai trò. Tab đã đăng nhập khi trở
về `/` sẽ tự mở lại trang của tài khoản đó. Truy cập URL của vai trò khác bị chặn.

**Nhiều tab:** mở cùng địa chỉ gốc ở các tab trong cùng trình duyệt và đăng
nhập tài khoản riêng cho từng tab. Các tab giữ phiên độc lập; đăng nhập/đăng
xuất một tab không đổi tài khoản ở tab khác. Tải lại tab giữ phiên hiện tại.
Tab mở từ một tab đã đăng nhập vẫn xác minh tài khoản riêng trước khi truy cập.

**Quên mật khẩu:** tại trang đăng nhập chọn **Quên mật khẩu?** → nhập số điện
thoại đã liên kết → **Yêu cầu mã OTP** → nhập OTP → **Xác minh OTP** → nhập mật
khẩu mới và nhập lại → **Lưu mật khẩu mới**. Mật khẩu tối thiểu **7 ký tự**,
khác mật khẩu cũ; hai lần nhập phải khớp. Không cần nhập lại mật khẩu cũ.
Mã OTP tạm thời cố định **123456** theo yêu cầu. Mã và phiên đặt lại đều có
hiệu lực 5 phút, chỉ dùng một lần; tối đa 5 lần nhập sai cho mỗi mã. Yêu cầu
mã mới cách nhau ít nhất 60 giây. Đổi mật khẩu thu hồi mọi phiên của tài khoản.

Admin vào **Nhân viên** → nhấp nhân viên → điền **Số điện thoại liên kết** → lưu.
Số Việt Nam dạng `09...` được chuẩn hóa thành `+849...`; mỗi số chỉ gắn với
một tài khoản. Tài khoản cũ chưa có số cần được Admin bổ sung; hệ thống không
tự tạo số điện thoại. Nếu mất số hoặc chưa liên kết, liên hệ Admin.
Form nhận số có khoảng trắng/gạch ngang và chuẩn hóa +84 (0) về +84.
Nếu không lưu được, xem khung lỗi ngay trong form: khung này ghi rõ tên ô
bị sai; số điện thoại trùng được thông báo riêng. Ví dụ số hợp lệ: `0901234567`.

**SMS:** khi chưa cấu hình dịch vụ, hệ thống chỉ xác minh OTP cố định, không
gửi SMS thật. Có thể cấu hình `SMS_WEBHOOK_URL` và `SMS_API_KEY` ở máy chủ.
Gateway nhận POST JSON `{phone,message}` và trả HTTP 2xx khi đã tiếp nhận.
Chỉ khi gateway tiếp nhận thành công, giao diện mới thông báo gửi mã. Không
đưa khóa SMS vào frontend hoặc Git. Đây là adapter để tích hợp nhà cung cấp;
chưa có thông tin dịch vụ SMS của doanh nghiệp trong source hiện tại.

Đăng xuất/đổi mật khẩu ở menu **⋯** cạnh tên tài khoản. Đổi hoặc đặt lại mật
khẩu thu hồi các phiên của chính tài khoản đó; các tài khoản khác vẫn hoạt động.

Giữ terminal chạy khi sử dụng. **Ctrl+C** dừng bộ chạy. Không xóa `.runtime`
khi cần giữ database hoặc tài khoản khởi tạo. Dữ liệu PostgreSQL và file đính kèm
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

1. **End User** vào Tạo yêu cầu: nhập tiêu đề, mô tả, loại và mức ảnh hưởng.
   Ngay dưới mô tả có vùng kéo thả và nút **Đính kèm tệp**. Chọn/kéo nhiều ảnh
   để xem trước; có thể bỏ từng ảnh trước khi gửi. Tối đa 10 tệp mỗi lần,
   PNG/JPG/PDF/TXT, 5 MB mỗi tệp. Ticket và tệp được lưu trong một giao dịch;
   nếu tệp không hợp lệ thì không tạo Ticket thiếu ảnh. Sau khi gửi có thông
   báo giữa màn hình, chọn **Đã hiểu** để tiếp tục.
2. **Admin** vào Quản lý Ticket → Chờ phân công → mở Ticket → chọn đủ **Mức ưu tiên**,
   **Loại yêu cầu**, **Thiết bị liên quan** (hoặc chọn rõ **Không liên quan thiết bị**)
   → chọn **Người xử lý**
   là Helpdesk hoặc Technician đang hoạt động → **Xác nhận phân công**. Chỉ Admin
   được gán hoặc đổi người xử lý. Ticket chuyển từ Mới sang Đang xử lý; thông
   báo **Đã phân công** hiện giữa màn hình. Admin xem được ảnh ngay trong chi tiết.
3. **Helpdesk/Technician** nhấn vào hàng Ticket để xem thông tin. Hai vai trò
   không được chỉnh mức ưu tiên, loại hoặc thiết bị, kể cả gọi API trực tiếp.
   Mức ưu tiên hiển thị theo quyết định của Admin.
   Ảnh đã gửi hiển thị trực tiếp, nhấn ảnh để mở lớn. Chi tiết không chứa chat,
   tải tệp hoặc lịch sử xử lý; các phần này chuyển sang **Xử lý sự cố** ở cả hai
   portal. Technician giữ ghi chú nội bộ; Helpdesk không có chức năng ghi chú.
   Không có thao tác tự nhận; chỉ Admin được phân công người xử lý.
4. **Technician** khi cần phối hợp chọn **Chuyển cho Helpdesk**, nhập lý do
   ít nhất 10 ký tự. Không chọn người nhận. Phân công hiện tại được bỏ, Ticket
   về Mới với nhãn Chờ Admin phân công Helpdesk. Admin vào tab **Trả về Helpdesk**,
   chọn một Helpdesk đang hoạt động và xác nhận. Người cũ mất quyền xem/xử lý.
   Sau khi chuyển có thông báo **Đã chuyển yêu cầu cho Admin** giữa màn hình.
5. **Giải quyết:** tại **Xử lý sự cố**, nút **Đã giải quyết xong** nằm cạnh
   **Gửi tin nhắn**. Nhấn nút, nhập kết quả thực tế và chọn **Có, đã giải quyết**
   trong hộp xác nhận. Ticket chuyển Đã giải quyết và chờ End User xác nhận.
6. **End User** vào **Ticket của tôi**: cột cuối là **Xác nhận hoàn thành**.
   Nút mờ khi chưa giải quyết, chỉ bật sau khi Helpdesk/Technician xác nhận xong.
   Nhấn nút và xác nhận để đóng Ticket. Chi tiết Ticket cho phép cập nhật ba
   mục phân loại đề xuất, giữ lịch sử trạng thái, không có chat, tải tệp hay ghi chú.
   Thay đổi đề xuất không ghi đè mức ưu tiên Admin đã duyệt cho người xử lý. Nếu chưa đạt, vào
   **Theo dõi trạng thái** → **Yêu cầu xử lý tiếp**, nhập vấn đề còn tồn tại.
7. Ticket đã đóng được đánh giá tại Phản hồi & đánh giá. Mỗi Ticket có một
   đánh giá. Ticket đã đóng không nhận thêm tin nhắn/tệp.
8. **Chat:** End User dùng trang **Theo dõi trạng thái** với sơ đồ tiến trình
   rộng và hội thoại lớn. Helpdesk/Technician dùng trang **Xử lý sự cố**.
   Nhập nội dung → **Gửi tin nhắn**. Hai phía cập nhật tự động khoảng
   3 giây, có người gửi và thời gian. Lịch sử giữ nguyên sau khi phân công lại.
   Admin quản lý phân công và lịch sử nghiệp vụ, không được đọc/gửi chat riêng.
   Ảnh và tệp có thể xem/tải thêm ở các trang này. Ghi chú nội bộ của Technician
   tách riêng, không xuất hiện trong chat của End User.
9. **SLA & tự đóng:** Admin mở menu **SLA & tự đóng**. Bốn nhóm gồm đang quá hạn,
   đã xử lý trễ hạn, chờ xác nhận và đã tự động đóng. Nhấp một Ticket để xem,
   phân loại lại hoặc điều phối. SLA tính từ lúc tạo theo mức ưu tiên Admin:
   Khẩn cấp 15 phút, Cao 30 phút, Trung bình 120 phút, Thấp 1440 phút; phân
   công lại không đặt lại mốc bắt đầu. Ticket chưa giải quyết quá hạn hiện
   cảnh báo đỏ tại portal Helpdesk/Technician và chi tiết; chuông thông báo
   gửi cho người đang xử lý và Admin một lần theo từng hạn/người phụ trách.
10. Trong cùng trang, bật **Tự động đóng khi End User chưa xác nhận**, chọn
   thời gian/đơn vị và lưu. Mặc định tắt, thời gian lưu sẵn 1440 phút. Cấu hình
   áp dụng cả Ticket đang chờ xác nhận. Đếm từ `resolved_at`; khi hết thời
   gian mà End User chưa xác nhận hoặc yêu cầu xử lý tiếp, hệ thống đóng,
   lưu người thực hiện là Hệ thống, audit và thông báo. Giao diện hiện thời
   điểm dự kiến tự đóng. Worker kiểm tra mỗi 15 giây khi API đang chạy;
   sau khi khởi động lại tiếp tục xử lý Ticket đến hạn. Ticket đã đóng tay
   hoặc đã yêu cầu xử lý tiếp không bị đóng lần nữa.

Mới → Admin phân công → Đang xử lý → Đã giải quyết → Đã đóng.
Đã giải quyết có thể quay lại Đang xử lý khi requester báo chưa đạt.
Đang xử lý có thể chuyển Chờ phản hồi; End User bổ sung thông tin qua chat
thì tự quay lại Đang xử lý. “Chờ phản hồi” tương ứng bước chờ thông tin;
“Đã giải quyết” tương ứng chờ người gửi xác nhận kết quả trong báo cáo Word.
Trả về hàng đợi không tạo trạng thái mới: dùng Mới + queue_role=helpdesk.

Lần khởi động tiếp theo tự chạy `backend/db/002-ticket-assignment-and-chat.sql`.
Migration giữ ticket/lịch sử, chuyển trao đổi công khai cũ sang `ticket_messages`
và giữ ghi chú nội bộ riêng. Ticket cũ ở Đã chuyển có người phụ trách chuyển
sang Đang xử lý. Không cần xóa database hoặc seed lại dữ liệu đang dùng.
Migration `003-demo-workflow-guide.sql` cập nhật bài hướng dẫn demo cũ nếu nội
dung vẫn nguyên bản; các bài người dùng đã chỉnh sửa được giữ nguyên.
Migration `005-otp-ticket-policy.sql` bổ sung số điện thoại, OTP, thông tin đề
xuất/quyết định Admin, chính sách tự đóng và dấu vết cảnh báo SLA; giữ nguyên
Ticket và dữ liệu nghiệp vụ. Không xóa database để nâng cấp.

Mỗi chuyển trạng thái kiểm tra phiên, vai trò, người phụ trách và phiên bản
bản ghi. Cập nhật Ticket, sự kiện và audit được commit trong cùng transaction.
Khi có xung đột, API trả 409 và giao diện tải lại dữ liệu. Kết quả giải quyết
là nội dung người xử lý nhập tại hộp xác nhận, không tự tạo kết quả mẫu.

## 4. Quản trị và dữ liệu liên thông

- **Nhân viên:** thêm bằng nút đầu trang, nhấp hàng để sửa thông tin, vai trò,
  đặt mật khẩu mới, số điện thoại liên kết hoặc khóa tài khoản. Khóa/đổi vai trò thu hồi phiên đăng nhập.
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
  dùng KPI mẫu. Báo cáo phản hồi đầu tiên giữ chỉ số hiện có; trang SLA mới
  theo dõi Ticket chưa giải quyết so với hạn xử lý. Các hạn tính theo thời gian
  lịch, không loại ngày nghỉ.
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

| Vị trí                  | Vai trò                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `backend/app.mjs`       | Express, origin, báo cáo và xử lý lỗi                             |
| `backend/auth.mjs`      | Đăng nhập theo tab, CSRF, mật khẩu và thu hồi phiên               |
| `backend/otp.mjs`       | OTP theo số điện thoại liên kết và adapter SMS                    |
| `backend/maintenance.mjs` | Tự đóng, cảnh báo SLA và chống chạy trùng worker               |
| `backend/ticket-policy.mjs` | API cấu hình tự đóng chỉ dành cho Admin                     |
| `backend/tickets.mjs`   | Admin phân công, Technician trả hàng đợi, chat, kết quả, đánh giá |
| `backend/resources.mjs` | CRUD, cấp phát, license, tài liệu/tệp                             |
| `backend/workspace.mjs` | Truy vấn dữ liệu đúng phạm vi quyền                               |
| `backend/db/`           | SQL migration local, độc lập schema cloud Lovable                 |
| `backend/security.mjs`  | scrypt, phiên, quyền theo bản ghi, audit                          |
| `src/shared/api/`       | Client API, auth gate, dữ liệu biểu đồ và dialog nghiệp vụ        |
| `src/portals/<portal>/` | Giao diện riêng từng vai trò                                      |
| `scripts/dev.mjs`       | Điều phối frontend/API/PostgreSQL localhost                       |

API chính: `/api/auth/login`, `/me`, `/logout`, `/password`, `/password/otp/request`, `/password/otp/verify`,
`/password/reset` (các đường sau nằm
dưới `/api/auth`); `/api/workspace`; `/api/tickets`, `/:id`, `/:id/actions`,
`/:id/assign`, `/:id/return-to-helpdesk`, `/:id/messages`, `/:id/comments`, `/:id/feedback`; `/api/users`, `/departments`, `/assets`,
`/software`, `/documents` (đều dưới `/api`); `/api/assets/:id/assignments`,
`/api/assets/:id/history`, `/api/software/:id/installations`,
`/api/:entity/:id/attachments`, `/api/attachments/:id`, `/api/reports`, `/api/settings/tickets`.

Mã lỗi: 400 dữ liệu không hợp lệ; 401 chưa đăng nhập/hết phiên; 403 thiếu quyền
hoặc CSRF/origin không hợp lệ; 404 không tìm thấy trong phạm vi được phép;
409 xung đột phiên bản/quan hệ/trạng thái; 413 tệp quá lớn.

Backend chỉ lắng nghe localhost. Phiên dùng cookie HttpOnly/SameSite Strict,
token được băm trong database; mật khẩu dùng scrypt có salt. Không lưu token
đăng nhập trong localStorage.
Mỗi tab dùng cookie phiên riêng, được chọn bằng định danh tab ngẫu nhiên.
`sessionStorage` chỉ lưu định danh tab, không lưu mật khẩu/token. Các yêu cầu
ảnh/tệp và CSV cũng dùng đúng phiên của tab. Phiên xác minh đặt lại mật khẩu
chỉ lưu bản băm, hết hạn sau 5 phút, dùng một lần và bị vô hiệu khi mật khẩu
được thay đổi. Phiên đăng nhập và phiên xác minh không được sao lưu/khôi phục.

Nếu triển khai ngoài localhost cần thiết lập
reverse proxy HTTPS, `NODE_ENV=production`, `APP_ORIGIN`, PostgreSQL riêng và
giám sát/backup phù hợp. Bản build frontend không tự chứa tiến trình Express.

## 8. Đối chiếu báo cáo Word

| Yêu cầu trong báo cáo  | Phần thực hiện                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------- |
| FR-01–04, NFR-01/02    | Login/logout, tài khoản, API RBAC, audit                                                |
| FR-05–10, BR-01–05/08  | Admin phân công; Technician trả hàng đợi; chat theo quyền; kết quả, xác nhận/xử lý tiếp |
| FR-11/12/20, BR-09     | Chỉ Admin phân công; giám sát, tìm/lọc, báo cáo và CSV                                  |
| FR-13–16, BR-06/07     | Asset, cấp phát duy nhất, lịch sử và liên kết Ticket                                    |
| FR-17                  | Phần mềm, phiên bản, license và thiết bị sử dụng                                        |
| FR-18/19, BR-11        | Bản nháp, quyền công bố và phạm vi đọc                                                  |
| FR-21, NFR-03          | Upload và download theo quyền, kiểm kích thước/định dạng                                |
| NFR-04/05, TC-04/08/10 | Transaction, audit, cạnh tranh đồng thời, backup/restore                                |

Theo báo cáo, hệ thống không tự cấp quyền trên ERP/AD, không tự cài phần mềm
đến máy trạm và không tự kiểm kê mạng. Các yêu cầu đó được ghi nhận thành
Ticket để nhân viên IT thực hiện. Seed, file tài liệu gốc và backup nguồn được
giữ riêng; không nhận số liệu demo là kết quả vận hành tại doanh nghiệp.
