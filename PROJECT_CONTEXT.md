# FluentAI — Project context

Cập nhật: 09/09/2026. Mục 3–7 đã đối chiếu code sau khi hủy tính năng transcript. “Đã triển khai” nghĩa là có code, không đồng nghĩa đã kiểm chứng production. Mục 8 giữ yêu cầu lịch sử để tham khảo, không dùng làm hiện trạng.

## 1. Mục tiêu

Xây dựng **FluentAI**, website luyện giao tiếp ngoại ngữ với AI. Người học chọn ngôn ngữ, chủ đề, trình độ, thời lượng và gia sư trước khi bắt đầu hội thoại bằng giọng nói.

- **Dograh AI:** thực hiện cuộc hội thoại luyện tập, quản lý voice agent và cung cấp transcript của buổi học.
- **Google Gemini:** đọc transcript sau buổi học để tạo nhận xét, sửa câu, gợi ý từ vựng và đề xuất bài luyện tiếp theo.
- **Firebase:** quản lý người dùng, phiên đăng nhập, hồ sơ và dữ liệu buổi luyện tập.

Luồng sản phẩm mong muốn:

```text
Đăng nhập → Chọn cấu hình → Tạo practice session → Hội thoại qua Dograh
         → Lưu transcript → Gemini tạo review → Xem kết quả và lịch sử
```

Hiện tại đã **tạo, đọc, phân quyền practice session và tích hợp Dograh voice widget** theo `sessionId`: Start/End, context bài học, timer, xử lý lỗi và lưu sự kiện cuộc gọi. Transcript và đánh giá AI chưa được tích hợp. Việc nghe/nói với agent và đối chiếu dữ liệu trên Firebase thật cần được kiểm chứng riêng; không suy ra từ unit test hoặc build.

## 2. Tech stack

Phiên bản dưới đây theo khai báo trong `package.json`; dấu `^` là khoảng phiên bản, còn `package-lock.json` khóa dependency khi cài đặt.

| Thành phần | Công nghệ | Vai trò hiện tại |
| --- | --- | --- |
| Runtime | Node.js `24.x`, npm | Khai báo qua `engines.node`; quản lý dependency bằng lockfile |
| Framework | Next.js `16.3.3`, App Router, Turbopack | Routing, Server Components, Server Actions, API Route Handler |
| UI | React / React DOM `19.2.8`, TypeScript `^5` | Component và kiểm tra kiểu; TypeScript bật `strict` |
| Styling | Tailwind CSS `^4`, `tw-animate-css` | Responsive layout, màu và token giao diện trong `app/globals.css` |
| UI primitives | shadcn `^4.19.0`, `@base-ui/react` `^1.7.0` | Các component trong `components/ui/` |
| Icon / tiện ích CSS | `lucide-react`, `clsx`, `class-variance-authority`, `tailwind-merge` | Icon, variants và ghép class |
| Firebase client | `firebase` `^12.18.0` | Email/password auth, reset mật khẩu, upload avatar |
| Firebase server | `firebase-admin` `^14.3.0` | Xác thực cookie, quản lý user, đọc/ghi Firestore |
| Cơ sở dữ liệu / file | Cloud Firestore, Firebase Storage | Hồ sơ, cấu hình buổi học và ảnh đại diện |
| Gemini | `@google/genai` `^2.18.0` | Mới khởi tạo client; chưa chọn model hoặc gọi tạo review |
| Voice AI | Dograh AI | Đã tích hợp widget; hàm server đọc run chưa nối vào nghiệp vụ |
| Kiểm tra | ESLint `^9`, Node.js test runner | Lint, Firebase runtime, validation và phân quyền session |
| Dependency patch | `patch-package` `8.0.1`, `jwks-rsa` override `4.1.0` | Vá cách nạp ESM của `jose` khi cài dependency |
| Nền tảng deploy | Vercel | Mục tiêu triển khai Next.js; cấu hình thực tế trên dashboard không nằm trong repo |

Font hiện tại là **Inter**, được tải qua `next/font/google`. Alias import `@/*` trỏ đến root của dự án.

