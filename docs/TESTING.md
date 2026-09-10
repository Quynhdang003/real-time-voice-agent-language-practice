# Kiểm thử FluentAI trước production

Ứng dụng hiện tập trung vào luồng tạo phiên và gọi luyện tập bằng Dograh.

## Kiểm tra tự động

Dùng Node.js 24.x theo `package.json`, cài dependency bằng `npm ci`, sau đó chạy:

```powershell
npm test
npx next typegen
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Các nhóm kiểm tra chính:

- Xác thực đăng nhập, đăng xuất và Firebase Admin runtime.
- Validation khi tạo phiên luyện tập và bảo vệ ownership của session.
- Vòng đời cuộc gọi: ready, connecting, active, completed và failed.
- Xử lý microphone bị từ chối, mất mạng, thiếu workflow run ID và lỗi lưu Firestore.
- Route API từ chối request chưa đăng nhập hoặc payload không hợp lệ.

## Smoke test production build

Mở server build ở một terminal:

```powershell
npm run start -- -p 3100
```

Ở terminal khác:

```powershell
npm run test:smoke
```

Mặc định smoke test dùng `http://localhost:3100`; có thể thay bằng biến
`TEST_BASE_URL`.

## Kiểm tra thủ công cần thiết

1. Đăng nhập và tạo session với từng ngôn ngữ, chủ đề, trình độ và thời lượng.
2. Nhấn **Start Call**, cấp quyền microphone và xác nhận kết nối Dograh thành công.
3. Kết thúc thủ công và chờ hết thời lượng; cả hai trường hợp phải lưu trạng thái
   cuộc gọi và hiển thị nút **Back to Home**.
4. Kiểm tra lỗi microphone, mất mạng và Dograh không khả dụng; người dùng phải thấy
   thông báo rõ ràng và có thể quay về trang chủ.
5. Mở session của người dùng khác hoặc dùng session ID sai; dữ liệu không được lộ.
6. Kiểm tra Chrome desktop/Android và Safari iPhone, đặc biệt quyền microphone,
   timer, trạng thái kết nối và giao diện trên màn hình nhỏ.
