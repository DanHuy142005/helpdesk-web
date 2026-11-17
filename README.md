**Hướng dẫn đầy đủ:** [Cài đặt database, tài khoản demo và chạy trên VS Code](doc/HUONG_DAN_LOCALHOST.md).

**Phân tích và kiểm thử:** [Các lỗi đã sửa và bằng chứng kiểm tra](doc/PHAN_TICH_VA_KIEM_THU.md).

This project was built with [Lovable](https://lovable.dev).


## Development

### Chạy nhanh trên Windows 10/11

Nhấp đúp `run.bat` ở thư mục gốc dự án. Script tự tải Node.js 24 portable,
kiểm tra SHA256, cài thư viện theo `package-lock.json` và mở trình duyệt khi web
sẵn sàng. Không cần cài Node.js trước hoặc quyền Administrator. Lần chạy đầu
cần Internet; các lần sau dùng lại môi trường đã tải.

Giữ cửa sổ terminal mở khi dùng web; nhấn **Ctrl+C** để dừng. Mặc định web chạy
tại `http://127.0.0.1:5173`; nếu cổng bận, Vite sẽ chọn cổng trống tiếp theo.

```powershell
.\run.bat -Port 5174
.\run.bat -NoBrowser
```

Không chạy bản `run.bat` bên trong `golden sample` vì đó chỉ là bộ mẫu, không
chứa mã nguồn website. `.runtime/` và `node_modules/` được tạo tự động.
Không xóa `.runtime/` nếu cần giữ database. Hãy sao lưu trước khi di chuyển dự án;
chi tiết ở [hướng dẫn localhost](doc/HUONG_DAN_LOCALHOST.md).

### Chạy bằng Node.js đã cài

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm ci
npm run dev
```