Theo `AGENTS.md`, trước khi sửa code Next.js cần đọc hướng dẫn tương ứng trong `node_modules/next/dist/docs/` của phiên bản đang cài.

## 3. Các file cần đọc khi lên kế hoạch

| Khu vực | File chính |
| --- | --- |
| Auth / Firebase | `lib/actions/auth.action.ts`, `firebase/{admin,client}.ts`: đăng nhập, cookie, hồ sơ và database |
| Tạo buổi học | `components/fluent/home-practice-setup.tsx` → `app/api/practice-setup/route.ts` |
| Domain / phân quyền | `lib/practice/session.ts`: config, types, validators; `read-session.ts`: ownership và DTO; `server.ts`: adapter Firebase |
| Trạng thái call | `lib/practice/call-state.ts`, `app/api/practice-session/[sessionId]/call-event/route.ts`: validation và transaction |
| Dograh widget | `components/fluent/use-dograh-widget.ts`, `public/dograh-frame.html`: tải widget và context; `lib/dograh/widget.ts`: hợp đồng API; `call.ts`: controller cuộc gọi |
| Đọc run | `lib/dograh/server.ts`: `getDograhRun()` server-only, chưa được luồng nghiệp vụ gọi |
| Voice / review | `app/(root)/{voice-call,review}/page.tsx`, `components/fluent/voice-call-experience.tsx` |
| Gemini / runtime | `lib/ai/gemini.ts`, `package.json`, `patches/jwks-rsa+4.1.0.patch` |

Dùng App Router tại `app/`, không có backend riêng. Không còn `firebase/admin-app.ts`, webhook, worker hoặc API transcript sau khi hủy tính năng. **Mục 8 là yêu cầu lịch sử; ưu tiên mục 3–7 và code thực tế khi lập kế hoạch.**

## 4. Biến môi trường và cấu hình

| Biến được code đọc | Nơi dùng |
| --- | --- |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | `firebase/admin.ts`, chỉ phía server |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `lib/ai/gemini.ts`, client Gemini của ứng dụng |
| `DOGRAH_API_KEY`, `DOGRAH_WORKFLOW_ID` | `lib/dograh/server.ts`, header `X-API-Key` và workflow khi đọc run |
| `NEXT_PUBLIC_DOGRAH_WIDGET_SRC` | Hook widget, URL script embed có token, được đưa ra browser |
| `NODE_ENV` | Cookie dùng `secure` ở production |

Firebase browser config viết trực tiếp trong `firebase/client.ts`, chưa dùng `NEXT_PUBLIC_FIREBASE_*`. Không ghi secret vào tài liệu. Credential Gemini của ứng dụng và credential LLM trong Dograh là hai cấu hình riêng.

Widget yêu cầu **Voice / Headless / Auto start tắt**, microphone và HTTPS hoặc localhost. `getDograhRun()` đang cố định host `https://app.dograh.com`; chưa hỗ trợ `DOGRAH_API_BASE_URL`, chưa có `DOGRAH_WEBHOOK_SECRET`. Nếu widget dùng Dograh local/self-hosted, cần thống nhất backend trước khi nối đọc run. Prompt, template variables và STT/TTS/LLM được cấu hình phía Dograh, không nằm trong repo.

## 5. Đã triển khai

- **Auth:** đăng ký/đăng nhập email-password, reset mật khẩu, avatar, hồ sơ `users/{uid}`; cookie `fluentai_session` 7 ngày, kiểm tra thu hồi và bảo vệ route.
- **Session:** chọn 6 ngôn ngữ, 6 chủ đề, `Beginner/A1/A2/B1/B2`, `5/10/15` phút, tutor Emma. POST setup validate giá trị và tạo document; voice/review đọc theo `?sessionId=...`, kiểm tra ownership trước khi trả DTO allowlist.
- **Context:** hook truyền `{ language, topic, level, tutor_name, duration_minutes }` qua `data-dograh-context` và `setContext()` trước Start. Repo không tự build request `context_variables`; script widget xử lý request đến Dograh.
- **Cuộc gọi:** Start trực tiếp trong click; connected cần run ID hợp lệ; End/hết giờ dừng widget. Có timer, timeout, lỗi mic/offline, cleanup iframe, gửi event tuần tự và retry có giới hạn. Chuyển review khi kết thúc bình thường và lưu thành công; không resume session active/connecting khi refresh.
- **Lưu trạng thái:** call-event nhận `connecting/connected/disconnected/error`; kiểm tra auth, ownership và transition trong Firestore transaction. Server tạo timestamp, event lặp hợp lệ không ghi lại; session terminal không mở lại.

