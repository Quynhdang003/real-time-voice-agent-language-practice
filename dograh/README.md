# Dograh của FluentAI (tự host, local)

Stack Dograh **1.50.0** riêng cho FluentAI, tách khỏi stack của ai-companion. Image được ghim theo cả tag lẫn
digest trong `docker-compose.yml`.

| Thành phần | URL trên máy | Ghi chú |
|---|---|---|
| Dashboard (UI) | http://localhost:3020 | Tạo tài khoản, workflow, credential, embed token |
| API | http://localhost:8020 | Widget gọi `/api/v1/public/embed/init`; link transcript bắt đầu bằng URL này |
| MinIO | http://localhost:9020 (console 9021) | Link transcript redirect 302 sang đây (ký 1 giờ) |

Các cổng không trùng với ai-companion (3010/8010/9000), nên hai stack chạy song song được. Next.js của FluentAI
chạy trên host tại `localhost:3000`; Dograh trong Docker gọi webhook qua `http://host.docker.internal:3000`.

> **Cảnh báo:** `docker compose -f dograh/docker-compose.yml down -v` (có `-v`) xóa **toàn bộ** workflow, run,
> credential và recording. Lệnh `npm run dograh:down` (không có `-v`) giữ nguyên dữ liệu. Hãy backup trước
> mỗi lần nâng cấp hoặc dọn Docker.

## 1. Khởi động lần đầu

1. Tạo `dograh/.env` từ `dograh/.env.example` (file này đã được git ignore) và điền `DOGRAH_JWT_SECRET`.
   Trong PowerShell có thể sinh giá trị bằng:
   `-join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })`
2. `npm run dograh:up`. Lệnh chờ tới khi cả 5 container healthy, mất khoảng 1 phút.
3. Kiểm tra http://localhost:8020/api/v1/health trả 200.
4. Mở http://localhost:3020 và đăng ký tài khoản đầu tiên.
5. Đặt `DOGRAH_ENABLE_SIGNUP=false` trong `dograh/.env`, rồi chạy lại `npm run dograh:up`.
6. Trong dashboard, cấu hình provider (LLM, STT, TTS) bằng key của bạn.

## 2. Tạo 2 workflow (American, British)

Đặc tả đầy đủ (node, prompt, biến, điều kiện chuyển, webhook) nằm ở [`workflow-spec.md`](workflow-spec.md).

**Cách nhanh, import qua API:**

1. Trong dashboard, tạo một API key, rồi đặt `DOGRAH_API_KEY=<key>` (và `DOGRAH_API_BASE_URL=http://localhost:8020`)
   trong `.env.local` ở thư mục gốc FluentAI.
2. Chạy `npm run dograh:seed` để dựng `dograh/workflows/fluentai-tutor.seed.json` từ đặc tả.
3. Chạy hai lần import:
   - `npm run dograh:import -- "FluentAI Tutor - American"`
   - `npm run dograh:import -- "FluentAI Tutor - British"`

**Cách thủ công:** tạo node và edge trên dashboard đúng như `workflow-spec.md`, rồi dán từng khối prompt.

**Sau đó, với mỗi workflow:** làm các bước trong mục "Per-workflow settings" của đặc tả.

1. **Models:** STT tiếng Anh. TTS chọn giọng American cho workflow American và giọng British cho workflow
   British; tốc độ để mặc định.
2. **Credential:** tạo một credential `bearer_token` có giá trị đúng bằng `DOGRAH_WEBHOOK_SECRET` của FluentAI, rồi
   chọn nó trong node `Send transcript to FluentAI`.
   **Giữ node này ở trạng thái `Enabled: off` cho tới khi FluentAI hoàn thành TR-01.**
3. **Publish** workflow.
4. **Embed:** chọn Voice, Headless, tắt Auto start, allowed domain `localhost:3000`. URL script phải có dạng
   `http://localhost:3020/embed/dograh-widget.js?token=<token>&apiEndpoint=http://localhost:8020`.
   Thiếu `apiEndpoint` thì widget gọi nhầm sang cổng 8000.
5. **Export:** `npm run dograh:export -- <workflowId> fluentai-tutor-american` (tương tự cho british), rồi commit
   file trong `dograh/workflows/`. File export không chứa credential, token hay key.

## 3. Nối FluentAI với stack mới

Cập nhật `.env.local` theo [`../.env.example`](../.env.example), rồi **khởi động lại** `npm run dev`:

```dotenv
NEXT_PUBLIC_DOGRAH_WIDGET_SRC_AMERICAN=http://localhost:3020/embed/dograh-widget.js?token=<token American>&apiEndpoint=http://localhost:8020
NEXT_PUBLIC_DOGRAH_WIDGET_SRC_BRITISH=http://localhost:3020/embed/dograh-widget.js?token=<token British>&apiEndpoint=http://localhost:8020
DOGRAH_WEBHOOK_SECRET=<cùng giá trị với credential bearer_token>
DOGRAH_TRANSCRIPT_MODE=local
DOGRAH_TRANSCRIPT_LOCAL_ORIGINS=http://localhost:8020,http://localhost:9020
```

- Xóa biến cũ `NEXT_PUBLIC_DOGRAH_WIDGET_SRC`, vì nó trỏ tới quick tunnel đã chết và không còn được đọc.
- Kiểm tra:
  1. Tạo một phiên có accent American và gọi thử: widget tải được, cuộc gọi chuyển `completed` và có
     `workflowRunId`.
  2. Lặp lại với British.
  3. Trong DevTools → Network, request `/api/v1/public/embed/init` phải chứa `context_variables.session_id`.

## 4. Backup và restore

- Backup: `npm run dograh:backup`. Lệnh tạo `dograh/backups/<thời điểm>/` (git ignore) gồm `dograh-postgres.dump` và
  `dograh-minio.tgz`. Nên chạy thêm `npm run dograh:export` để có bản JSON của workflow.
- Restore (**thay thế toàn bộ dữ liệu hiện tại**):
  `powershell -ExecutionPolicy Bypass -File dograh/scripts/restore.ps1 -BackupDir dograh/backups/<thời điểm> -Force`
- Hai script cần stack đang chạy, và cần `dograh/.env` có `DOGRAH_JWT_SECRET`.

## Sự cố thường gặp

- **Widget báo "Domain not allowed":** thêm `localhost:3000` vào allowed domains của embed token.
- **Webhook không tới FluentAI:**
  - Next.js phải đang chạy trên host ở cổng 3000. `next dev` mặc định nghe trên mọi interface; nếu không, chạy
    `next dev -H 0.0.0.0`.
  - Xem log bằng `npm run dograh:logs`.
- **`DOGRAH_JWT_SECRET` chưa được đặt:** mọi lệnh `docker compose` với file này đều cần `dograh/.env`.
