# Nền website — PNG

Web hiện dùng nền CSS, không có ảnh nền bitmap gốc. Các PNG trong thư mục này được kết xuất từ chính giá trị màu OKLCH, gradient và các lớp trang trí đang dùng trong mã nguồn; không tạo lại bằng AI.

Mở **00-bang-xem-truoc.png** để xem toàn bộ bộ nền. Dùng các file đánh số **01–17** làm ảnh nền riêng; các ảnh đó không chứa chữ, icon hoặc số liệu.

| File PNG | Kích thước (pixel) | Nguồn / vị trí sử dụng |
|---|---|---|
| `01-nen-tong-the-canvas.png` | 1920 × 1080 | src/styles.css — --gradient-canvas; nền body |
| `02-nen-hero-gradient.png` | 1920 × 1080 | src/styles.css — --gradient-hero; nền banner và chi tiết ticket |
| `03-nen-thuong-hieu-brand.png` | 1920 × 1080 | src/styles.css — --gradient-brand; nút, logo, thanh tiến độ |
| `04-nen-xanh-duong-blue.png` | 1920 × 1080 | src/styles.css — --gradient-blue; avatar, icon KPI, phần mềm |
| `05-nen-tim-violet.png` | 1920 × 1080 | src/styles.css — --gradient-violet; avatar, icon KPI, phần mềm |
| `06-nen-xanh-ngoc-cyan.png` | 1920 × 1080 | src/styles.css — --gradient-cyan; avatar, icon KPI, phần mềm |
| `07-nen-hong-cam-rose.png` | 1920 × 1080 | src/styles.css — --gradient-rose; avatar, icon KPI, phần mềm |
| `08-nen-banner-dashboard.png` | 2560 × 720 | src/routes/index.tsx — hero và hai vòng màu; blur-2xl = 40px theo Tailwind CSS 4 |
| `09-nen-banner-knowledge.png` | 2560 × 720 | src/routes/knowledge.tsx — hero và vòng màu cyan; blur-2xl = 40px theo Tailwind CSS 4 |
| `10-nen-card-kpi-blue.png` | 960 × 660 | src/components/shared/KpiCard.tsx — nền trắng và vòng blue; blur-xl = 24px theo Tailwind CSS 4; trạng thái bình thường |
| `11-nen-card-kpi-violet.png` | 960 × 660 | src/components/shared/KpiCard.tsx — nền trắng và vòng violet; blur-xl = 24px theo Tailwind CSS 4; trạng thái bình thường |
| `12-nen-card-kpi-cyan.png` | 960 × 660 | src/components/shared/KpiCard.tsx — nền trắng và vòng cyan; blur-xl = 24px theo Tailwind CSS 4; trạng thái bình thường |
| `13-nen-card-kpi-rose.png` | 960 × 660 | src/components/shared/KpiCard.tsx — nền trắng và vòng rose; blur-xl = 24px theo Tailwind CSS 4; trạng thái bình thường |
| `14-nen-ho-tro-sidebar.png` | 896 × 384 | src/components/layout/AppSidebar.tsx — nền ô “Cần hỗ trợ gấp?” và vòng sáng |
| `15-nen-khung-ung-dung.png` | 1920 × 1080 | src/components/layout/AppShell.tsx — bg-background/80; lớp nền trong suốt 20% |
| `16-nen-card-trang.png` | 1920 × 1080 | src/styles.css — --card và --sidebar; card-soft |
| `17-nen-glass.png` | 1920 × 1080 | src/styles.css — glass; lớp nền trắng trong suốt 40% |

## Lưu ý khi sử dụng

- 01 là nền ngoài cùng của toàn bộ website. 02–07 là các gradient cơ bản.
- 08–09 gồm gradient và các quầng sáng của banner; 10–13 là nền card KPI ở trạng thái bình thường; 14 là nền ô hỗ trợ trong sidebar.
- 15–17 là các lớp nền bề mặt. Những ảnh có alpha giữ nguyên độ trong suốt từ CSS; khi đặt trên một màu khác, kết quả sẽ thay đổi theo nền bên dưới.
- Hiệu ứng backdrop-filter (làm mờ nội dung phía sau) phụ thuộc vào nội dung nằm dưới lớp kính; ảnh PNG của lớp kính chỉ giữ màu và độ trong suốt của lớp đó.
- Ảnh banner/card được xuất ở tỉ lệ 2×, 3× hoặc 4× từ kích thước CSS mẫu để đủ sắc nét. Chưa áp bo góc, viền và bóng đổ bên ngoài, để có thể dùng như một ảnh nền phẳng.
- Nền gradient trong CSS tự thay đổi theo kích thước phần tử. PNG là một ảnh tĩnh tại kích thước nêu trên, nên khi cắt hoặc kéo giãn sẽ có khác biệt với gradient CSS đang co giãn theo màn hình.
