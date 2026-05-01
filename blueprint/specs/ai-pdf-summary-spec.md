# Đặc tả: Tóm tắt Nội dung Workshop bằng AI (AI PDF Summary)

## Mô tả

Tính năng này cho phép ban tổ chức (`admin`) upload file PDF tài liệu của một workshop, sau đó hệ thống tự động xử lý nền để tạo bản tóm tắt bằng AI và hiển thị kết quả trên trang chi tiết workshop cho tất cả người dùng.

Luồng xử lý hoàn toàn **bất đồng bộ**: API trả về ngay sau khi nhận file, AI Worker xử lý riêng biệt qua RabbitMQ queue `ai_summary.generate`. Frontend poll trạng thái định kỳ cho đến khi có kết quả. Thiết kế này đảm bảo upload một file PDF lớn hoặc AI model phản hồi chậm không làm ảnh hưởng đến luồng request chính của hệ thống.

---

## Luồng chính

### Tổng quan các thành phần tham gia

| Thành phần | Vai trò |
|---|---|
| Web App (Next.js) | Admin upload PDF; sinh viên xem tóm tắt; polling trạng thái |
| API Gateway (Nginx) | Xác thực JWT, kiểm tra role `admin`, rate limiting |
| Workshop Service | Nhận file, lưu vào disk, tạo bản ghi `workshop_summaries`, publish event |
| RabbitMQ (`ai_summary.generate`) | Hàng đợi bất đồng bộ — tách hoàn toàn khỏi request chính |
| AI Worker (Node.js) | Consume event, trích xuất text PDF, làm sạch, gọi AI API, lưu kết quả |
| AI Summarization Service | External API (OpenAI GPT / Grok / self-hosted LLM) — nhận text, trả summary |
| PostgreSQL | Lưu `workshop_summaries` (status, summary text, metadata) |
| File System | Lưu file PDF upload tại thư mục cố định trên server |

### Luồng upload và xử lý

```
Admin (Web)    API Gateway    Workshop Svc       PostgreSQL      RabbitMQ       AI Worker       AI Model API
    │               │               │                 │               │               │               │
    │─POST /workshops/:id/pdf ─────►│                 │               │               │               │
    │  multipart/form-data          │                 │               │               │               │
    │  (file PDF)                   │                 │               │               │               │
    │               │               │                 │               │               │               │
    │               ├─Verify JWT    │                 │               │               │               │
    │               ├─role=admin?   │                 │               │               │               │
    │               │               │                 │               │               │               │
    │               │──────────────►│                 │               │               │               │
    │               │               │                 │               │               │               │
    │               │               ├─Validate file   │               │               │               │
    │               │               │  (type, size)   │               │               │               │
    │               │               │                 │               │               │               │
    │               │               ├─Save to disk────┼───────────────┼───────────────┼───────────────┤
    │               │               │  /uploads/pdf/  │               │               │               │
    │               │               │  {workshopId}/  │               │               │               │
    │               │               │  {uuid}.pdf     │               │               │               │
    │               │               │                 │               │               │               │
    │               │               ├─UPSERT workshop_summaries       │               │               │
    │               │               │  status='pending'               │               │               │
    │               │               │  pdf_file_path ─►               │               │               │
    │               │               │                 │               │               │               │
    │               │               ├─PUBLISH ────────┼──────────────►│               │               │
    │               │               │  ai_summary.    │               │               │               │
    │               │               │  generate       │               │               │               │
    │               │               │  {workshopId,   │               │               │               │
    │               │               │   filePath,     │               │               │               │
    │               │               │   summaryId}    │               │               │               │
    │               │               │                 │               │               │               │
    │◄─202 Accepted─│◄──────────────│                 │               │               │               │
    │  {summary_id, │               │                 │               │               │               │
    │   status:     │               │                 │               │               │               │
    │   'pending'}  │               │                 │               │               │               │
    │               │               │                 │               │               │               │
    │               │               │                 │               │  [AI Worker consume event]    │
    │               │               │                 │               │               │               │
    │               │               │                 │               │               ├─UPDATE status │
    │               │               │                 │──────────────◄┼───────────────┤  ='processing'│
    │               │               │                 │               │               │               │
    │               │               │                 │               │               ├─Extract text  │
    │               │               │                 │               │               │  từ PDF       │
    │               │               │                 │               │               ├─Clean text    │
    │               │               │                 │               │               │               │
    │               │               │                 │               │               ├─POST /summarize►│
    │               │               │                 │               │               │◄─ summary ────│
    │               │               │                 │               │               │               │
    │               │               │                 │──────────────◄┼───────────────┤─UPDATE status │
    │               │               │                 │  status='done'│               │  summary text │
    │               │               │                 │  summary,     │               │  ai_model_used│
    │               │               │                 │  completed_at │               │  completed_at │
    │               │               │                 │               │               │               │
```

