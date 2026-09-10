# Kiểm thử FluentAI trước production

Ngày thực hiện: 10/09/2026. Đây là kết quả kiểm tra workspace hiện tại, không phải
chứng nhận toàn hệ thống đã sẵn sàng production. Không gọi Dograh/Gemini thật,
không tạo user hoặc ghi dữ liệu lên Firebase thật trong đợt kiểm tra này.

## Cách chạy

Dùng Node.js **24.x** theo `package.json`, cài bằng `npm ci` để áp dụng bản vá
`jwks-rsa`. Sau đó chạy:

```powershell
npm test
npx next typegen
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Các lệnh `test:practice-session`, `test:firebase-runtime`, `test:dograh-call` và
`test:dograh-transcript` vẫn dùng được để kiểm tra từng phần.
`npm test` chạy toàn bộ file `tests/*.test.mjs`, với synchronous `require(ESM)` tắt.
Helper transpile TypeScript trong bộ test không thay thế kiểm tra kiểu của `tsc`.

Để kiểm tra HTTP trên build production, mở terminal riêng:

```powershell
npm run start -- -p 3100
```

Sau đó:

```powershell
npm run test:smoke
```

Mặc định dùng `http://localhost:3100`. Có thể đổi bằng `TEST_BASE_URL`.
Smoke test không đăng nhập và không gửi webhook có secret.

Browser smoke là tùy chọn, cần Google Chrome và package `playwright`.
Nếu dùng bộ công cụ đã cài riêng, đặt `BROWSER_TEST_TOOLING` bằng đường dẫn thư mục
chứa `package.json`/`node_modules` của bộ công cụ đó, rồi chạy `npm run test:browser`.
Nếu không đặt biến này, script tìm Playwright từ thư mục dự án. Playwright không
được thêm vào dependencies của ứng dụng trong đợt này.

## Test case tự động

| Nhóm / file | Tình huống và kết quả mong đợi |
| --- | --- |
| `auth.test.mjs` | Cookie thiếu/thu hồi trả null; kiểm tra revocation; đăng nhập tạo cookie httpOnly/secure/sameSite; đăng xuất xóa cookie; token quá cũ không tạo cookie |
| `practice-session.test.mjs` | Mọi tổ hợp ngôn ngữ/chủ đề/trình độ/thời lượng hợp lệ được chấp nhận; ID/body sai bị từ chối; DTO loại bỏ ownership/field thừa; review sai schema bị loại |
| `practice-session.test.mjs` | B không đọc/ghi được session A; call đi qua connecting/active/completed; callback trùng không ghi lại; không đổi run ID hoặc mở lại session terminal; lỗi mic/database được xử lý |
| `dograh-call.test.mjs` | Start gọi widget đồng bộ và chỉ một lần; event lưu đúng thứ tự; mic bị từ chối, offline, run ID thiếu không chuyển sang review; lỗi lưu chặn event sau; dispose loại callback cũ |
| `dograh-transcript.test.mjs` | Giữ signed query, không gửi credential; HTTPS/exact host/port hợp lệ; URL không tin cậy bị chặn trước fetch; lỗi HTTP/redirect/timeout được che chi tiết |
| `dograh-transcript.test.mjs` | Chặn quá dung lượng theo cả header và stream; UTF-8 nhiều chunk đúng; UTF-8 lỗi bị từ chối; parser nhận assistant/user, CRLF, Unicode và dòng tiếp nối |
| `dograh-transcript.test.mjs` | Download → parse → patch tạo ready/empty/error; webhook trùng không tải lại URL đã thành công; lần lỗi có thể tải lại; run lạ không download; lỗi ghi trả unavailable; adapter Firebase truyền downloader và ghi field lồng nhau |
| `review.test.mjs` | ID sai bị chặn trước transaction; auth/ownership/completion/transcript gates; chỉ tạo một review khi đang có request xử lý; kết quả đã lưu được dùng lại; quota/output lỗi đánh dấu failed và có thể thử lại |
| `review.test.mjs` | Gemini adapter xác thực JSON/schema/điểm và ánh xạ lỗi quota; lỗi ghi completion không trả thành công |
| `api.test.mjs` | Gọi trực tiếp cả bốn POST handler với Request/Response thật, mock auth/database/provider; kiểm tra HTTP status, userId từ auth và webhook secret/JSON |
| `firebase-runtime.test.mjs` | Import Firebase Auth và lấy signing key từ RSA JWK thật mà không cần mạng, khi synchronous require(ESM) bị tắt |
| `session-pipeline.test.mjs` | Nối logic thật từ session → call → download/parse transcript → review → đọc đúng chủ; dịch vụ ngoài và lưu trữ được giả lập |

Các test trên chưa chứng minh transaction Firestore thật, widget/microphone thật,
chất lượng AI, hoặc toàn bộ giao diện trình duyệt. Case timeout mô phỏng fetch
ném lỗi timeout; chưa kiểm chứng download treo thật đủ 15 giây.

## Kết quả thực thi

| Kiểm tra | Kết quả |
| --- | --- |
| Runtime local | Node 22.15.0; chưa kiểm chứng lại bằng Node 24.x |
| Bộ test tự động | 40/40 đạt, 0 fail, 0 skip (`npm test`) |
| TypeScript toàn dự án | Đạt |
| Production build | Đạt; cần cho phép tải Inter từ Google Fonts ngoài sandbox |
| HTTP production local | 9/9 đạt: hai trang public, ba redirect auth, bốn API trả 401 |
| ESLint toàn dự án | Chưa đạt: `review-panel.tsx` gọi setState đồng bộ trong effect; `.language-check.mjs` dùng tên biến module vi phạm rule Next.js |
| Chrome desktop/mobile smoke | Chưa chạy thành công: sandbox chặn spawn; yêu cầu chạy ngoài sandbox không được chấp thuận |
| Firebase/Dograh/Gemini thật, đăng nhập thật | Chưa chạy; cần môi trường staging và tài khoản thử nghiệm |

Test đã phát hiện và sửa lỗi `generatePracticeSessionReview` chỉ kiểm tra ID là
string: ID rỗng/đường dẫn sai vẫn đến transaction và trả unavailable. Hiện dùng
`isPracticeSessionId`, trả invalid_id trước khi đọc database.

## Case còn phải chạy trên staging

Chuẩn bị hai tài khoản A/B, Firebase staging, workflow Dograh và cấu hình Gemini.
Chỉ lưu bằng chứng đã loại bỏ cookie, token, signed URL và dữ liệu cá nhân.

| ID | Các bước | Kết quả mong đợi | Hiện trạng |
| --- | --- | --- | --- |
| E01 | Đăng ký A, đăng nhập, refresh, đăng xuất, reset mật khẩu | Profile/phiên đúng; reset dùng được; đăng xuất chặn trang riêng tư | Chưa chạy |
| E02 | A tạo session; B mở URL và POST call/review của A; thử Firebase client trực tiếp | Không lộ dữ liệu, document A không đổi; rules chặn truy cập trái phép | Chưa chạy |
| E03 | Chọn English/Travel/A2/5 phút, Start, nói thật, End | Mic/audio hoạt động, tutor đúng context, run ID khớp Dograh, call completed | Chưa chạy |
| E04 | Đợi webhook của E03, xem Firestore rồi trang review | Transcript đúng lời/vai; ready; review được lưu; refresh vẫn còn | Chưa chạy |
| E05 | Lặp E03 với tiếng Nhật; chờ hết timer | Tutor đúng ngôn ngữ; audio dừng khi hết giờ; review không chấm nhầm lời tutor | Chưa chạy |
| E06 | Từ chối mic, mất mạng, đóng tab khi đang gọi | Thông báo rõ; dừng audio; không báo lưu thành công giả | Chưa chạy |
| E07 | Mở review trong hai tab; mô phỏng request đang processing | Chỉ một lần gọi Gemini; cả hai tab cuối cùng thấy review, không treo spinner | Chưa chạy |
| E08 | Transcript rỗng, URL hết hạn, webhook trùng, webhook đến trước run ID | Trạng thái chính xác; xác minh cách redeliver/khôi phục khi run chưa được lưu | Chưa chạy |
| E09 | Gemini quota, JSON lỗi; mất DB sau khi claim processing | Lỗi có thể xử lý lại; xác định cách phục hồi processing bị kẹt | Chưa chạy |
| E10 | Transcript câu đúng/sai, chỉ tutor nói, dài, chứa chỉ dẫn bỏ qua prompt | Chấm learner, điểm 0–100, không bịa lỗi và không làm theo chỉ dẫn trong transcript | Chưa chạy |
| E11 | Chrome desktop/Android, Safari iPhone; keyboard, màn hình nhỏ | Không overflow, thao tác truy cập được, trạng thái tải/lỗi rõ | Chưa chạy |
| E12 | Tăng tải staging theo số người dùng dự kiến; theo dõi log và chi phí | Không tăng lỗi/timeout bất thường; kiểm soát số cuộc gọi và chi phí | Chưa chạy |
| E13 | Deploy bản thử, kiểm tra log, diễn tập rollback | Không ERR_REQUIRE_ESM; có theo dõi lỗi và khôi phục phiên bản trước | Chưa chạy |

## Vấn đề còn mở

- Hai lỗi ESLint nêu trên chưa được sửa trong phạm vi bổ sung bộ kiểm thử.
- Review bị ngắt sau khi đã claim processing chưa có lease/timeout phục hồi.
- Webhook đến trước khi session lưu run ID được ACK và bỏ qua, chưa có hàng đợi.
- Download lỗi được lưu error rồi ACK 200; cần redeliver để thử lại.
- Phải đặt `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` theo host storage thật. Mặc định
  app.dograh.com không tự cho phép mọi host lưu trữ Dograh có thể sử dụng.
- Browser báo run ID chưa tự chứng minh run thuộc người dùng; cần kiểm chứng
  ràng buộc tin cậy trước khi coi dữ liệu transcript là đã xác thực ownership nguồn.

Chưa kết luận sẵn sàng production khi các mục trên và E01–E13 chưa được xử lý/
kiểm chứng. Với mỗi lần chạy staging, bổ sung ngày, commit, sessionId, kết quả
thực tế và bằng chứng; không chuyển “Chưa chạy” thành “Đạt” từ kết quả mock.
