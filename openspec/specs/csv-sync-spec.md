# Đặc tả: Đồng bộ Dữ liệu Sinh viên từ CSV (CSV Database Synchronize)

## Mô tả

Tính năng này cho phép hệ thống UniHub Workshop tự động nhập và đồng bộ dữ liệu sinh viên từ file CSV được export định kỳ bởi hệ thống quản lý sinh viên cũ (Legacy Student Management System). Quá trình chạy theo lịch mỗi đêm lúc 2:00 AM thông qua **Batch Worker** (Node.js Cron Job) — hoàn toàn tách biệt khỏi luồng request chính, không ảnh hưởng đến trải nghiệm người dùng.

Mục tiêu: đảm bảo bảng `users` trong PostgreSQL luôn phản ánh đúng danh sách sinh viên hợp lệ của trường, phục vụ việc xác thực sinh viên khi đăng ký workshop.

---

## Luồng chính

### Tổng quan các thành phần tham gia

| Thành phần | Vai trò |
|---|---|
| Cron Scheduler | Kích hoạt job lúc 2:00 AM hàng đêm |
| Batch Worker (Node.js) | Đọc, validate, xử lý và upsert dữ liệu |
| Redis | Distributed lock ngăn job chạy trùng lặp |
| PostgreSQL | Lưu dữ liệu sinh viên và lịch sử import |
| File System | Thư mục chứa file CSV từ hệ thống cũ |

### Các bước xử lý theo thứ tự

```
Cron Scheduler      Batch Worker            Redis             PostgreSQL
      │                   │                   │                   │
      │── Trigger 2AM ───►│                   │                   │
      │                   │                   │                   │
      │                   │── SET lock:csv ──►│                   │
      │                   │   EX 300 NX       │                   │
      │                   │                   │                   │
      │                   │ [Nếu lock thất bại → Skip, ghi log]   │
      │                   │                   │                   │
      │                   │── Kiểm tra file ──┼───────────────────┤
      │                   │   (đường dẫn cố định trên server)     │
      │                   │                   │                   │
      │                   │── Tính hash MD5 ──┼───────────────────┤
      │                   │── SELECT hash ────┼──────────────────►│
      │                   │   từ import_logs  │                   │
      │                   │◄─ (EMPTY = file mới, FOUND = đã import)
      │                   │                   │                   │
      │                   │ [Nếu hash trùng → Skip, ghi 'skipped']│
      │                   │                   │                   │
      │                   │── Validate header─┼───────────────────┤
      │                   │   (cột bắt buộc:  │                   │
      │                   │   student_id,     │                   │
      │                   │   full_name,      │                   │
      │                   │   email)          │                   │
      │                   │                   │                   │
      │                   │── Stream & Parse ─┼───────────────────┤
      │                   │   theo từng batch │                   │
      │                   │   (500 dòng/batch)│                   │
      │                   │                   │                   │
      │                   │ [Với mỗi batch:]  │                   │
      │                   │ • Validate từng dòng                  │
      │                   │ • Deduplicate trong batch             │
      │                   │ • BEGIN TRANSACTION                   │
      │                   │── UPSERT users ───┼──────────────────►│
      │                   │   ON CONFLICT     │                   │
      │                   │   (student_id)    │                   │
      │                   │   DO UPDATE SET   │                   │
      │                   │   full_name,email │                   │
      │                   │   phone,updated_at│                   │
      │                   │── COMMIT ─────────┼──────────────────►│
      │                   │                   │                   │
      │                   │ [Sau tất cả batch:]                   │
      │                   │── Mark inactive ──┼──────────────────►│
      │                   │   UPDATE users    │                   │
      │                   │   SET is_active=FALSE                 │
      │                   │   WHERE student_id│                   │
      │                   │   NOT IN (csv_ids)│                   │
      │                   │                   │                   │
      │                   │── INSERT log ─────┼──────────────────►│
      │                   │   student_import_ │                   │
      │                   │   logs            │                   │
      │                   │                   │                   │
      │                   │── DEL lock:csv ──►│                   │
      │                   │                   │                   │
      │◄───── DONE ───────│                   │                   │
```

### Chi tiết từng bước

