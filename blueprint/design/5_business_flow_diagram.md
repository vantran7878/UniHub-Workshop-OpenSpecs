## 5. Luồng Nghiệp vụ Quan trọng

### 5.1 Luồng Đăng ký Workshop Có Phí

**Phạm vi:** Từ khi sinh viên bấm "Đăng ký" đến khi nhận được mã QR.

#### 5.1.1 Sequence Diagram

```
Sinh viên       API Gateway      Reg. Service        Redis         Payment Svc     Pay. Gateway      Broker       Notif. Svc
    │               │                │                 │               │               │               │            │
    │─POST /reg────►│                │                 │               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               ├─Verify JWT     │                 │               │               │               │            │
    │               ├─Rate limit ck. │                 │               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               │───────────────►│                 │               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               │                ├─SETNX lock:reg─►│               │               │               │            │
    │               │                │◄──── OK ────────│               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               │                ├─DECR seats:{id}►│               │               │               │            │
    │               │                │◄── seats = N ───│               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               │                │ [If N < 0]      │               │               │               │            │
    │               │                │ ├─INCR rollback │               │               │               │            │
    │               │                │ └─DEL lock      │               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               │                ├─INSERT (pending)│               │               │               │            │
    │               │                ├─DEL lock:reg───►│               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               │                ├─PUBLISH ───────────────────────────────────────────────────────►│            │
    │               │                │                 │               │               │               │            │
    │               │                │                 │               │◄── consume ───│               │            │
    │               │                │                 │               │               │               │            │
    │               │                │                 │               ├─GET Idempotent│               │            │
    │               │                │                 │               │──────────────►│               │            │
    │               │                │                 │               │◄─── MISS ─────│               │            │
    │               │                │                 │               │               │               │            │
    │               │                │                 │               ├─SET key=proc─►│               │            │
    │               │                │                 │               │               │               │            │
    │               │                │                 │               ├─POST charge ─►│               │            │
    │               │                │                 │               │◄── success ───│               │            │
    │               │                │                 │               │               │               │            │
    │               │                │                 │               ├─SET success ─►│               │            │
    │               │                │                 │               │               │               │            │
    │               │                │◄─ callback ─────│───────────────│               │               │            │
    │               │                │                 │               │               │               │            │
    │               │                ├─UPDATE confirmed│               │               │               │            │
    │               │                ├─Gen QR (UUID)   │               │               │               │            │
    │               │                │                 │               │               │               │            │
    │               │                ├─PUBLISH confirmed ─────────────────────────────────────────────►│            │
    │               │                │                 │               │               │               │            │
    │               │                │                 │               │               │               │──Email───► │
    │               │                │                 │               │               │               │──Push────► │
    │               │                │                 │               │               │               │            │
    │◄── 200 {qr} ──│                │                 │               │               │               │            │
    │               │                │                 │               │               │               │            │
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
Mobile App                API Gateway           Check-in Service           PostgreSQL
    │                         │                         │                      │
    │──GET /checkin/preload──►│                         │                      │
    │ (trước giờ check-in)    │────────────────────────►│                      │
    │                         │                         │                      │
    │                         │                         ├─ SELECT registrations│
    │                         │                         │  WHERE workshop_id   │
    │                         │                         │  AND status=confirmed│
    │                         │                         │                      │
    │                         │                         │◄─────────────────────┤
    │                         │                         │                      │
    │◄─── [{qr_code, info}] ──│◄────────────────────────┤                      │
    │                         │                         │                      │
    │                         │                         │                      │
    │ [Lưu vào SQLite local:  │                         │                      │
    │  bảng valid_qr_codes]   │                         │                      │
    │                         │                         │                      │
    │                         │                         │                      │
    │──QUÉT QR (OFFLINE)─────►│                         │                      │
    │ (So khớp SQLite local)  │                         │                      │
    │                         │                         │                      │
    │──[Sync later]──────────►│                         │                      │
    │  POST /checkin/sync     │────────────────────────►│                      │
    │                         │                         ├─ UPDATE attendance   │
    │                         │                         │  SET status=attended │
    │                         │                         │                      │
    │◄───── 200 OK ───────────│◄────────────────────────┤─────────────────────►│
    │                         │
```

#### 5.2.2 — Check-in khi mất mạng

