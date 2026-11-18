# Phân tích source và kết quả kiểm thử

## Sửa form số điện thoại — 18/11/2026

- Form Nhân viên giữ chi tiết lỗi do API trả về, hiển thị tên trường sai
  ngay trong form thay vì chỉ thông báo chung “Dữ liệu không hợp lệ”.
- Số điện thoại nhận dạng nội địa 10–11 chữ số, mã +84/84/0084, khoảng trắng,
  dấu chấm/gạch ngang, chữ số fullwidth và +84 (0); lưu thống nhất dạng quốc tế.
  Ô trống hoặc chỉ có khoảng trắng bỏ liên kết. Số bị trùng báo rõ tài khoản khác
  đã liên kết; giữ giới hạn một số cho một tài khoản.
- Bổ sung ví dụ nhập ở form Nhân viên và Quên mật khẩu.
- 32/32 kiểm tra API đạt; TypeScript và build đạt. Edge/Chrome đều đạt 7 nhóm
  đăng nhập: có thử số không hợp lệ trong form Nhân viên, sửa thành số nội địa
  hợp lệ, lưu, tải lại kiểm tra số chuẩn hóa rồi lấy OTP bằng số nội địa.
- Kiểm tra dữ liệu hiện có ở chế độ chỉ đọc: cả 8 tài khoản đều qua validation
  với các trường đang lưu và số 0901234567. Chưa tái hiện thông báo cũ với số
  hợp lệ; chi tiết lỗi mới giúp xác định trường thực sự bị sai khi thao tác.
  Không thay số điện thoại, mật khẩu hoặc dữ liệu tài khoản đang sử dụng.

Bằng chứng: `.runtime/ticket-workflow-browser.log`,
`.runtime/auth-verification-msedge.json`, `.runtime/auth-verification-chrome.json`,
`.runtime/phone-fix-build.log`.

## Cập nhật OTP, phân loại và SLA — 18/11/2026

Phần này thay thế các quy tắc cũ về xác minh mật khẩu và phân loại trong các
mốc bên dưới.

- Quên mật khẩu bằng số điện thoại đã liên kết và OTP cố định 123456, sau đó
  nhập mật khẩu mới/nhập lại. Mật khẩu tối thiểu 7 ký tự trên mọi form/API.
  Số điện thoại chuẩn hóa, duy nhất, do Admin quản lý tại Nhân viên.
- OTP và proof lưu bản băm, hết hạn 5 phút, dùng một lần; giới hạn 5 lần sai,
  chờ 60 giây khi yêu cầu lại. Proof gắn với số điện thoại và phiên bản mật
  khẩu; đổi số/mật khẩu/khóa tài khoản vô hiệu hóa proof. Đặt lại mật khẩu
  thu hồi mọi phiên của tài khoản; các tài khoản khác không bị ảnh hưởng.
- SMS chưa được cấu hình dịch vụ thật. Adapter nhận URL/key qua biến môi
  trường máy chủ; không tuyên bố đã gửi SMS khi chưa có gateway.
- Chỉ Admin và End User sửa ba trường phân loại. Đề xuất End User lưu riêng
  với quyết định Admin; Helpdesk/Technician thấy mức ưu tiên Admin duyệt.
  API yêu cầu Admin truyền đủ ba trường trước mỗi lần phân công, kể cả chọn
  rõ không liên quan thiết bị. SLA tính từ created_at, không gia hạn khi đổi người.
- Trang Admin `/admin/sla` quản lý quá hạn, xử lý trễ, chờ xác nhận và tự đóng;
  có cấu hình thời gian chờ, mặc định tắt. Worker 15 giây dùng khóa giao dịch
  PostgreSQL để tránh đóng trùng, ghi sự kiện Hệ thống/audit/thông báo.
  End User yêu cầu xử lý tiếp hủy điều kiện tự đóng. Cấu hình vào backup/restore.
- Banner quá hạn trong hai portal xử lý và cảnh báo tại Ticket; thông báo
  gửi Admin/người phụ trách một lần theo deadline và người nhận.