Schema tại `practiceSessions/{sessionId}`:

```text
userId, language:{id,name}, topic:{id,name}, level, durationMinutes,
tutor:{id,name,role}, status, createdAt, updatedAt
dograh?: {workflowRunId, agentId?, startedAt?, endedAt?, durationSeconds?, endReason?}
```

Luồng chính `ready → connecting → active → completed`; lỗi có thể chuyển `failed`. `completed/failed` là terminal; `ending` chỉ là trạng thái UI. Chỉ lưu `dograh` khi có run ID; timestamp call là ISO UTC, timestamp document dùng Firestore server timestamp.

**Kiểm chứng:** lượt rollback trước đã chạy build và lint các file liên quan thành công. Hiện ba script `test:*` trong `package.json` trỏ đến file test không còn trong workspace; các số lượng test/pass ở tài liệu cũ không đại diện cho hiện trạng. Lượt cập nhật tài liệu này chỉ đọc code, không chạy lại kiểm thử hoặc gọi dịch vụ.

## 6. Phần thiếu và giới hạn

| Phần | Cần giải quyết |
| --- | --- |
| Độ tin cậy của call | Run ID/thời lượng do browser báo; chưa xác minh run thuộc session. Đóng tab/mất mạng có thể để session kẹt; `completed` chưa chứng minh pipeline Dograh thành công |
| Transcript / đồng bộ | Implementation trước đã hủy: không webhook, job/worker, parser, retry, lưu/đọc transcript hay token liên kết session–run |
| Context / provider | Context được gửi không chứng minh prompt render đúng; cần đối chiếu workflow thực tế. Chưa có xử lý nghiệp vụ riêng cho quota/429 phía Dograh |
| Gemini / review | Chỉ khởi tạo Gemini client; chưa có model, prompt, schema kết quả hoặc pipeline. Review hiển thị trạng thái và placeholder |
| Lịch sử / UI phụ | Recent practice và tiến độ là dữ liệu mẫu; link card `/review` thiếu ID. Chưa có mute/repeat, lịch sử thật hoặc luyện lại từ cấu hình cũ |
| Test / hạ tầng | Thiếu các file test được scripts tham chiếu; không có Firebase rules/indexes, `firebase.json` hoặc CI trong repo. Cấu hình ngoài repo và hành trình end-to-end cần kiểm chứng riêng |

Chưa có code lưu transcript/review vào Firestore. Không chấm phát âm từ transcript văn bản; cần dữ liệu âm thanh và phương pháp đánh giá phù hợp.

## 7. Thứ tự đề xuất cho kế hoạch tiếp theo

1. **Chốt môi trường Dograh:** xác định local/cloud và workflow đang chạy; kiểm tra prompt/context, callback, API run, transcript và webhook trên phiên bản thực tế. Ưu tiên run có sẵn; phân biệt quota với lỗi prompt.
2. **Thiết kế vòng đời và liên kết run:** xác minh session–run phía server, giữ ownership và tương thích session cũ; phân biệt trạng thái browser, kết quả provider và đồng bộ. Xác định phục hồi khi mất callback/đóng tab.
3. **Lập kế hoạch transcript:** webhook có xác thực, đối soát/retry bền vững, chống xử lý trùng, schema/giới hạn dung lượng, transcript một phần/rỗng/lỗi và API chỉ chủ session được đọc. Chốt địa chỉ callback Dograh truy cập được và nơi chạy worker nếu cần. Đây là tính năng cần thiết kế lại.
4. **Review rồi lịch sử:** khi transcript đáng tin cậy, định nghĩa Gemini output có schema, trạng thái xử lý/thất bại, retry và lưu kết quả; sau đó thay dữ liệu mẫu bằng session thật, phân trang và link đúng ID.
5. **Kiểm thử và triển khai:** khôi phục test phù hợp; kiểm tra ownership, callback lặp/sai thứ tự, quota, partial transcript, mất mạng và restart. Chạy lint/build/test, kiểm chứng dịch vụ thật; quản lý rules/indexes và cấu hình deploy theo kiến trúc đã chọn.