```
Nhân sự            Mobile App                  SQLite (Local Device)
    │                  │                                │
    │── Quét QR ──────►│                                │
    │                  │                                │
    │                  │── SELECT * FROM valid_qr ─────►│
    │                  │   WHERE qr_code = ?            │
    │                  │                                │
    │                  │◄─ {student_name, ...} ─────────┤
    │                  │                                │
    │                  │                                │
    │                  │ [Kiểm tra đã check-in chưa?]   │
    │                  │                                │
    │                  │── SELECT * FROM offline_ci ───►│
    │                  │   WHERE qr_code = ?            │
    │                  │                                │
    │                  │◄─ EMPTY (chưa tồn tại) ────────┤
    │                  │                                │
    │                  │                                │
    │                  │ [Ghi nhận check-in mới]        │
    │                  │                                │
    │                  │── INSERT offline_checkins ────►│
    │                  │   {qr_code,                    │
    │                  │    checked_in_at: NOW(),       │
    │                  │    device_id: "ID_01",         │
    │                  │    is_synced: FALSE}           │
    │                  │                                │
    │                  │◄────────── OK ─────────────────┤
    │                  │                                │
    │◄─ ✅ Thành công ──│                                │
    │   "Nguyễn Văn A" │                                │
    │   "(Offline OK)" │                                │
```

**Trường hợp quét QR lần 2 (trùng):**
```
Nhân sự            Mobile App                  SQLite (Local Device)
    │                  │                                │
    │── Quét QR lần 2─►│                                │
    │                  │                                │
    │                  │── SELECT * FROM offline_ci ───►│
    │                  │   WHERE qr_code = ?            │
    │                  │                                │
    │                  │◄─ {checked_in_at: "09:05",     │
    │                  │    device_id: "ID_01"}         │
    │                  │                                │
    │                  │                                │
    │                  │ [Logic: Data found -> Reject]  │
    │                  │                                │
    │◄─ ⚠️ Cảnh báo ───│                                │
    │   "Đã check-in"  │                                │
    │   "Lúc: 09:05"   │                                │
    │                  │                                │
```

#### 5.2.3 — Đồng bộ lên server khi mạng phục hồi

```
Mobile App                API Gateway           Check-in Service           PostgreSQL
    │                         │                         │                      │
    │ [Phát hiện có mạng]     │                         │                      │
    │ [Trigger sync flow]     │                         │                      │
    │                         │                         │                      │
    │── POST /checkin/sync ──►│                         │                      │
    │   Body: [               │────────────────────────►│                      │
    │     {qr_code,           │                         │                      │
    │      checked_at,        │                         │ [Với mỗi bản ghi:]   │
    │      device_id},        │                         │                      │
    │     ...                 │                         ├─ SELECT registration │
    │   ]                     │                         │  WHERE qr_code = ?   │
    │                         │                         │                      │
    │                         │                         │◄─────────────────────┤
    │                         │                         │                      │
    │                         │                         │ [Nếu chưa check-in]  │
    │                         │                         │                      │
    │                         │                         ├─ INSERT checkins ───►│
    │                         │                         │  ON CONFLICT         │
    │                         │                         │  DO NOTHING          │
    │                         │                         │                      │
    │                         │                         ├─ UPDATE status ─────►│
    │                         │                         │  ='attended'         │
    │                         │
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
Cron Scheduler     Sync Worker         S3 Storage        Redis        PostgreSQL
      │                 │                  │               │              │
      │── Trigger 2AM ─►│                  │               │              │
      │                 │                  │               │              │
      │                 │── SET lock:csv ─►│               │              │
      │                 │◄─── OK (EX 300) ─│               │              │
      │                 │                  │               │              │
      │                 │── Get File ─────►│               │              │
      │                 │◄─ stream content │               │              │
      │                 │                  │               │              │
      │                 │ [Validations]    │               │              │
      │                 │ • Schema/Header  │               │              │
      │                 │ • UTF-8/Hash     │               │              │
      │                 │                  │               │              │
      │                 │── SELECT hash ───┼───────────────┼─────────────►│
      │                 │◄─ EMPTY (New) ───┼───────────────┼─────────────┤
      │                 │                  │               │              │
      │                 │ [Parse & Group]  │               │              │
      │                 │ • Unique records │               │              │
      │                 │                  │               │              │
      │                 │── BEGIN TRANS ───┼───────────────┼─────────────►│
      │                 │                  │               │              │
      │                 │── UPSERT Users ──┼───────────────┼─────────────►│
      │                 │ (Conflict Update)│               │              │
      │                 │                  │               │              │
      │                 │── Set Inactive ──┼───────────────┼─────────────►│
      │                 │ (Soft Delete)    │               │              │
      │                 │                  │               │              │
      │                 │── COMMIT ────────┼───────────────┼─────────────►│
      │                 │                  │               │              │
      │                 │── Insert Log ────┼───────────────┼─────────────►│
      │                 │                  │               │              │
      │                 │── DEL lock:csv ─►│               │              │
      │                 │                  │               │              │
      │◄───── DONE ─────│                  │               │              │
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