### Luồng Frontend polling trạng thái

Admin upload xong nhận `202`. Web App bắt đầu poll định kỳ để cập nhật UI:

```
Web App                      API Gateway           Workshop Svc          PostgreSQL
    │                             │                      │                    │
    │─GET /workshops/:id/summary─►│                      │                    │
    │  (mỗi 5 giây)              │─────────────────────►│                    │
    │                             │                      ├─SELECT status ────►│
    │                             │                      │◄─ {status, ...} ───│
    │◄─ 200 {status: 'pending'} ──│◄─────────────────────│                    │
    │                             │                      │                    │
    │  [Tiếp tục poll sau 5s]     │                      │                    │
    │─GET /workshops/:id/summary─►│                      │                    │
    │                             │─────────────────────►│                    │
    │                             │                      ├─SELECT status ────►│
    │                             │                      │◄─ {status:'done'} ─│
    │◄─ 200 {                  ───│◄─────────────────────│                    │
    │     status: 'done',         │                      │                    │
    │     summary: "...",         │                      │                    │
    │     ai_model_used: "...",   │                      │                    │
    │     completed_at: "..."     │                      │                    │
    │   }                         │                      │                    │
    │  [Dừng poll, hiển thị tóm tắt]
```

Sinh viên xem trang chi tiết workshop cũng gọi `GET /workshops/:id/summary`. Nếu `status = 'done'`, hiển thị tóm tắt. Nếu `pending` hoặc `processing`, hiển thị trạng thái "Đang tạo tóm tắt...". Nếu `failed`, hiển thị thông báo phù hợp.

### Chi tiết xử lý trong AI Worker

```
AI Worker nhận event từ RabbitMQ:
{workshopId, filePath, summaryId}
        │
        ▼
1. UPDATE workshop_summaries SET status='processing', processing_started_at=NOW()
        │
        ▼
2. Đọc file PDF từ filePath trên disk
   [File không tồn tại → thất bại ngay, UPDATE status='failed']
        │
        ▼
3. Trích xuất text từ PDF (pdf-parse hoặc pdfjs)
   [PDF bị mã hóa / không có text layer → status='failed', error='unreadable_pdf']
        │
        ▼
4. Làm sạch văn bản:
   • Xóa header/footer lặp lại theo trang
   • Chuẩn hóa khoảng trắng, newline thừa
   • Giới hạn tối đa 12.000 token (cắt phần cuối nếu vượt)
        │
        ▼
5. Gọi AI Summarization Service:
   POST {AI_API_URL}/summarize
   Headers: Authorization: Bearer {AI_API_KEY}
   Body: {
     model: "gpt-4o-mini",        ← inject qua env AI_MODEL
     text: "<cleaned_text>",
     instruction: "Tóm tắt nội dung workshop này bằng tiếng Việt,
                   trình bày theo cấu trúc: Chủ đề, Nội dung chính,
                   Điểm nổi bật (tối đa 5 điểm). Khoảng 200-300 từ."
   }
   Timeout: 60 giây
        │
        ├─── Thành công:
        │    UPDATE workshop_summaries SET
        │      status = 'done',
        │      summary = <response>,
        │      ai_model_used = <model_name>,
        │      completed_at = NOW()
        │    ACK message (xóa khỏi queue)
        │
        └─── Thất bại (timeout / 5xx / rate limit):
             Retry với exponential backoff (xem kịch bản lỗi)
             Sau 3 lần retry → NACK, UPDATE status='failed'
```

---

## Kịch bản lỗi

### 1. File upload không hợp lệ

Được xử lý đồng bộ tại Workshop Service trước khi lưu file — trả lỗi ngay, không publish event.

| Tình huống | Kiểm tra | Response |
|---|---|---|
| Không phải PDF | Kiểm tra MIME type (`application/pdf`) và magic bytes (`%PDF`) | `400 "File phải có định dạng PDF"` |
| File quá lớn | Giới hạn `50 MB` | `413 "File vượt kích thước tối đa (50MB)"` |
| File rỗng (0 byte) | Kiểm tra size | `400 "File không có nội dung"` |
| Workshop không tồn tại | SELECT workshop → không tìm thấy | `404 "Workshop không tồn tại"` |
| Workshop đã hủy (`cancelled`) | Kiểm tra `workshops.status` | `409 "Workshop đã hủy, không thể upload PDF"` |