- Migration 005 nâng cấp dữ liệu tại chỗ. Giao diện/nền và phiên riêng theo tab giữ nguyên.

Kiểm tra API: **31/31 đạt**, bao gồm quyền phân loại, ba trường bắt buộc,
ưu tiên theo Admin, OTP sai/hết hạn/dùng lại, giới hạn lần thử, mật khẩu 7 ký
tự, tranh chấp đặt lại, worker không đóng trùng, đóng tay/xử lý tiếp, thông
báo SLA không lặp, lỗi/tiếp nhận ở SMS gateway và backup mã hóa.

Edge và Chrome đều đạt **27/27 kiểm tra hồi quy** (25 trang, chặn sai portal
và luồng Ticket), **6 nhóm đăng nhập** (gồm OTP và phiên riêng theo tab).
Kiểm tra tự đóng theo bộ hẹn giờ dùng `e2e/policy.mjs`, chỉ chạy khi được đánh
dấu QA trên database riêng cổng 55434; không lùi thời gian Ticket nghiệp vụ.
Bằng chứng: `.runtime/ticket-workflow-api.log`, `.runtime/otp-sla-build.log`,
`.runtime/auth-verification-*.json`, `.runtime/browser-verification*.json`.
Kiểm tra bộ hẹn giờ thật: **2/2 luồng trên mỗi trình duyệt đạt** cho Helpdesk
và Technician, gồm banner/danh sách quá hạn, thông báo do worker gửi, hạn tự
đóng hiển thị cho End User, đóng tự động đúng một lần và danh sách Admin/mobile.
Bằng chứng: `.runtime/policy-verification-msedge.json`,
`.runtime/policy-verification-chrome.json`, ảnh `*-sla-*.png`.

TypeScript, Vitest và build đạt. Database localhost đã được sao lưu mã hóa
trước migration 005; giữ đủ 8 người dùng, 19 Ticket, 76 sự kiện, 8 ghi chú
và 26 tin nhắn tại thời điểm nâng cấp. Tự đóng mặc định tắt, không tự gán số
điện thoại cho tài khoản cũ. Chi tiết bản sao lưu trong
`.runtime/ticket-workflow-migration.json`; không đưa backup/key lên Git.

## Cập nhật đăng nhập và phiên theo tab — 18/11/2026

- Trang chủ `/` mở giao diện đăng nhập mới, bỏ màn chọn bốn cổng và liên kết
  danh sách cổng ở sidebar. Tài khoản đã xác thực tự mở trang đúng vai trò.
- Quên mật khẩu gồm xác minh email/mật khẩu cũ, rồi nhập mật khẩu mới và nhập
  lại. API không cho bỏ qua bước xác minh. Bản băm phiên xác minh lưu trong
  PostgreSQL, hết hạn sau 5 phút, dùng một lần; mật khẩu thay đổi làm proof cũ
  mất hiệu lực và thu hồi mọi phiên đăng nhập của chính tài khoản đó.
- Mỗi tab có định danh ngẫu nhiên và cookie HttpOnly/SameSite Strict riêng.
  Không lưu token hoặc mật khẩu trong localStorage/sessionStorage. Có xử lý
  tab mở từ cửa sổ đang đăng nhập để không chiếm phiên của tab gốc; tải lại
  tab giữ tài khoản hiện tại. Ảnh, tệp và báo cáo sử dụng đúng phiên theo tab.
- Form đăng nhập không cho gửi trước khi giao diện tương tác đã sẵn sàng;
  khai báo POST để không đưa thông tin đăng nhập vào query string khi thiếu JS.
- Bỏ nội dung giới thiệu demo/kiểm thử trong giao diện, thay mô tả khởi tạo
  cũ bằng nội dung nghiệp vụ. Migration `004-password-reset.sql` đã áp dụng
  sau khi sao lưu mã hóa, giữ nguyên tài khoản, Ticket, lịch sử và tệp.

