## 5. Luồng Nghiệp vụ Quan trọng

### 5.1 Luồng Đăng ký Workshop Có Phí

**Phạm vi:** Từ khi sinh viên bấm "Đăng ký" đến khi nhận được mã QR.

#### 5.1.1 Sequence Diagram

```
Sinh viên     API Gateway    Reg. Service      Redis       Payment Svc   Pay. Gateway   Broker   Notif. Svc
    │               │               │              │               │              │          │          │
    │─POST /register►               │              │               │              │          │          │
    │               │               │              │               │              │          │          │
    │               ├─Verify JWT    │              │               │              │          │          │
    │               ├─Rate limit ck.│              │               │              │          │          │
    │               │               │              │               │              │          │          │
    │               │──────────────►│              │               │              │          │          │
    │               │               │              │               │              │          │          │
    │               │               ├─SET NX lock:workshop:{id} ──►│              │          │          │
    │               │               │◄──── OK (lock acquired) ─────│              │          │          │
    │               │               │              │               │              │          │          │
    │               │               ├─DECR seats:{id} ────────────►│              │          │          │
    │               │               │◄──── seats = N (N >= 0?) ────│              │          │          │
    │               │               │              │               │              │          │          │
    │               │               │  [N < 0: INCR để rollback]   │              │          │          │
    │               │               │  [DEL lock]  │               │              │          │          │
    │               │               │              │               │              │          │          │
    │               │               ├─INSERT registration(pending) ─────────────────────────────────────►
    │               │               │              │               │              │          │          │
    │               │               ├─DEL lock:workshop:{id} ──────►│              │          │          │
    │               │               │              │               │              │          │          │
    │               │               ├─PUBLISH payment.process ───────────────────────────►  │          │
    │               │               │              │               │              │          │          │
    │               │               │              │        ◄──────┤ consume      │          │          │
    │               │               │              │               │              │          │          │
    │               │               │              │               ├─GET idempotency key ───►│          │
    │               │               │              │               │◄─ MISS ───────────────  │          │
    │               │               │              │               │              │          │          │
    │               │               │              │               ├─SET key=processing ───►│          │
    │               │               │              │               │              │          │          │
    │               │               │              │               ├─POST charge ─►│          │          │
    │               │               │              │               │◄─ success ────│          │          │
    │               │               │              │               │              │          │          │
    │               │               │              │               ├─SET key=success(TTL 24h)►          │
    │               │               │              │               │              │          │          │
    │               │               │◄──payment_success callback ──│              │          │          │
    │               │               │              │               │              │          │          │
    │               │               ├─UPDATE registration → confirmed              │          │          │
    │               │               ├─Generate QR token (UUID)     │              │          │          │
    │               │               │              │               │              │          │          │
    │               │               ├─PUBLISH registration.confirmed ──────────────────────►│          │
    │               │               │              │               │              │          ├─► Email  │
    │               │               │              │               │              │          ├─► Push   │
    │               │               │              │               │              │          │          │
    │◄──200 {qr_code}───────────────│              │               │              │          │          │
    │               │               │              │               │              │          │          │
```

#### 5.1.2 Bảng xử lý lỗi

| Bước | Tình huống lỗi | Hành động hệ thống | Kết quả với người dùng |
|---|---|---|---|
| Kiểm tra slot | `seats < 0` sau DECR | INCR lại (rollback Redis), DEL lock, không tạo DB record | Trả `409 Conflict: "Workshop đã hết chỗ"` |
| Acquire lock | Lock đang bị giữ (NX fail) | Retry tối đa 3 lần cách nhau 100ms | Nếu vẫn fail → `503 "Hệ thống bận, thử lại"` |
| INSERT registration | DB lỗi (unique constraint) | Rollback, DEL lock, INCR slot | Trả `409 "Bạn đã đăng ký workshop này"` |
| Payment timeout (>10s) | Gateway không phản hồi | Payment Svc trả lỗi, giữ `registration.status = pending` | Trả `202 "Đăng ký ghi nhận, thanh toán đang xử lý"` |
| Circuit Breaker OPEN | Gateway liên tục lỗi | Fast-fail ngay, INCR slot, xóa pending record | Trả `503 "Thanh toán tạm thời không khả dụng"` |
| Client retry payment | Gửi lại request với cùng idempotency key | Payment Svc hit Redis cache → trả response cũ | Không charge lần 2, kết quả nhất quán |
| Notification lỗi | Email/Push provider sập | Broker retry tự động, log `notification.status = retrying` | Đăng ký vẫn thành công, thông báo sẽ gửi sau |

---

### 5.2 Luồng Check-in Khi Mất Mạng và Đồng bộ Lại

