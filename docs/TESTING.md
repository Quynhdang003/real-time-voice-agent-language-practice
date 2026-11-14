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
| `dograh-transcript.test.mjs` | Giữ signed query, không gửi header/credential; HTTPS/exact host/port hợp lệ; URL không tin cậy bị chặn trước fetch (`untrusted_url` + host); (TR-02) đi theo redirect 301–308 tới storage được phép, chung một deadline, URL tương đối; đích ngoài allowlist, thiếu location, quá 3 hop → `redirect_rejected` mà không gửi request; mã lỗi `http_4xx`/`http_5xx`/`network`/`timeout` không lộ chi tiết |
| `dograh-transcript.test.mjs` | Chặn quá dung lượng theo cả header và stream (`too_large`); UTF-8 nhiều chunk đúng; UTF-8 lỗi hoặc bị cắt → `invalid_utf8`; parser nhận assistant/user, CRLF, Unicode và dòng tiếp nối |
| `dograh-webhook.test.mjs` (TR-01) | Payload phẳng v2, `""` = không gửi; session_id/run ID/URL sai bị từ chối; liên kết theo `session_id` → ready/empty/error, giữ field cuộc gọi; không có transcript_url → empty; session lạ, run khác, dữ liệu hỏng → skipped, không tải/ghi; phiên cũ trùng run ID không bị đụng; lưu run ID khi `connected` thất bại; gửi lại là no-op; giao song song thắng; lỗi Firestore → unavailable; adapter Firebase hai transaction, field `dograh.*` lồng nhau; (TR-02) header attempt; lỗi tạm thời ở lần 1–4 → `retry` không ghi, lần 5/thiếu header → lưu `error` + mã; lỗi vĩnh viễn lưu ngay và báo host bị chặn; thành công sau đó xoá mã lỗi; allowlist mặc định/biến môi trường; (TR-03) transcript ready → `reviewStatus: pending` một lần, review đã hoàn tất không bị xếp lại |
| `review.test.mjs` | ID sai bị chặn trước transaction; auth/ownership/completion/transcript gates; chỉ tạo một review khi đang có request xử lý; kết quả đã lưu được dùng lại; quota/output lỗi đánh dấu failed và có thể thử lại; (TR-03) `pending` được claim; lease 3 phút (2:59 còn hiệu lực, 3:00 bị lấy lại, claim cũ không có thời gian coi như hết hạn); kết quả của claim đã bị lấy lại bị bỏ; review nền không cần user, cùng claim, không chạy lại review đã xong |
| `review.test.mjs` | (RV-01) ngữ cảnh review mang mục tiêu buổi học (phiên v1 không có); transcript chỉ có lượt tutor → `transcript_empty`; adapter Gemini chỉ lưu review v2 qua validator (bằng chứng bịa, thiếu từ, review v1, JSON hỏng → `invalid_output`), ánh xạ lỗi quota; prompt injection: transcript nằm trong khối dữ liệu, `</transcript>` của học viên bị vô hiệu; cắt transcript theo lượt; lỗi ghi completion không trả thành công |
| `review-v2.test.mjs` (RV-01) | Review v2 hợp lệ; so khớp trích dẫn (hoa/thường, dấu câu, nháy, cả từ); bằng chứng bịa ở mọi trường; mỗi từ/weak point đúng một lần; luật trạng thái; grammar focus; hình dạng và giới hạn; đọc review v1 và v2 đã lưu; neo CEFR |
| `api.test.mjs` | Gọi trực tiếp các route handler với Request/Response thật, mock auth/database/provider; kiểm tra HTTP status, userId từ auth; webhook: Bearer thiếu/sai/sai scheme/header cũ → 401 trước khi đọc body, ánh xạ ok/skipped/400/503/500, header attempt, review chỉ chạy qua `after()` sau khi trả lời; `maxDuration = 60` ở webhook và generate-review |
| `firebase-runtime.test.mjs` | Import Firebase Auth và lấy signing key từ RSA JWK thật mà không cần mạng, khi synchronous require(ESM) bị tắt |
| `session-pipeline.test.mjs` | Nối logic thật từ session → call → webhook v2 (redirect tới storage) → review nền → trang review lấy review đã lưu → đọc đúng chủ; dịch vụ ngoài và lưu trữ được giả lập |

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
- ~~Review bị ngắt sau khi đã claim processing chưa có lease/timeout phục hồi~~ — đã sửa ở TR-03
  (14/11/2026): claim là lease 3 phút (`reviewClaimedAt`), kết quả chỉ được ghi khi claim còn giữ.