Kiểm tra: **26/26 bài API đạt**. Edge và Chrome đều đạt **6 nhóm kiểm tra
đăng nhập**, gồm giao diện desktop/mobile, bốn vai trò trong một trình duyệt,
tải lại tab, tab mở từ tab gốc, tải CSV, đăng xuất riêng và đặt lại mật khẩu.
Kịch bản API kiểm tra thêm proof hết hạn, dùng lại, mật khẩu không khớp,
tranh chấp đặt lại mật khẩu và CSRF khác tab.
Kiểm tra hồi quy Edge/Chrome đều **26/26 đạt**: 24 trang, chặn sai vai trò
và luồng Ticket có nhiều ảnh, phân công, chat, xử lý tiếp và xác nhận đóng.

Bằng chứng: `.runtime/auth-verification-msedge.json`,
`.runtime/auth-verification-chrome.json`, `.runtime/ticket-workflow-api.log`,
ảnh `*-login-desktop.png`/`*-login-mobile.png` trong `.runtime/screenshots/`.
Source đối chiếu: `backend/auth.mjs`, `src/shared/api/tab-session.ts`,
`src/shared/pages/LoginPage.tsx`, `e2e/auth.mjs`.

## Cập nhật giao diện theo `cần sửa .docx` — 18/11/2026

Đã đối chiếu toàn bộ nội dung `doc/cần sửa .docx`:

- Tạo yêu cầu End User: bỏ thiết bị, gợi ý tự xử lý, cam kết phản hồi; đưa
  vùng kéo thả/nút đính kèm ngay dưới mô tả; hỗ trợ nhiều ảnh, xem trước và bỏ
  từng tệp. Gửi Ticket và toàn bộ tệp cùng transaction để tránh dữ liệu thiếu.
- Ảnh được hiển thị trực tiếp trong chi tiết Admin/Helpdesk/Technician, có thể
  mở lớn hoặc tải xuống. Giữ đúng tên tệp tiếng Việt và quyền xem theo Ticket.
- End User xem chi tiết Ticket ở chế độ chỉ đọc, lịch sử chỉ hiện trạng thái
  và thời gian. Bỏ chat/tải tệp tại đây; cột tiến độ đổi thành nút xác nhận
  hoàn thành ở cuối bảng, chỉ bật khi trạng thái Đã giải quyết.
- Theo dõi trạng thái: bỏ danh sách yêu cầu dạng cột và nhật ký; dùng bộ chọn
  yêu cầu gọn, sơ đồ trạng thái rộng và khung chat lớn. Vẫn có thể báo chưa đạt.
- Helpdesk/Technician: bỏ nút Chi tiết & chat, mở chi tiết bằng hàng Ticket;
  phân loại giữ tại chi tiết, Technician giữ ghi chú và thao tác chuyển Helpdesk.
  Helpdesk không còn ghi chú nội bộ, kể cả khi gọi API trực tiếp.
- Hai portal IT đều có trang Xử lý sự cố với hội thoại lớn, ảnh/tải tệp và
  lịch sử. Bỏ checklist, gợi ý kho giải pháp, phản hồi cũ và nút mở chi tiết.
  Nút Đã giải quyết xong ở cạnh Gửi tin nhắn; phải xác nhận và nhập kết quả
  thực tế trước khi chờ End User xác nhận. Không tự tạo nội dung giải quyết mẫu.
- Có thông báo giữa màn hình sau khi gửi yêu cầu, Admin phân công, Technician
  chuyển yêu cầu cho Admin và xác nhận kết quả. Chỉ Admin phân công người nhận.
- Giữ nền, kiểu giao diện Premium SaaS, 4 portal và dữ liệu hiện có.

Kiểm tra bản cập nhật: **TypeScript và build đạt; 22/22 bài API đạt;
Edge và Chrome đều 26/26 kiểm tra đạt**, gồm 24 trang và luồng nhiều phiên.
Các kiểm tra mới bao gồm kéo thả/chọn ba ảnh, ảnh tải được ở từng portal,
chi tiết không có chat/ghi chú ngoài quyền, popup căn giữa, hủy/xác nhận giải
quyết, yêu cầu xử lý tiếp, nút hoàn thành mờ/bật đúng trạng thái và mobile.