### 2. AI Worker không thể đọc PDF

```
AI Worker nhận filePath → đọc file → trích xuất text
    │
    ├─ File không có text layer (PDF scan / ảnh):
    │    Không có text sau extraction → error='no_text_content'
    │    UPDATE status='failed', error_message='PDF không chứa text có thể đọc.
    │    Vui lòng upload PDF dạng text hoặc dùng OCR trước.'
    │    ACK message (không retry — lỗi do nội dung, không phải hệ thống)
    │
    ├─ File bị mã hóa (password-protected):
    │    Thư viện pdf-parse ném exception → error='encrypted_pdf'
    │    UPDATE status='failed', error_message='PDF được bảo vệ bằng mật khẩu.'
    │    ACK message (không retry)
    │
    └─ File bị hỏng (corrupt):
         Exception khi parse → error='corrupt_pdf'
         UPDATE status='failed', error_message='File PDF bị lỗi, vui lòng upload lại.'
         ACK message (không retry)
```

### 3. AI API không ổn định — Retry với Exponential Backoff

```
Gọi AI API → thất bại
    │
    ├─ HTTP 429 (Rate limit):
    │    Đọc header Retry-After
    │    Nếu có → chờ đúng thời gian chỉ định
    │    Nếu không → backoff: 30s → 60s → 120s
    │    Retry tối đa 3 lần
    │
    ├─ HTTP 5xx (Server error) / Timeout (>60s):
    │    Backoff: 30s → 60s → 120s
    │    Retry tối đa 3 lần
    │
    ├─ HTTP 4xx khác (ví dụ 400 Bad Request — prompt quá dài):
    │    KHÔNG retry (lỗi do input, retry vô ích)
    │    UPDATE status='failed', error_message='AI từ chối xử lý nội dung.'
    │    ACK message
    │
    └─ Sau 3 lần retry vẫn thất bại:
         NACK message (đưa vào Dead Letter Queue để inspect sau)
         UPDATE status='failed', error_message='AI xử lý thất bại sau nhiều lần thử.
         Vui lòng thử lại sau.'
         Ghi log cấp ERROR kèm workshopId, summaryId để admin kiểm tra
```

### 4. Upload PDF lần thứ hai cho cùng workshop

Admin có thể re-upload PDF (ví dụ: tài liệu được cập nhật). Hệ thống xử lý bằng `UPSERT`:

```
Admin upload PDF mới cho workshop đã có summary (status='done')
    │
    ├─ Workshop Service:
    │    Lưu file mới (tên file mới theo uuid, file cũ giữ nguyên trên disk)
    │    UPSERT workshop_summaries ON CONFLICT (workshop_id) DO UPDATE:
    │      SET pdf_file_path = <new_path>,
    │          status = 'pending',
    │          summary = NULL,
    │          error_message = NULL,
    │          processing_started_at = NULL,
    │          completed_at = NULL,
    │          updated_at = NOW()
    │
    ├─ Publish event mới vào ai_summary.generate
    │
    └─ Trong thời gian AI Worker đang xử lý lại:
         GET /workshops/:id/summary → trả {status: 'pending'}
         Sinh viên thấy "Đang cập nhật tóm tắt..." thay vì tóm tắt cũ
         (summary cũ đã bị xóa khi reset về pending)
```

### 5. AI Worker bị crash giữa chừng

```
AI Worker đang xử lý (status='processing') → process crash / restart
    │
    └─ Message vẫn còn trong RabbitMQ (chưa ACK)
       RabbitMQ requeue message sau khi consumer disconnect
       AI Worker mới consume lại
       UPDATE status='processing' (idempotent — không sao)
       Tiếp tục pipeline từ đầu
```

Để tránh một message bị xử lý vô tận khi PDF thực sự không đọc được, AI Worker kiểm tra số lần delivery (`x-delivery-count` header) trước khi bắt đầu. Nếu vượt quá 3, chuyển thẳng sang `failed` và NACK đưa vào Dead Letter Queue.

### 6. RabbitMQ không khả dụng khi publish

```
Workshop Service lưu file thành công, UPSERT DB xong
→ Publish event thất bại (RabbitMQ down)
    │
    ├─ Retry publish tối đa 3 lần (1s → 2s → 4s) với connection pool
    │
    └─ Vẫn thất bại:
         Trả 202 cho admin (file đã lưu, record đã tạo với status='pending')
         Log lỗi cấp ERROR kèm workshopId
         Admin thấy UI vẫn "Đang xử lý..." mãi không xong
         → Admin re-upload PDF để trigger lại event
         (Hoặc cron job định kỳ scan record 'pending' > 30 phút để re-publish)
```