Mỗi bước cần phạm vi file, schema/API, tiêu chí hoàn thành và cách kiểm chứng. Giữ luồng auth, tạo session và widget hiện có; không coi kế hoạch này là chức năng đã triển khai.

## 8. Prompt triển khai mục 3, đã đối chiếu codebase

Nội dung dưới đây giữ nguyên yêu cầu và hiện trạng trước khi triển khai để đối chiếu. Hiện trạng mới nhất và phần đã làm nằm ở mục 5; không coi mọi yêu cầu dưới đây là đã hoàn thành. Hợp đồng widget còn thiếu; không có danh sách “6 phương thức đã liệt kê ở trên” trong repo hoặc nội dung yêu cầu đã cung cấp.

### Mục tiêu và phạm vi

Hoàn thành mục 3: người dùng gọi voice thật qua Dograh ngay trên `/voice-call?sessionId=...`, với cấu hình session đã lưu, và liên kết run vào đúng `practiceSessions/{sessionId}`. Chỉ chuẩn bị hàm server đọc run để verify/debug sau này. Không triển khai lưu transcript, webhook, Gemini review, lịch sử hoặc deploy.

Đọc `AGENTS.md`, tài liệu Next.js tương ứng trong `node_modules/next/dist/docs/` và các file thực tế trước khi sửa. Giữ các thay đổi đang có trong working tree. Không refactor ngoài phạm vi.

### Hiện trạng phải dựa vào

- `lib/practice/session.ts`: config/domain/validator thuần TypeScript; `PracticeSession` là DTO có whitelist, hiện chỉ nhận `status: "ready"`, không chứa ownership hoặc Firestore Timestamp.
- `lib/practice/read-session.ts`: `readPracticeSession()` nhận các dependency `getUser`, `readDocument`, `onError`; kiểm tra đăng nhập, ID và ownership trước khi parse. Session không tồn tại và session của người khác cùng trả `not_found`.
- `lib/practice/server.ts`: adapter `server-only`, cung cấp Firebase và `getCurrentUser()` cho logic trên. Không có hàm cập nhật cuộc gọi.
- `app/api/practice-setup/route.ts`: POST dùng `getCurrentUser()` và `user.id`, validate JSON, ghi session mới với timestamp server. Không nhận user ID từ browser.
- Hai page voice-call/review là Server Components, await `searchParams`, đọc session qua server; voice page truyền `{ session, learner }` xuống Client Component.
- `voice-call-experience.tsx` chưa có Start Call hoặc End Call. Có ba nút Microphone/Speaker/Repeat disabled và link **View review**. Phải thêm controls cuộc gọi mới, không mô tả là bật lại nút Start hoặc sửa nút End sẵn có.
- `session-access-notice.tsx` chỉ nhận `SessionAccessFailure`, tự render `<main>`. Muốn tái sử dụng cho lỗi cuộc gọi cần mở rộng props/type có chủ đích và tránh lồng hai `<main>`.
- `components/fluent/types.ts` chứa kiểu UI; chưa có khai báo widget.
- Review đang có câu “This session has no conversation or assessment yet” và “There is no recorded conversation for this session”. Khi nối call thật cần sửa câu chữ này; chưa có transcript không có nghĩa chưa có cuộc gọi.
- `tests/practice-session.test.mjs` có 12 test dùng `node:test`, `node:assert/strict`, import trực tiếp module `.ts` thuần và dependency giả lập. Một test hiện coi `completed` là dữ liệu hỏng; phải đổi sang status không hợp lệ khi mở rộng union.

### Điều kiện trước khi viết tích hợp widget

