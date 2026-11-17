# Phân tích source và kết quả kiểm thử

Ngày thực hiện: 17/11/2026. Phạm vi: source đang mở trong VS Code và yêu cầu
nghiệp vụ từ `Bao_cao_IT_Helpdesk_ok.docx`. Đây là kiểm thử phát triển nội bộ
trên localhost với dữ liệu giả lập, không phải biên bản UAT doanh nghiệp.

## Các vấn đề được xử lý

| Hiện trạng ban đầu | Thay đổi đã thực hiện |
| --- | --- |
| Dữ liệu Ticket và nhân sự được khai báo riêng trong từng portal | PostgreSQL dùng chung, API trả dữ liệu theo quyền của tài khoản |
| Nút tạo/nhận/chuyển/hoàn tất chỉ hiện toast | Giao dịch API thật, xác thực trạng thái, lưu lịch sử và cập nhật giao diện |
| Không có backend, đăng nhập hoặc quyền truy cập | Express, cookie phiên HttpOnly, CSRF, kiểm tra vai trò và sở hữu bản ghi tại server |
| Các trang chi tiết dùng `list[0]!` hoặc Ticket cố định | Chọn bản ghi thật, xử lý danh sách rỗng, không phụ thuộc ID mẫu |
| Kết quả xử lý không chờ người yêu cầu xác nhận | Requester xác nhận đóng hoặc yêu cầu tiếp tục xử lý; người xử lý không tự đóng thay |
| Cấp phát, phần mềm và tài liệu chỉ là dữ liệu hiển thị | CRUD, cấp phát/thu hồi/điều chuyển, license theo thiết bị, bản nháp/công bố và tệp thực |
| KPI, biểu đồ, ngày tháng và số đếm cố định | Tính từ dữ liệu API; lọc kỳ báo cáo và xuất CSV |
| Phân trang 1/2/3 và topbar đồng bộ không hoạt động | Phân trang thật, tìm kiếm, thông báo, lịch, trạng thái tải và làm mới dữ liệu |
| Thay đổi mật khẩu hoặc quyền có thể để lại phiên cũ | Thu hồi phiên, kiểm tra tài khoản còn hoạt động ở mỗi yêu cầu |
| Nguy cơ nhận Ticket/cấp phát thiết bị đồng thời | Khóa bản ghi, kiểm tra version và unique index cho cấp phát đang hiệu lực |
| Ngày bảo hành/hết hạn có thể lệch do chuyển DATE sang timestamp | Giữ kiểu ngày lịch `YYYY-MM-DD` khi đọc PostgreSQL |
| Chưa có quy trình sao lưu/khôi phục | Snapshot nhất quán, backup mã hóa, restore có transaction vào database rỗng |

## Kiến trúc và giao diện

- Giữ bốn portal `/admin`, `/helpdesk`, `/technician`, `/end-user`, sidebar,
  dashboard, các card và biểu đồ hiện có. Bổ sung dialog nghiệp vụ và đăng nhập.
- `src/styles.css` giữ nguyên từng byte so với bản sao lưu trước khi tích hợp.
  SHA256: `F769CB854CE192A0EE8FB6C7A4982FE8129206F035988C8640767B450FCDEB65`.
- 37 file trong `src/portals` tuân thủ ranh giới import ứng dụng qua `@/shared`;
  không import chéo giữa các portal. Route trang chủ cũng đã được làm mỏng.
- Backend ở `backend/`; SQL local ở `backend/db/`. Không chỉnh schema cloud
  Lovable, `supabase/migrations/`, `drizzle/` hoặc mã route tự sinh bằng tay.
- File bí mật, database portable, tài khoản demo và bằng chứng chạy được đặt
  trong `.runtime/`, đã loại khỏi Git. Mật khẩu/token không được ghi vào audit.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript strict theo cấu hình dự án | Đạt |
| Vitest kiểm tra routing hiện có | 1/1 đạt |
| API tích hợp trên PostgreSQL thật | 16/16 đạt |
| Edge: 24 trang, chặn sai portal và luồng Ticket nhiều phiên | 26/26 đạt |
| Edge: nhóm thao tác quản trị qua form | 7/7 đạt |
| Chrome: 24 trang, chặn sai portal và luồng Ticket nhiều phiên | 26/26 đạt |
| Build frontend với cấu hình Lovable/TanStack | Đạt |
| `run.bat -NoBrowser` gọi từ thư mục khác | Đạt |
| Dữ liệu sau khi dừng/khởi động lại PostgreSQL | Số bản ghi các bảng đối chiếu được giữ nguyên |
| So sánh stylesheet Premium ban đầu | Không thay đổi |

16 bài API bao gồm: 401/403 và CSRF/origin; kiểm tra dữ liệu; truy cập chéo
Ticket; Helpdesk tự giải quyết; chuyển Technician; chờ phản hồi/tiếp tục;
người gửi báo chưa đạt rồi xác nhận đóng; đánh giá; tranh chấp tiếp nhận;
chuyển cho Technician bị khóa và rollback; ghi chú nội bộ; upload/download;
tài khoản, reset mật khẩu và thu hồi phiên; cấp phát/điều chuyển/thu hồi cả
thiết bị bảo trì; số license; quyền tài liệu; báo cáo/audit; tính bền vững và
idempotent seed; logout; backup/restore cả tệp binary.

Kiểm thử form quản trị thực hiện tạo phòng ban/nhân viên/tài sản/phần mềm;
cấp phát–điều chuyển–thu hồi; cấp/thu hồi license; tạo tài liệu có tệp;
chọn kỳ và tải CSV; xem audit; đăng xuất. Các bản ghi E2E/QA được giữ lại làm
dữ liệu kiểm chứng trong database demo.

## Bằng chứng và chạy lại

- `backend/test/system.test.mjs`: kịch bản API, chạy trong schema thử riêng.
- `e2e/system.mjs`: kiểm tra trang và luồng Ticket qua các phiên đăng nhập.
- `e2e/management.mjs`: các form quản trị.
- `.runtime/api-verification.log`, `.runtime/build-verification.log`.
- `.runtime/browser-verification-msedge.json`,
  `.runtime/management-verification-msedge.json`,
  `.runtime/browser-verification-chrome.json`.
- `.runtime/screenshots/`: ảnh chụp bốn portal sau tích hợp.

Lệnh chạy, database cài riêng/Docker, tài khoản demo, quy tắc nghiệp vụ và
backup/restore: [Hướng dẫn localhost](HUONG_DAN_LOCALHOST.md).

Phạm vi bàn giao là ứng dụng localhost. Không tự thao tác ERP/AD, không quét
mạng hay tự đẩy cài đặt phần mềm lên máy trạm. Những công việc đó được ghi nhận
bằng Ticket để nhân viên IT xử lý, phù hợp ranh giới trong báo cáo Word.