### Bảng tổng hợp

| Tình huống | Hành động hệ thống | Trạng thái cuối | Hiển thị với người dùng |
|---|---|---|---|
| Upload thành công, AI xử lý xong | ACK, UPDATE done | `done` | Hiển thị tóm tắt |
| File không phải PDF / quá lớn | Từ chối ngay tại API | — (không tạo record) | `400 / 413` |
| PDF không có text / bị mã hóa / hỏng | ACK (không retry), UPDATE failed | `failed` | "Không thể đọc file, vui lòng thử lại" |
| AI API rate limit / 5xx | Retry 3 lần backoff | `failed` (nếu hết retry) | "Tóm tắt thất bại, thử lại sau" |
| AI Worker crash | RabbitMQ requeue, Worker mới xử lý lại | `processing` → `done` / `failed` | "Đang xử lý..." (tự phục hồi) |
| RabbitMQ down khi publish | Retry 3 lần, log lỗi, trả 202 | `pending` (mãi) | "Đang xử lý..." → Admin re-upload |
| Re-upload PDF mới | UPSERT reset về pending, event mới | `pending` → `done` | "Đang cập nhật..." → hiển thị tóm tắt mới |

---

## Ràng buộc

### Kiến trúc (bất biến)

- Upload PDF và xử lý AI phải **hoàn toàn tách biệt** qua RabbitMQ. Workshop Service không được gọi AI API trực tiếp trong request handler — sẽ làm timeout HTTP request.
- AI Worker là **consumer độc lập**: crash của Worker không ảnh hưởng đến Backend API. Message được RabbitMQ giữ lại cho đến khi có consumer mới.
- Chỉ `role = 'admin'` được gọi `POST /workshops/:id/pdf`. Sinh viên và staff không có quyền upload.
- Sinh viên (`student`, `staff`, `admin`) đều được đọc `GET /workshops/:id/summary` — tóm tắt là thông tin công khai của workshop.

### File PDF

- **Định dạng:** `application/pdf` — kiểm tra cả MIME type (header HTTP) lẫn magic bytes (`%PDF` ở đầu file).
- **Kích thước tối đa:** 50 MB.
- **Text content tối đa gửi cho AI:** 12.000 token (khoảng 48.000 ký tự). Nội dung vượt quá bị cắt bớt từ cuối trước khi gửi.
- **Lưu trữ:** File lưu tại đường dẫn `{PDF_UPLOAD_DIR}/{workshopId}/{uuid}.pdf`, inject qua biến môi trường `PDF_UPLOAD_DIR`. Mỗi lần upload tạo filename mới (không ghi đè file cũ) để tránh race condition.

### AI Summarization Service

- **Timeout** mỗi request tới AI API: **60 giây**.
- **Retry:** tối đa 3 lần với exponential backoff. Lỗi 4xx (trừ 429) không được retry.
- **Model** được cấu hình qua biến môi trường `AI_MODEL` — không hardcode trong code.
- **API Key** lưu trong biến môi trường `AI_API_KEY` — không được log, không được đưa vào `gateway_response`.
- **Prompt** cố định trong code (không nhận từ client hoặc DB) để tránh prompt injection từ nội dung PDF.
- Nội dung PDF được **sanitize** (xóa ký tự điều khiển, giới hạn token) trước khi gửi cho AI.

### Hiệu năng và tài nguyên

- AI Worker chạy **process riêng** (không cùng process với Backend API). Xử lý PDF tốn nhiều CPU/RAM không ảnh hưởng đến latency API.
- Worker xử lý **tuần tự** (prefetch count = 1 per worker instance) để kiểm soát tải lên AI API. Scale bằng cách tăng số instance Worker, không tăng concurrency trong một instance.
- File PDF lớn (vài chục MB) phải được **đọc theo stream**, không load toàn bộ vào RAM.

### Tính nhất quán

- Bảng `workshop_summaries` có `UNIQUE(workshop_id)`: mỗi workshop chỉ có một bản ghi summary tại mọi thời điểm.
- `UPSERT ON CONFLICT (workshop_id)` đảm bảo re-upload không tạo bản ghi thừa.
- File cũ trên disk **không bị xóa ngay** khi re-upload. Dọn dẹp file cũ bằng cron job riêng (ngoài phạm vi tính năng này) để tránh mất file khi Worker đang xử lý dở.