**Bước 1 — Acquire distributed lock**
Batch Worker gọi Redis `SET lock:csv_import <timestamp> EX 300 NX`. Nếu lock đã tồn tại (job trước chưa hoàn tất hoặc crash chưa kịp xóa lock), job mới skip toàn bộ và ghi log `status='skipped_lock'`. TTL 300 giây đảm bảo lock tự giải phóng sau 5 phút nếu worker crash.

**Bước 2 — Kiểm tra file**
Worker đọc file từ đường dẫn cố định được cấu hình qua biến môi trường `CSV_IMPORT_PATH`. Nếu file không tồn tại hoặc không có quyền đọc, ghi log lỗi và gửi alert cho admin.

**Bước 3 — Kiểm tra file trùng (hash check)**
Tính MD5 hash của file. So sánh với cột `file_hash` trong bảng `student_import_logs`. Nếu trùng, ghi `status='skipped'` và kết thúc sớm — tránh xử lý lặp lại khi hệ thống cũ chưa export file mới.

**Bước 4 — Validate cấu trúc**
Đọc dòng header. Kiểm tra sự tồn tại của các cột bắt buộc: `student_id`, `full_name`, `email`. Nếu thiếu bất kỳ cột nào, dừng ngay, ghi `status='failed'` với chi tiết lỗi cấu trúc.

**Bước 5 — Stream và xử lý theo batch**
Đọc file theo stream (không load toàn bộ vào RAM), chia thành các batch 500 dòng. Với mỗi dòng: validate định dạng email, student_id không rỗng, deduplicate trong batch. Dòng lỗi bị bỏ qua và ghi vào `error_details` (JSONB), không làm dừng toàn bộ job.

**Bước 6 — Upsert dữ liệu**
Với mỗi batch hợp lệ, chạy trong một DB transaction:
```sql
INSERT INTO users (student_id, full_name, email, phone, role, is_active)
VALUES (...)
ON CONFLICT (student_id)
DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email     = EXCLUDED.email,
  phone     = EXCLUDED.phone,
  is_active = TRUE,
  updated_at = NOW()
WHERE users.role = 'student';
```
> **Ràng buộc quan trọng:** Chỉ upsert các user có `role = 'student'`. Tài khoản `admin` và `staff` không bị ghi đè bởi CSV.

**Bước 7 — Soft delete sinh viên đã rời trường**
Sau khi upsert xong toàn bộ file, đánh dấu các sinh viên có trong DB nhưng không xuất hiện trong CSV mới nhất:
```sql
UPDATE users
SET is_active = FALSE, updated_at = NOW()
WHERE role = 'student'
  AND student_id NOT IN (<tập student_id từ CSV>)
  AND is_active = TRUE;
```
Không xóa vật lý để bảo toàn lịch sử đăng ký, thanh toán, check-in.

**Bước 8 — Ghi log và giải phóng lock**
Insert một bản ghi vào `student_import_logs` với đầy đủ thông tin: `file_hash`, `total_rows`, `inserted`, `updated`, `skipped`, `errors`, `status`, `imported_at`. Cuối cùng xóa Redis lock.

---

## Kịch bản lỗi

