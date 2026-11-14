# Dograh Cloud cho FluentAI

FluentAI dùng **Dograh Cloud** (https://app.dograh.com) cho cuộc gọi giọng nói, ở cả bản phát triển
(`localhost:3000`) lẫn bản production (https://real-time-voice-agent-language-prac-one.vercel.app).

- **Đặc tả workflow** (node, prompt, biến, điều kiện chuyển, webhook) nằm ở [`workflow-spec.md`](workflow-spec.md).
- Stack Docker tự host trước đây đã bị xoá ở DC-02. Nếu máy vẫn còn container hoặc volume cũ của nó, có thể xoá
  bằng Docker Desktop; FluentAI không dùng tới.

## 1. Chuẩn bị

1. Đăng nhập https://app.dograh.com.
2. Cấu hình provider LLM, STT và TTS. Có thể dùng provider có sẵn của Dograh hoặc key của bạn. STT chọn tiếng Anh.
3. Tạo một **API key** trong dashboard. Thêm vào `.env.local` ở thư mục gốc FluentAI:

   ```dotenv
   DOGRAH_API_BASE_URL=https://app.dograh.com
   DOGRAH_API_KEY=<API key>
   ```

   Hai biến này chỉ dùng cho script import/export ở máy. **Không** đặt chúng trên Vercel.

## 2. Tạo 2 workflow (American, British)

**Cách nhanh: import qua API.**

1. `npm run dograh:seed`: dựng `workflows/fluentai-tutor.seed.json` từ đặc tả.
2. Import hai lần:
   - `npm run dograh:import -- "FluentAI Tutor - American"`
   - `npm run dograh:import -- "FluentAI Tutor - British"`

   Nếu lệnh báo 404 hoặc 401, API của Dograh Cloud có thể nằm ở một địa chỉ khác `https://app.dograh.com/api/v1`.
   Khi đó, gửi cho tôi mã lỗi (không gửi key), rồi tạm làm theo cách thủ công.

**Cách thủ công:** tạo node và edge trên dashboard đúng như `workflow-spec.md`, rồi dán từng khối prompt.

## 3. Cấu hình từng workflow

Làm theo mục "Per-workflow settings" của đặc tả:

1. **Models:** TTS chọn giọng American cho workflow American, giọng British cho workflow British. Tốc độ để
   mặc định.
2. **Credential:** tạo một credential `bearer_token` tên `FluentAI webhook`. Giá trị đúng bằng
   `DOGRAH_WEBHOOK_SECRET` đã đặt trên Vercel. Chọn credential này trong node `Send transcript to FluentAI` của
   cả hai workflow.
   - Endpoint của node đã có sẵn trong seed:
     `https://real-time-voice-agent-language-prac-one.vercel.app/api/dograh/transcript-webhook`.
   - Seed mới (từ TR-01) để node ở `Enabled: on`. Với workflow đã import trước đó, **chỉ bật node sau khi
     bản có TR-01 đã chạy trên production** và `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` đã đặt trên Vercel (xem §5).
     Lần gửi trước thời điểm đó nhận 401 và Dograh không gửi lại.
3. **Thời lượng tối đa của cuộc gọi:** nếu Dograh Cloud có cài đặt này, đặt 20 phút.
4. **Publish** workflow.
5. **Embed:** chọn Voice, Headless, tắt Auto start.
   - Allowed domains: `real-time-voice-agent-language-prac-one.vercel.app` và `localhost:3000`.
   - Copy nguyên URL script trong hộp thoại embed (dạng `https://app.dograh.com/embed/dograh-widget.js?token=…`).

## 4. Nối FluentAI với Dograh Cloud

Tên biến **không** có tiền tố `NEXT_PUBLIC_`. Biến chỉ nằm ở server, nên token không lọt vào JS công khai (DG-05).

1. **Vercel:** Settings → Environment Variables, thêm cho Production và Preview, rồi **Redeploy**:

   ```dotenv
   DOGRAH_WIDGET_SRC_AMERICAN=<URL script của workflow American>
   DOGRAH_WIDGET_SRC_BRITISH=<URL script của workflow British>
   ```

2. **`.env.local`:**
   - thêm hai biến trên;
   - **xoá** `NEXT_PUBLIC_DOGRAH_WIDGET_SRC`, `NEXT_PUBLIC_DOGRAH_WIDGET_SRC_AMERICAN`,
     `NEXT_PUBLIC_DOGRAH_WIDGET_SRC_BRITISH` và các biến của chế độ tải transcript `local` cũ (nếu còn);
   - khởi động lại `npm run dev`.

   URL copy từ hộp thoại embed của Dograh Cloud đã có sẵn `apiEndpoint=https://api.dograh.com` (ghi nhận
   2026-11-14), nên không cần thêm gì. Nếu một URL không có tham số này và cuộc gọi từ `localhost:3000` gọi tới
   `http://localhost:8000` (xem DevTools → Network), thêm `&apiEndpoint=https://api.dograh.com` vào giá trị
   trong `.env.local`.

## 5. Kiểm tra (DC-01) và gửi lại kết quả

1. Trên bản production, tạo một phiên accent American và gọi thử. Widget phải tải được, và cuộc gọi chuyển
   sang `completed`.
2. Lặp lại với accent British, rồi lặp lại cả hai trên `localhost:3000`.
3. Trong DevTools → Network, request `/api/v1/public/embed/init` phải có `context_variables` với
   `session_id` và đủ 18 khoá.
4. **Host lưu trữ transcript.** Sau cuộc gọi thật đầu tiên trên production (node webhook đã bật):
   - Vercel → project → **Logs**, lọc `dograh.webhook.download`. Dòng
     `{code: "redirect_rejected", host: "…"}` (hoặc `untrusted_url`) cho biết **tên host** cần cho phép — chỉ
     có tên host, không có URL ký.
   - Đặt trên Vercel `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS=app.dograh.com,api.dograh.com,<host đó>`, rồi **Redeploy**.
   - Gửi lại webhook của run đó bằng `curl`, header `Authorization: Bearer <DOGRAH_WEBHOOK_SECRET>`, body
     `{"session_id": "<id phiên>", "workflow_run_id": "<run>", "transcript_url": "<dograh.transcriptUrl đã lưu>"}`
     (lấy từ Firestore). Phiên phải chuyển sang `dograh.transcriptStatus: ready`.
   - Cách khác: trong dashboard, mở run và tải transcript; host là tên miền của địa chỉ cuối cùng sau khi trình
     duyệt chuyển hướng.
5. Gửi cho tôi:
   - host của request `/embed/init` (dự kiến `api.dograh.com`, vì URL embed đã có `apiEndpoint`);
   - host lưu trữ transcript (bước 4);
   - Dograh Cloud có giới hạn chi tiêu hoặc thời lượng cuộc gọi tối đa không.

   Tôi sẽ ghi các thông tin này vào `context/api-contracts.md` → "Observed on Dograh Cloud".
6. **Export:** `npm run dograh:export -- <workflowId> fluentai-tutor-american` (làm tương tự cho British).
   File export không chứa credential, token hay key, nên được commit vào `workflows/`.

## Sự cố thường gặp

- **Widget báo "Domain not allowed":** domain đang mở chưa có trong allowed domains của embed token. Preview
  deployment của Vercel không được thêm vào, vì vậy chỉ gọi được trên production và `localhost:3000`.
- **`/voice-call` báo "Voice calling is not configured":** thiếu `DOGRAH_WIDGET_SRC_*`. Trên Vercel, nhớ redeploy
  sau khi thêm biến. Ở máy, nhớ khởi động lại `npm run dev`.
- **Widget gọi `localhost:8000` khi chạy local:** xem bước 4.2.
- **Import báo 401:** kiểm tra `DOGRAH_API_KEY`. **Báo 404:** kiểm tra `DOGRAH_API_BASE_URL` (xem mục 2).