**Phạm vi:** Từ khi nhân sự quét QR ở khu vực mất mạng đến khi dữ liệu đồng bộ lên server.

#### 5.2.1 — Tải dữ liệu xuống trước sự kiện (bắt buộc, khi có mạng)

```
Mobile App                   API Gateway           Check-in Service         PostgreSQL
    │                              │                       │                     │
    │─ GET /checkin/preload ───────►│                       │                     │
    │  (trước giờ check-in)        │──────────────────────►│                     │
    │                              │                       ├─ SELECT registrations│
    │                              │                       │  WHERE workshop_id   │
    │                              │                       │  AND status=confirmed│
    │                              │                       │◄────────────────────│
    │◄─ [{qr_code, student_name,   │◄──────────────────────│                     │
    │    student_id, workshop_id}] │                       │                     │
    │                              │                       │                     │
    │  [Lưu vào SQLite local:      │                       │                     │
    │   bảng valid_qr_codes]       │                       │                     │
    │                              │                       │                     │
```

#### 5.2.2 — Check-in khi mất mạng

```
Nhân sự          Mobile App                SQLite (trên thiết bị)
    │                  │                            │
    │─ Quét QR ────────►│                            │
    │                  │─ SELECT * FROM valid_qr ──►│
    │                  │  WHERE qr_code = ?          │
    │                  │◄─ {student_name, ...} ──────│
    │                  │                            │
    │                  │  [Kiểm tra đã check-in chưa]│
    │                  │─ SELECT * FROM offline_ci ─►│
    │                  │  WHERE qr_code = ?          │
    │                  │◄─ EMPTY (chưa check-in) ────│
    │                  │                            │
    │                  │─ INSERT offline_checkins ──►│
    │                  │  {qr_code,                  │
    │                  │   checked_in_at: NOW(),     │
    │                  │   device_id,                │
    │                  │   is_synced: FALSE}         │
    │                  │                            │
    │◄─ ✅ "Nguyễn Văn A" ─│                            │
    │   "Check-in OK (offline)" │                   │
    │                  │                            │
```

**Trường hợp quét QR lần 2 (trùng):**
```
    │─ Quét QR lần 2 ─►│
    │                  │─ SELECT offline_checkins ──►│
    │                  │◄─ {checked_in_at: 09:05} ───│
    │◄─ ⚠️ "Đã check-in lúc 09:05" ─│
```

#### 5.2.3 — Đồng bộ lên server khi mạng phục hồi

```
Mobile App             API Gateway         Check-in Service             PostgreSQL
    │                       │                      │                        │
    │  [Phát hiện có mạng]  │                      │                        │
    │  [Network listener    │                      │                        │
    │   trigger sync]       │                      │                        │
    │                       │                      │                        │
    │─ POST /checkin/sync ─►│─────────────────────►│                        │
    │  Body: [              │                      │                        │
    │   {qr_code,           │                      │  [Với mỗi bản ghi:]    │
    │    checked_in_at,     │                      │                        │
    │    device_id},        │                      ├─ SELECT registration   │
    │   ...                 │                      │  WHERE qr_code = ?    │
    │  ]                    │                      │◄──────────────────────│
    │                       │                      │                        │
    │                       │                      │  [Nếu chưa check-in:]  │
    │                       │                      ├─ INSERT checkins ──────►│
    │                       │                      │  ON CONFLICT           │
    │                       │                      │  DO NOTHING            │
    │                       │                      │                        │
    │                       │                      ├─ UPDATE registrations ─►│
    │                       │                      │  SET status='attended' │
    │                       │                      │                        │
    │◄─ 200 {              │◄─────────────────────│                        │
    │   synced: 12,         │                      │                        │
    │   skipped: 1,         │                      │                        │
    │   errors: 0           │                      │                        │
    │  }                    │                      │                        │
    │                       │                      │                        │
    │  [UPDATE SQLite:      │                      │                        │
    │   is_synced = TRUE    │                      │                        │
    │   WHERE synced]       │                      │                        │
    │                       │                      │                        │
```

#### 5.2.4 Bảng xử lý lỗi

| Tình huống | Hành động |
|---|---|
| QR không có trong SQLite cache | Từ chối ngay: `"Mã QR không hợp lệ cho sự kiện này"`. Không ghi local. |
| QR đã check-in (trùng, offline) | Cảnh báo nhân sự với thời gian check-in lần trước. Không ghi thêm. |
| SQLite bị đầy (thiết bị lỗi) | Hiển thị lỗi rõ ràng, yêu cầu nhân sự dùng thiết bị khác. |
| Sync lên server thất bại | Giữ nguyên `is_synced = FALSE` trong SQLite, tự động retry sau 60 giây. |
| Server nhận QR đã tồn tại trong DB | `ON CONFLICT DO NOTHING` — bỏ qua, không báo lỗi, tính vào `skipped`. |
| Thiết bị bị thay giữa chừng | Thiết bị mới preload lại. Thiết bị cũ tự sync khi có mạng trở lại. |