Yêu cầu người dùng cung cấp hợp đồng Dograh còn thiếu: URL/version script hoặc embed snippet công khai, các thuộc tính khởi tạo cần thiết, tên và chữ ký phương thức thực có, cách đăng ký/hủy callback, payload connected/disconnected/error, nơi nhận run ID và cách phân biệt lỗi microphone. Làm rõ các key context được workflow thực sự sử dụng.

Không tự tạo tên phương thức/sự kiện/field Dograh, không giả định `Window.DograhWidget` có đúng sáu phương thức. Nếu hợp đồng chưa được cung cấp hoặc xác minh, dừng phần widget và hỏi một lần đầy đủ; vẫn có thể hoàn thành domain, API nội bộ và test không phụ thuộc hợp đồng. Không tuyên bố hoàn thành voice thật khi điều kiện này còn thiếu.

Endpoint đọc run do yêu cầu cung cấp là `GET https://app.dograh.com/api/v1/workflow/{DOGRAH_WORKFLOW_ID}/runs/{runId}`, header `X-API-Key`. Đây chưa phải kết quả kiểm chứng endpoint bằng dịch vụ thật.

### 1. Domain và validator

Trong `lib/practice/session.ts`, mở rộng status thành `"ready" | "connecting" | "active" | "completed" | "failed"`, giữ document cũ `ready` hợp lệ. Thêm:

```ts
dograh?: {
  workflowRunId: number;
  agentId?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  endReason?: "user_ended" | "mic_denied" | "network_error" | "dropped";
};
```

Cập nhật type và validator cùng lúc. Validate run ID là số nguyên dương an toàn, duration hữu hạn không âm, timestamp là chuỗi ISO hợp lệ, string và enum đúng kiểu. DTO chỉ chọn các field được phép; không chuyển nguyên object `dograh` từ Firestore sang browser.

`dograh` chỉ được tạo khi có run ID hợp lệ. Nếu từ chối mic/lỗi trước khi có run ID, ghi `status: "failed"`, giữ `dograh` vắng mặt; không tạo ID giả để lưu endReason. Hiển thị nguyên nhân lỗi ở client. Không thêm field lưu lỗi mới ngoài schema trong lượt này.

### 2. Credential server-side

Tạo `lib/dograh/server.ts` với `import "server-only"`. Viết `getDograhRun(runId: number)` dùng endpoint và header đã cung cấp; validate ID/config, có timeout và xử lý HTTP lỗi, không cache kết quả dùng cho verify. Trả dữ liệu chưa parse dưới kiểu `unknown` cho caller server; không tạo API proxy trả raw run cho browser, không parse/lưu transcript.

Chỉ module server đọc `DOGRAH_API_KEY`. Không đưa key vào URL, response, log, Client Component hay biến `NEXT_PUBLIC_*`; không chuyển tiếp lỗi provider nguyên văn. Không yêu cầu người dùng gửi secret qua chat.

### 3. Cập nhật trạng thái và phân quyền

Thêm `updatePracticeSessionCallState(sessionId, userId, update)` trong `lib/practice/server.ts`. `userId` chỉ do route lấy từ `getCurrentUser().id`; không phải field request. Tái sử dụng logic kiểm tra ID/ownership hiện có, tách phần thuần hoặc dependency injection để test không cần Firebase. Được thêm `lib/practice/call-state.ts` cho phần này và sửa `read-session.ts` nếu cần chia sẻ logic nhỏ.

Các event dưới đây là **API nội bộ FluentAI**, không phải tên sự kiện Dograh. Reject field dư/sai kiểu bằng whitelist theo event:

| Event | Field ngoài `event` được phép |
| --- | --- |
| `connecting` | Không có |
| `connected` | `workflowRunId` bắt buộc; `agentId` optional, chỉ gửi nếu nguồn Dograh đã xác minh cung cấp |
| `disconnected` | `durationSeconds` bắt buộc; `endReason` optional thuộc `user_ended/network_error/dropped` |
| `error` | `endReason` bắt buộc thuộc `mic_denied/network_error/dropped` |