| Tình huống | Hành động hệ thống | Tác động với người dùng |
|---|---|---|
| File CSV không tồn tại tại đường dẫn | Ghi log `status='failed'`, gửi alert email cho admin, giải phóng lock | Sinh viên đã có trong DB vẫn đăng ký bình thường. Dữ liệu không thay đổi. |
| Không có quyền đọc file | Ghi log lỗi hệ thống `status='failed'`, gửi cảnh báo kỹ thuật | Không thay đổi dữ liệu. Admin cần kiểm tra quyền thư mục. |
| File đã được import trước đó (hash trùng) | Ghi log `status='skipped'`, kết thúc sớm không xử lý | Không có tác động. Hoạt động bình thường. |
| File thiếu cột bắt buộc | Dừng ngay lập tức, ghi `status='failed'` với chi tiết cột bị thiếu | Không thay đổi dữ liệu. Hệ thống cũ cần được kiểm tra. |
| Một dòng dữ liệu sai định dạng (email lỗi, student_id rỗng) | Bỏ qua dòng đó, tăng counter `errors`, ghi vào `error_details`, tiếp tục các dòng còn lại | Phần lớn dữ liệu vẫn được cập nhật. Admin xem log để biết dòng nào bị lỗi. |
| DB lỗi giữa chừng trong một batch | ROLLBACK batch hiện tại, retry tối đa 3 lần với exponential backoff (1s → 2s → 4s). Nếu vẫn thất bại, ghi `status='partial_failed'`, tiếp tục batch tiếp theo | Dữ liệu nhất quán (không có trạng thái nửa vời). Một số batch có thể không được cập nhật. |
| Job chạy trùng lặp (cron bị trigger 2 lần) | Job thứ 2 gặp Redis lock tồn tại → skip ngay lập tức, ghi log `status='skipped_lock'` | Không có xung đột dữ liệu. |
| Redis không khả dụng khi acquire lock | Fallback: Worker tiếp tục chạy nhưng ghi cảnh báo vào log. Rủi ro: có thể có 2 job chạy song song. Chấp nhận được vì UPSERT idempotent. | Không có tác động với người dùng. Dữ liệu vẫn đúng do UPSERT. |
| Worker crash giữa chừng (OOM, kill signal) | Redis lock tự hết TTL sau 300 giây. Job tiếp theo sẽ chạy lại từ đầu. | Dữ liệu được cập nhật ở lần chạy tiếp theo. Sinh viên chưa cập nhật vẫn đăng ký bình thường nếu đã có trong DB. |
| File CSV quá lớn gây timeout 300 giây | Cơ chế streaming và batch ngăn OOM. Nếu vượt TTL của lock, log cảnh báo và tăng TTL lên. Cân nhắc chia file ở hệ thống cũ. | Không tác động ngay. Admin nhận alert để điều chỉnh cấu hình. |

---

## Ràng buộc

### Hiệu năng

- **Batch size:** Xử lý tối đa 500 dòng/batch để kiểm soát bộ nhớ và kích thước transaction.
- **Streaming:** Bắt buộc dùng stream khi đọc file CSV, không load toàn bộ vào RAM để hỗ trợ file lên đến hàng chục nghìn dòng (12.000+ sinh viên).
- **Thời gian hoàn thành:** Toàn bộ job phải hoàn thành trong vòng 5 phút (300 giây — khớp với TTL của Redis lock). Nếu dự kiến vượt, cần tăng TTL và cấu hình lại.
- **Thời điểm chạy:** Cố định lúc 2:00 AM để tránh giờ cao điểm sử dụng hệ thống.
- **Tách biệt hoàn toàn:** Batch Worker chạy trong process riêng, không chia sẻ event loop với Backend API. Lỗi xảy ra trong Worker không ảnh hưởng đến API đang phục vụ request của sinh viên.

### Bảo mật

- **Chỉ đọc file từ đường dẫn được cấu hình** qua biến môi trường `CSV_IMPORT_PATH`. Không chấp nhận đường dẫn động từ bên ngoài.
- **Phân quyền file system:** Batch Worker chỉ có quyền `read-only` với thư mục CSV. Không ghi vào thư mục đó.
- **Bảo vệ tài khoản đặc quyền:** Upsert chỉ áp dụng cho `role = 'student'`. Tài khoản `admin` và `staff` không bị ghi đè dù có `student_id` trùng trong CSV.
- **Không expose endpoint HTTP:** Không có API để trigger CSV import từ bên ngoài. Chỉ khởi chạy qua cron scheduler nội bộ.
- **Dữ liệu nhạy cảm trong log:** Không ghi toàn bộ nội dung dòng lỗi vào log (tránh lộ PII). Chỉ ghi số thứ tự dòng và trường bị lỗi.

### Tính nhất quán

- **UPSERT idempotent:** Chạy job nhiều lần với cùng file cho kết quả giống nhau. Không tạo duplicate.
- **Soft delete, không xóa vật lý:** Sinh viên vắng mặt trong CSV được đánh `is_active = FALSE`. Lịch sử đăng ký, thanh toán, check-in được bảo toàn.
- **DB là source of truth:** Redis lock chỉ là cơ chế phối hợp, không phải nguồn dữ liệu.
- **Transaction per batch:** Lỗi một batch không rollback các batch đã commit trước đó. Đảm bảo tiến trình không bị mất hoàn toàn.
- **Chỉ ghi đè trường dữ liệu, không thay đổi role:** Upsert chỉ cập nhật `full_name`, `email`, `phone`. Không thay đổi `role`, `password_hash`, `created_at`.