Bằng chứng: `.runtime/ticket-workflow-api.log`, `.runtime/doc-fixes-build.log`,
`.runtime/browser-verification.json`, `.runtime/browser-verification-chrome.json`;
ảnh có tiền tố `msedge-`/`chrome-` trong `.runtime/screenshots/`.
Bản sao source trước khi sửa: `.runtime/backups/before-doc-fixes-*.zip`.
Các bài kiểm thử dùng PostgreSQL riêng, không tạo Ticket thử vào database đang dùng.

## Cập nhật nghiệp vụ ngày 18/11/2026

Nguồn đối chiếu: `doc/Helpdesk đổi nghiệp vụ.docx`, gồm FR-06–11,
BR-02/03/08/09, US-02/04 và TC-04/05/11/12/13.

- Chỉ Admin được phân công hoặc thay người xử lý qua API `/tickets/:id/assign`.
  Bỏ tự nhận và Helpdesk chuyển Technician; các API cũ bị chặn 403.
- Helpdesk và Technician chỉ xem, xử lý Ticket đang được giao. Technician trả
  Ticket về hàng đợi Helpdesk kèm lý do, bỏ assignee; Admin chọn Helpdesk nhận tiếp.
- Chat riêng giữa requester và người đang xử lý, lưu tác giả/nội dung/thời gian,
  đồng bộ khoảng 3 giây, giữ lịch sử khi phân công lại. Người cũ mất quyền;
  Admin không đọc/gửi chat. Ghi chú nội bộ tách khỏi hội thoại End User.
- End User xác nhận đóng hoặc báo chưa đạt. Khi đang chờ thông tin, tin nhắn
  bổ sung của End User đưa Ticket trở lại Đang xử lý.
- Giữ bốn portal, giao diện Premium SaaS và các nền đã áp dụng ở lần trước.
  Trang Chuyển Technician cũ trở thành Lịch sử phân công, giữ URL cho bookmark.
- Migration `002-ticket-assignment-and-chat.sql` nâng cấp database cũ, không
  xóa Ticket/lịch sử; chuyển bình luận công khai sang bảng tin nhắn riêng.
  Backup/restore đã bao gồm tin nhắn và hỗ trợ dữ liệu backup cũ.

Kiểm tra trên PostgreSQL thật: **21/21 bài API đạt**. Edge và Chrome:
**26/26 kiểm tra mỗi trình duyệt đạt**, gồm 24 trang, chặn sai portal và luồng
Admin phân công → Technician chat/trả hàng đợi → Admin giao Helpdesk → chat
giữ lịch sử → báo chưa đạt → xử lý lại → xác nhận đóng. TypeScript và build đạt.
Đây là kiểm thử nội bộ bằng dữ liệu demo, không phải nghiệm thu doanh nghiệp.

Database hiện có đã được nâng cấp sau khi sao lưu mã hóa; giữ nguyên 8 người dùng,
13 Ticket, 44 sự kiện và 8 bình luận cũ; 8 trao đổi công khai đã chuyển vào chat.
Thông tin kiểm chứng và đường dẫn bản sao lưu ở `.runtime/ticket-workflow-migration.json`.
Khóa giải mã nằm trong file `.key` cùng tên bên cạnh backup trong `.runtime/backups/`;
giữ hai file ở nơi riêng tư và không đưa lên Git.

Bằng chứng: `.runtime/ticket-workflow-api.log`,
`.runtime/ticket-workflow-build.log`, `.runtime/browser-verification.json`,
`.runtime/browser-verification-chrome.json`, ảnh trong `.runtime/screenshots/`.
Kịch bản cập nhật ở `backend/test/system.test.mjs` và `e2e/system.mjs`.
Hướng dẫn thao tác mới: mục 3 trong `doc/HUONG_DAN_LOCALHOST.md`.