- ~~Webhook đến trước khi session lưu run ID được ACK và bỏ qua~~ — đã sửa ở TR-01 (14/11/2026):
  webhook tìm phiên theo `session_id` và lưu run ID nếu còn thiếu.
- ~~Download lỗi được lưu error rồi ACK 200~~ — đã sửa ở TR-02 (14/11/2026): lỗi tạm thời trả 503 cho
  tới lần gửi cuối để Dograh gửi lại; lỗi lưu kèm mã `dograh.transcriptError`.
- Với triển khai public, phải đặt `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` gồm cả host storage thật của Dograh
  Cloud (mặc định chỉ có `app.dograh.com,api.dograh.com`). Từ TR-02, host bị chặn được ghi vào log
  `[dograh.webhook.download]` để tìm ra; chưa kiểm chứng với cuộc gọi thật.
- Browser báo run ID chưa tự chứng minh run thuộc người dùng; cần kiểm chứng
  ràng buộc tin cậy trước khi coi dữ liệu transcript là đã xác thực ownership nguồn.

Chưa kết luận sẵn sàng production khi các mục trên và E01–E13 chưa được xử lý/
kiểm chứng. Với mỗi lần chạy staging, bổ sung ngày, commit, sessionId, kết quả
thực tế và bằng chứng; không chuyển “Chưa chạy” thành “Đạt” từ kết quả mock.

## Bổ sung: sửa tải transcript Dograh local — 10/09/2026 (đã gỡ ở DC-02)

Mục này ghi nhận kiểm tra sau đợt baseline ở trên, với Dograh chạy bằng Docker trên
máy (API cổng 8000 → HTTP 302 → MinIO cổng 9000). Đợt sửa này thêm một chế độ tải
`local` (origin local được liệt kê, tối đa ba redirect, mỗi đích được kiểm tra trước
khi gửi request).

- Toàn bộ test lúc đó: **45/45 đạt**. Bộ tải đã tải thật transcript của Dograh run
  `33` (2.914 byte, 23 lượt nói), chỉ đọc Firestore, không ghi dữ liệu.
- Kiểm tra này không chứng minh webhook tự lưu thành công hay review Gemini hoàn tất.

**Ngày 14/11/2026 (DC-02):** stack Docker tự host và chế độ tải `local` đã bị xoá,
cùng các test của nó. FluentAI dùng Dograh Cloud; chính sách tải transcript chỉ còn
HTTPS tới host trong `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`. TR-02 thêm việc đi theo
redirect đã kiểm tra cho chính sách này.

## Bổ sung: review v2 với Gemini thật — 14/11/2026 (RV-01)

- Một lần gọi `gemini-3.5-flash-lite` thật với transcript **tổng hợp** trong
  `tests/helpers/fixtures.mjs` (phỏng vấn xin việc, B1, grammar focus "Past simple");
  không có dữ liệu người dùng. Kết quả `ok` sau 4,4 giây và qua validator đầy đủ:
  8/8 từ mục tiêu được chấm, weak point `still_present`, 4 kỹ năng có điểm,
  nhận xét có cả tiếng Anh và tiếng Việt.
- Lần đầu API trả 400 `INVALID_ARGUMENT`; thử từng phần schema cho thấy nguyên nhân
  là `minItems`/`maxItems`. Schema đã bỏ hai trường này, validator vẫn kiểm số lượng.
- Chưa kiểm chứng với transcript của cuộc gọi Dograh thật (E2E-01).