### Cấu trúc CSV bắt buộc

| Tên cột | Kiểu dữ liệu | Bắt buộc | Mô tả |
|---|---|---|---|
| `student_id` | VARCHAR(50) | ✅ | Mã sinh viên, unique key |
| `full_name` | VARCHAR(255) | ✅ | Họ và tên |
| `email` | VARCHAR(255) | ✅ | Email hợp lệ (validate format) |
| `phone` | VARCHAR(20) | ❌ | Số điện thoại |

Encoding: UTF-8. Delimiter: dấu phẩy (`,`). Dòng đầu: header.

---

## Tiêu chí chấp nhận

### Chức năng cơ bản

- [ ] Job tự động chạy mỗi ngày lúc 2:00 AM mà không cần can thiệp thủ công.
- [ ] Sinh viên mới xuất hiện trong CSV được insert vào bảng `users` với `role = 'student'`, `is_active = TRUE`.
- [ ] Sinh viên đã có trong DB được cập nhật `full_name`, `email`, `phone` nếu thông tin thay đổi trong CSV.
- [ ] Sinh viên có trong DB nhưng không có trong CSV được đánh `is_active = FALSE` (không bị xóa vật lý).
- [ ] Tài khoản có `role = 'admin'` hoặc `role = 'staff'` không bị ghi đè dù có `student_id` trùng trong CSV.

### Chống trùng lặp và idempotency

- [ ] Nếu cùng file CSV được xử lý 2 lần (hash trùng), lần thứ 2 ghi `status='skipped'` và không thay đổi dữ liệu DB.
- [ ] Nếu cron trigger job 2 lần cùng lúc, job thứ 2 tự động skip nhờ Redis lock.
- [ ] Chạy job nhiều lần với cùng file CSV cho kết quả DB giống hệt nhau (idempotent).

### Xử lý dữ liệu lỗi

- [ ] Dòng CSV có email sai định dạng bị bỏ qua, các dòng còn lại vẫn được xử lý.
- [ ] Dòng CSV có `student_id` rỗng bị bỏ qua, job không dừng lại.
- [ ] Số lượng dòng lỗi được ghi chính xác vào `student_import_logs.error_details`.

### Logging và observability

- [ ] Mỗi lần chạy tạo ra một bản ghi trong `student_import_logs` với đầy đủ: `status`, `total_rows`, `inserted`, `updated`, `skipped`, `errors`, `imported_at`, `file_hash`.
- [ ] Khi file không tồn tại hoặc không có quyền đọc, hệ thống gửi alert (email hoặc log cấp ERROR) đến admin trong vòng 5 phút sau 2:00 AM.
- [ ] Log ghi rõ thời gian bắt đầu, thời gian kết thúc và tổng thời gian thực thi.

### Hiệu năng

- [ ] Job xử lý 12.000 dòng sinh viên hoàn thành trong vòng 5 phút.
- [ ] Memory sử dụng không vượt quá 256 MB trong suốt quá trình chạy (kiểm tra qua stream).
- [ ] API phục vụ sinh viên không bị ảnh hưởng về latency trong thời gian job chạy (Worker chạy process riêng).

### Khôi phục sau sự cố

- [ ] Nếu Worker crash giữa chừng, Redis lock tự hết hạn sau 300 giây và job tiếp theo có thể chạy bình thường.
- [ ] Nếu một batch upsert thất bại sau 3 lần retry, log ghi rõ batch nào bị lỗi và job tiếp tục với batch tiếp theo.
- [ ] Sinh viên đã được cập nhật ở các batch trước đó không bị mất dữ liệu khi một batch sau thất bại.

### Kiểm thử thủ công (smoke test)

Tester chuẩn bị 3 file CSV:
1. **File hợp lệ:** 100 sinh viên mới + 50 sinh viên đã có trong DB với email thay đổi.
   → Kỳ vọng: 100 inserted, 50 updated, các sinh viên không có trong file bị đánh `is_active=FALSE`.
2. **File trùng lặp:** Chạy lại file số 1.
   → Kỳ vọng: log `status='skipped'`, không thay đổi DB.
3. **File có dòng lỗi:** 10 dòng email sai định dạng, 90 dòng hợp lệ.
   → Kỳ vọng: 90 dòng upsert thành công, `errors=10` trong log.