Client không được gửi trực tiếp `status`, `userId`, `dograh`, `startedAt`, `endedAt`, `createdAt`, `updatedAt` hoặc cấu hình bài học. Server tự tạo patch và timestamp; không merge nguyên body. Thời lượng client gửi chỉ là báo cáo client đã validate, không phải thời lượng được Dograh xác thực.

Luồng chính: `ready → connecting → active → completed`. `error` chuyển `ready/connecting/active` sang `failed`; disconnect bất thường chuyển sang `failed`; disconnect bình thường từ `active` chuyển `completed`. Khi hủy lúc connecting chưa có run, kết thúc ở `failed`, không giả lập completed. Nếu không xác định được lý do kết thúc bình thường, không tự gán `user_ended`; timer hết giờ có thể để endReason vắng mặt vì enum chưa có lý do timeout.

`completed` và `failed` là terminal trong lượt này; không mở lại hoặc thay run ID. Event lặp hợp lệ phải không đổi timestamp/run ID; event mâu thuẫn hoặc đến trễ không được làm lùi trạng thái. Kiểm tra ownership, trạng thái và ghi patch trong Firestore transaction để tránh race giữa nhiều request/tab; không chỉ gọi get rồi update riêng biệt.

Run ID do browser báo chưa chứng minh run thuộc session/người dùng. Ghi rõ giới hạn này; whitelist và ownership chỉ bảo vệ document của tài khoản khác. Việc verify nguồn run đáng tin cậy thuộc bước sau, không tuyên bố đã hoàn thành chỉ vì có `getDograhRun()`.

### 4. Route API

Tạo `app/api/practice-session/[sessionId]/call-event/route.ts`, runtime Node.js. Dùng auth giống practice-setup và dynamic params đúng tài liệu Next.js đang cài. Parse body dưới kiểu `unknown`; gọi adapter phía server.

Trả 401 nếu chưa đăng nhập; 404 chung cho session thiếu/khác chủ; 400 cho ID/body không hợp lệ; 409 cho transition xung đột; 500 cho lỗi dịch vụ với thông báo an toàn. Response không chứa document thô, secret hoặc lỗi provider. Không cho request tạo document session mới.

### 5. Widget và UI, sau khi có hợp đồng

Khai báo `Window.DograhWidget` optional và payload trong `components/fluent/types.ts` đúng hợp đồng đã xác minh. Tạo `components/fluent/use-dograh-widget.ts`: load script từ `NEXT_PUBLIC_DOGRAH_WIDGET_SRC` một lần, tái sử dụng script có sẵn, poll đến khi widget sẵn sàng với timeout hữu hạn. Xử lý thiếu config, script lỗi, timeout, sync throw và Promise rejection; cleanup timer/listener theo API thực, chịu được Strict Mode và remount.

Hook cung cấp `status`, `error`, `setContext`, `start`, `end` cùng cơ chế đăng ký `onCallConnected`, `onCallDisconnected`, `onError` rõ ràng. Đây là interface nội bộ của hook, không mặc định là chữ ký widget.

Trong `voice-call-experience.tsx`:

- Chuẩn bị context từ session ngay khi có props; áp dụng ngay khi widget sẵn sàng, trước khi cho Start. Mapping dự kiến là `{ language: session.language.name, topic: session.topic.name, level: session.level, tutor_name: session.tutor.name, duration_minutes: session.durationMinutes }`; chỉ truyền khi hợp đồng xác nhận các key này được hỗ trợ. Không tự đổi cấu hình workflow ngoài repo.
- Thêm nút Start Call. Gọi `start()` trực tiếp, đồng bộ trong click handler, không await HTTP/load script trước đó để giữ user gesture. Chặn bấm lặp và không tự start từ effect. Tuần tự hóa POST event để `connecting` được xử lý trước `connected/error` dù callback đến ngay.
- Connected: lấy run ID thật từ callback đã xác minh, POST `connected`, bắt đầu timer theo `durationMinutes` tính từ lúc kết nối. Không dùng session ID làm run ID.
- Thêm End Call gọi `end()` thật. Timer hết giờ cũng gọi `end()`. Luồng kết thúc bình thường chỉ điều hướng một lần trong handler disconnected sau khi xử lý POST; bỏ đường View review có thể rời trang trong khi call còn chạy.
- Disconnected: clear timer, tính/gửi duration, phân loại kết thúc, xử lý event lặp và chuyển `/review?sessionId=...` cho cuộc gọi kết thúc bình thường. Lỗi mic/kết nối phải giữ thông báo đủ rõ, không redirect ngay làm mất lỗi.
- Mở rộng `session-access-notice.tsx` cho lỗi mic và lỗi cuộc gọi khác, giữ tương thích các page đang dùng; không tạo UI lỗi trùng hoặc lồng `<main>`.
- Có timeout cho connecting và chờ disconnected, xử lý offline và POST thất bại; không treo UI hoặc để unhandled rejection. Thử đồng bộ lại có giới hạn khi phù hợp, không báo “đã lưu” khi request thất bại. Khi browser mất mạng hoàn toàn/đóng tab, không thể bảo đảm Firestore nhận event ngay; ghi rõ giới hạn thay vì thêm webhook/polling server ngoài phạm vi.
- Cleanup cuộc gọi theo API được xác minh khi rời trang; callback cũ không được ghi sang session mới. Session terminal không được Start lại. Không giả lập resume call khi refresh session active/connecting mà không có kết nối widget thật.
- Microphone/Speaker/Repeat chỉ được bật nếu API thực hỗ trợ; không giả lập hoạt động. Giữ phần transcript ở trạng thái chưa tích hợp.

Trong `app/(root)/review/page.tsx`, chỉ sửa thông báo để phân biệt trạng thái cuộc gọi và chưa có transcript/review; không triển khai nội dung đánh giá hoặc pipeline mục 4/5.

### 6. Phạm vi file và kiểm thử

Được sửa: `lib/practice/session.ts`, `lib/practice/server.ts`, `lib/practice/read-session.ts` nếu cần chia sẻ logic, `components/fluent/types.ts`, `components/fluent/voice-call-experience.tsx`, `components/fluent/session-access-notice.tsx`, `app/(root)/review/page.tsx`, `tests/practice-session.test.mjs`, `PROJECT_CONTEXT.md`.

Được thêm: `lib/dograh/server.ts`, `lib/practice/call-state.ts`, `components/fluent/use-dograh-widget.ts`, `app/api/practice-session/[sessionId]/call-event/route.ts`. Giữ cấu trúc thư mục, dependencies, auth, Firebase runtime patch và luồng tạo session hiện có.

Giữ ý nghĩa của 12 test hiện tại; đổi case `completed` không hợp lệ sang giá trị ngoài union. Bổ sung test cho mọi status, dograh hợp lệ/sai kiểu/field dư bị loại khỏi DTO, whitelist từng event, sai chủ, ID sai, terminal, event lặp/mâu thuẫn, giữ run ID, lỗi trước run, timestamp không bị reset và lỗi lưu. Test logic cập nhật với dependency đọc/ghi/clock giả lập; không import Firebase hoặc `server-only` trực tiếp vào Node test thuần. Kiểm thử route auth riêng bằng dữ liệu giả lập khi có thể.

Chạy và báo kết quả thực tế:

```sh
npm run test:practice-session
npm run test:firebase-runtime
npm run lint
npm run build
```

Kiểm chứng browser/dịch vụ thật: Start yêu cầu mic khi quyền chưa cấp; nghe và nói được với Dograh; agent dùng đúng cấu hình; callback run ID khớp field Firestore; từ chối mic không treo; mất mạng không crash; End/timer dừng audio trước điều hướng; không có API key trong bundle hoặc Network; tài khoản B POST vào session A nhận 404 và document A không đổi.

Không đánh dấu tiêu chí dịch vụ thật đã pass dựa trên mock hoặc build. Nếu thiếu tài khoản, cấu hình hoặc quyền thao tác mic, ghi rõ test nào chưa chạy và cần người dùng kiểm chứng. Cập nhật các mục hiện trạng trong PROJECT_CONTEXT.md theo phần thực sự đã triển khai, tách kết quả tự động khỏi kiểm chứng thủ công và ghi chú verify run cho bước sau.