---

## Tiêu chí chấp nhận

### Upload và kích hoạt

- [ ] Admin upload file PDF hợp lệ cho workshop → nhận `202`, `workshop_summaries.status = 'pending'`, có bản ghi trong DB.
- [ ] Event xuất hiện trong RabbitMQ queue `ai_summary.generate` ngay sau khi API trả `202`.
- [ ] Upload file không phải PDF (ví dụ `.docx`, `.png`) → nhận `400`, không tạo bản ghi, không publish event.
- [ ] Upload file PDF > 50 MB → nhận `413`, không tạo bản ghi.
- [ ] Sinh viên hoặc staff gọi `POST /workshops/:id/pdf` → nhận `403 Forbidden`.
- [ ] Admin upload PDF cho workshop đã `cancelled` → nhận `409`.

### Xử lý AI và trạng thái

- [ ] Sau khi AI Worker consume event, `status` chuyển sang `'processing'` trước khi gọi AI API.
- [ ] AI xử lý thành công → `status = 'done'`, `summary` có nội dung text, `ai_model_used` được ghi, `completed_at` được ghi.
- [ ] `GET /workshops/:id/summary` trả đúng trạng thái tương ứng với giá trị hiện tại trong DB.
- [ ] Sinh viên gọi `GET /workshops/:id/summary` khi `status = 'done'` → nhận được bản tóm tắt đầy đủ.

### Polling

- [ ] Frontend poll mỗi 5 giây. Khi `status = 'done'`, hiển thị tóm tắt và dừng poll.
- [ ] Khi `status = 'failed'`, hiển thị thông báo lỗi thân thiện và dừng poll (không poll vô hạn).
- [ ] Khi `status = 'pending'` hoặc `'processing'`, hiển thị trạng thái "Đang tạo tóm tắt..." và tiếp tục poll.

### Kịch bản lỗi

- [ ] Upload PDF không có text layer (PDF scan) → `status = 'failed'`, `error_message` ghi rõ lý do, message được ACK (không requeue vô tận).
- [ ] AI API trả `429` → Worker chờ theo `Retry-After`, retry tối đa 3 lần. Nếu hết retry → `status = 'failed'`.
- [ ] AI API trả `500` ba lần liên tiếp → `status = 'failed'`, message vào Dead Letter Queue, log cấp ERROR ghi `workshopId`.
- [ ] AI Worker crash khi đang `processing` → message được RabbitMQ requeue, Worker mới xử lý lại từ đầu, cuối cùng ra `done` hoặc `failed`.

### Re-upload

- [ ] Admin upload PDF lần 2 cho cùng workshop → DB chỉ có **một** bản ghi `workshop_summaries` (không tạo thêm), `status` reset về `'pending'`, tóm tắt cũ bị xóa.
- [ ] Sau khi AI xử lý xong lần 2, `GET /workshops/:id/summary` trả tóm tắt mới từ file PDF mới.

### Kiểm thử thủ công (smoke test)

**Test 1 — Happy path:**
Admin upload file PDF có nội dung rõ ràng (slide workshop, tài liệu kỹ thuật). Kỳ vọng: nhận `202`. Trong vòng 2 phút, `GET /workshops/:id/summary` trả `status='done'` với `summary` có ít nhất 100 từ, trình bày đúng cấu trúc (Chủ đề, Nội dung chính, Điểm nổi bật).

**Test 2 — PDF không đọc được:**
Upload file PDF là ảnh scan (không có text layer). Kỳ vọng: `status='failed'` trong DB, `error_message` chứa thông báo có thể hiển thị cho admin, message không còn trong queue thường (không retry lặp lại).

**Test 3 — Re-upload:**
Workshop đã có `status='done'` với tóm tắt cũ. Admin upload PDF mới. Kỳ vọng: `status` chuyển về `'pending'` ngay, `summary = NULL`. Sau khi xử lý xong, tóm tắt mới xuất hiện. Truy vấn DB: `SELECT COUNT(*) FROM workshop_summaries WHERE workshop_id = ?` = 1.

**Test 4 — Phân quyền:**
Dùng JWT của `student` gọi `POST /workshops/:id/pdf` → `403`. Dùng JWT của `staff` gọi → `403`. Dùng JWT của `admin` gọi → `202`.

**Test 5 — Xem tóm tắt:**
Dùng JWT của `student` gọi `GET /workshops/:id/summary` khi `status='done'` → nhận `200` với đầy đủ tóm tắt. Không cần role admin để đọc.