## Hồ sơ kiểm tra ban đầu ngày 17/11/2026

Phần bên dưới ghi lại kết quả trước khi đổi nghiệp vụ và trước khi thay nền.
Luồng Ticket đang sử dụng được mô tả ở phần cập nhật ngày 18/11 phía trên.
Nguồn tham chiếu ban đầu là `Bao_cao_IT_Helpdesk_ok.docx`. Đây là kiểm thử phát triển nội bộ
trên localhost với dữ liệu giả lập, không phải biên bản UAT doanh nghiệp.

## Các vấn đề được xử lý

| Hiện trạng ban đầu                                              | Thay đổi đã thực hiện                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Dữ liệu Ticket và nhân sự được khai báo riêng trong từng portal | PostgreSQL dùng chung, API trả dữ liệu theo quyền của tài khoản                         |
| Nút tạo/nhận/chuyển/hoàn tất chỉ hiện toast                     | Giao dịch API thật, xác thực trạng thái, lưu lịch sử và cập nhật giao diện              |
| Không có backend, đăng nhập hoặc quyền truy cập                 | Express, cookie phiên HttpOnly, CSRF, kiểm tra vai trò và sở hữu bản ghi tại server     |
| Các trang chi tiết dùng `list[0]!` hoặc Ticket cố định          | Chọn bản ghi thật, xử lý danh sách rỗng, không phụ thuộc ID mẫu                         |
| Kết quả xử lý không chờ người yêu cầu xác nhận                  | Requester xác nhận đóng hoặc yêu cầu tiếp tục xử lý; người xử lý không tự đóng thay     |
| Cấp phát, phần mềm và tài liệu chỉ là dữ liệu hiển thị          | CRUD, cấp phát/thu hồi/điều chuyển, license theo thiết bị, bản nháp/công bố và tệp thực |
| KPI, biểu đồ, ngày tháng và số đếm cố định                      | Tính từ dữ liệu API; lọc kỳ báo cáo và xuất CSV                                         |
| Phân trang 1/2/3 và topbar đồng bộ không hoạt động              | Phân trang thật, tìm kiếm, thông báo, lịch, trạng thái tải và làm mới dữ liệu           |
| Thay đổi mật khẩu hoặc quyền có thể để lại phiên cũ             | Thu hồi phiên, kiểm tra tài khoản còn hoạt động ở mỗi yêu cầu                           |
| Nguy cơ nhận Ticket/cấp phát thiết bị đồng thời                 | Khóa bản ghi, kiểm tra version và unique index cho cấp phát đang hiệu lực               |
| Ngày bảo hành/hết hạn có thể lệch do chuyển DATE sang timestamp | Giữ kiểu ngày lịch `YYYY-MM-DD` khi đọc PostgreSQL                                      |
| Chưa có quy trình sao lưu/khôi phục                             | Snapshot nhất quán, backup mã hóa, restore có transaction vào database rỗng             |

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

| Kiểm tra                                                      | Kết quả                                       |
| ------------------------------------------------------------- | --------------------------------------------- |
| TypeScript strict theo cấu hình dự án                         | Đạt                                           |
| Vitest kiểm tra routing hiện có                               | 1/1 đạt                                       |
| API tích hợp trên PostgreSQL thật                             | 16/16 đạt                                     |
| Edge: 24 trang, chặn sai portal và luồng Ticket nhiều phiên   | 26/26 đạt                                     |
| Edge: nhóm thao tác quản trị qua form                         | 7/7 đạt                                       |
| Chrome: 24 trang, chặn sai portal và luồng Ticket nhiều phiên | 26/26 đạt                                     |
| Build frontend với cấu hình Lovable/TanStack                  | Đạt                                           |
| `run.bat -NoBrowser` gọi từ thư mục khác                      | Đạt                                           |
| Dữ liệu sau khi dừng/khởi động lại PostgreSQL                 | Số bản ghi các bảng đối chiếu được giữ nguyên |
| So sánh stylesheet Premium ban đầu                            | Không thay đổi                                |

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