---

### 5.3 Luồng Nhập Dữ liệu từ CSV Đêm

**Phạm vi:** Từ khi cron job khởi chạy đến khi dữ liệu sinh viên được cập nhật trong DB.

```
Cron Scheduler    Student Sync Worker          S3 Storage           PostgreSQL
    │                     │                        │                     │
    │─ Trigger 02:00 AM ─►│                        │                     │
    │                     │                        │                     │
    │                     ├─ SET lock:csv_import ──────────────────────►[Redis]
    │                     │  EX 300 NX             │                     │
    │                     │◄─ OK                   │                     │
    │                     │                        │                     │
    │                     ├─ Download CSV ─────────►│                     │
    │                     │◄─ students_YYYYMMDD.csv─│                     │
    │                     │                        │                     │
    │                     │  [Bước 1: Validate cấu trúc file]            │
    │                     │  • Kiểm tra header row đúng schema           │
    │                     │  • Kiểm tra encoding UTF-8                   │
    │                     │  • Tính SHA256 hash của file                 │
    │                     │                        │                     │
    │                     ├─ SELECT file_hash ──────────────────────────►│
    │                     │  FROM student_import_logs                    │
    │                     │◄─ EMPTY (file chưa import) ─────────────────│
    │                     │                        │                     │
    │                     │  [Bước 2: Parse và validate từng dòng]       │
    │                     │  • Trim whitespace                           │
    │                     │  • Validate email format (regex)             │
    │                     │  • Validate student_code format              │
    │                     │  • Gom nhóm dòng hợp lệ / lỗi               │
    │                     │                        │                     │
    │                     │  [Bước 3: Loại bỏ trùng lặp trong file]     │
    │                     │  • Nếu cùng student_code xuất hiện 2 lần    │
    │                     │    → Giữ dòng cuối cùng                     │
    │                     │                        │                     │
    │                     ├─ BEGIN TRANSACTION ─────────────────────────►│
    │                     │                        │                     │
    │                     ├─ UPSERT users ──────────────────────────────►│
    │                     │  ON CONFLICT (student_id) DO UPDATE          │
    │                     │  SET full_name=..., email=..., updated_at=NOW│
    │                     │                        │                     │
    │                     ├─ UPDATE users SET is_active=FALSE ───────────►│
    │                     │  WHERE student_id NOT IN (csv_list)          │
    │                     │  (sinh viên thôi học / nghỉ)                │
    │                     │                        │                     │
    │                     ├─ COMMIT ────────────────────────────────────►│
    │                     │                        │                     │
    │                     ├─ INSERT student_import_logs ────────────────►│
    │                     │  {filename, file_hash, status='success',     │
    │                     │   rows_processed, inserted, updated, ...}    │
    │                     │                        │                     │
    │                     ├─ DEL lock:csv_import ──────────────────────►[Redis]
    │                     │                        │                     │
    │◄─ Done ─────────────│                        │                     │
    │                     │                        │                     │
```

#### 5.3.1 Bảng xử lý lỗi

| Tình huống | Hành động |
|---|---|
| File CSV không tồn tại trên S3 | Ghi log `status='failed'`, gửi alert email cho ban tổ chức. Không thay đổi DB. |
| File đã được import (hash trùng) | Bỏ qua toàn bộ, ghi log `status='skipped'`. Không duplicate dữ liệu. |
| File sai cấu trúc (thiếu cột header) | Dừng ngay, không parse, ghi `status='failed'` + `error_detail`. |
| Dòng dữ liệu lỗi (email sai format) | Bỏ qua dòng đó, tăng counter `errors`, tiếp tục các dòng còn lại. Ghi detail vào `error_details` (JSONB). |
| DB lỗi giữa transaction | `ROLLBACK` toàn bộ batch. Retry sau 5 phút, tối đa 3 lần. Nếu vẫn lỗi → alert. |
| Import job đang chạy (lock tồn tại) | Skip ngay (lock:csv_import SET NX fail). Tránh chạy 2 job song song. |
| Sinh viên có trong DB nhưng không có trong CSV mới | Đặt `is_active = FALSE`. Sinh viên này không thể đăng ký thêm workshop mới. Đăng ký cũ không bị xóa. |

---