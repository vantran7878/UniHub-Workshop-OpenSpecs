# Đặc tả: Check-in tại sự kiện (Check-in Module)

## Mô tả

Module xử lý việc nhân sự check-in xác nhận sự tham dự của sinh viên tại
cửa phòng workshop thông qua Mobile App (Flutter). Hỗ trợ **hai chế độ**:

- **Online mode**: Quét QR → gọi API → xác nhận tức thì.
- **Offline mode**: Khu vực mất mạng → ghi nhận vào SQLite trên thiết bị
  → tự đồng bộ lên server khi kết nối phục hồi.

Luồng offline gồm hai giai đoạn bắt buộc:
1. **Preload trước sự kiện** (khi có mạng): tải danh sách QR hợp lệ về thiết bị.
2. **Offline scan + sync**: quét offline dựa trên cache local, đồng bộ sau.

Yêu cầu cốt lõi: **không mất dữ liệu** và **không check-in trùng**
dù trong điều kiện mạng bất ổn.

---

## Cấu trúc QR Code

`qr_code` trong bảng `registrations` là một UUID v4 opaque (không phải JWT),
được sinh ra khi registration chuyển sang trạng thái `confirmed`.

```
Format: UUID v4 thuần túy
Ví dụ:  "f47ac10b-58cc-4372-a567-0e02b2c3d479"

Lưu trữ:
  - PostgreSQL: registrations.qr_code (VARCHAR 255, UNIQUE)
  - Mobile local: SQLite bảng valid_qr_codes
  - Hiển thị: render thành ảnh QR, sinh viên show trên điện thoại
```

> **Tại sao không dùng JWT cho QR?**
> QR code chỉ cần là một opaque identifier tra cứu trong DB — không cần
> mang payload. Dùng UUID đơn giản hơn, không có vấn đề expiry trên ảnh đã
> chụp, và việc validate là bước lookup DB thay vì verify signature.

---

## Luồng chính

### Luồng A — Preload danh sách QR hợp lệ (bắt buộc trước sự kiện)

**Mục đích**: Thiết bị nhân sự tải về danh sách `qr_code` hợp lệ của workshop
để có thể validate offline khi mất mạng.

**Precondition**: Nhân sự đã đăng nhập, có mạng, trước giờ check-in.

```
Mobile App                  API Gateway          Check-in Module          PostgreSQL
    │                            │                     │                       │
    │ GET /api/checkin/preload   │                     │                       │
    │ ?workshop_id={id}          │                     │                       │
    ├───────────────────────────►│                     │                       │
    │                            │ Verify JWT          │                       │
    │                            │ requireRole(staff)  │                       │
    │                            ├────────────────────►│                       │
    │                            │                     │                       │
    │                            │                     │ SELECT                │
    │                            │                     │   r.qr_code,          │
    │                            │                     │   u.full_name,        │
    │                            │                     │   u.student_id        │
    │                            │                     │ FROM registrations r  │
    │                            │                     │ JOIN users u          │
    │                            │                     │   ON u.id = r.user_id │
    │                            │                     │ WHERE r.workshop_id=$1│
    │                            │                     │   AND r.status=       │
    │                            │                     │   'confirmed'         │
    │                            │                     ├──────────────────────►│
    │                            │                     │◄──────────────────────┤
    │                            │◄────────────────────┤                       │
    │◄───────────────────────────┤                     │                       │
    │ 200 OK                     │                     │                       │
    │ {                          │                     │                       │
    │   workshopId,              │                     │                       │
    │   preloadedAt,             │                     │                       │
    │   records: [               │                     │                       │
    │     { qr_code,             │                     │                       │
    │       studentName,         │                     │                       │
    │       studentId },         │                     │                       │
    │     ...                    │                     │                       │
    │   ]                        │                     │                       │
    │ }                          │                     │                       │
    │                            │                     │                       │
    │ [Mobile lưu vào SQLite]    │                     │                       │
    │ INSERT OR REPLACE INTO     │                     │                       │
    │ valid_qr_codes             │                     │                       │
    │ (qr_code, student_name,    │                     │                       │
    │  student_id, workshop_id,  │                     │                       │
    │  preloaded_at)             │                     │                       │
```

**SQLite schema trên thiết bị Mobile:**

```sql
-- Danh sách QR hợp lệ tải về trước sự kiện
CREATE TABLE IF NOT EXISTS valid_qr_codes (
  qr_code      TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_id   TEXT NOT NULL,
  workshop_id  TEXT NOT NULL,
  preloaded_at TEXT NOT NULL,  -- ISO8601
  PRIMARY KEY (qr_code, workshop_id)
);

-- Hàng đợi check-in chờ đồng bộ lên server
CREATE TABLE IF NOT EXISTS offline_checkins (
  id           TEXT PRIMARY KEY,  -- UUID v4 local
  qr_code      TEXT NOT NULL,
  workshop_id  TEXT NOT NULL,
  checked_in_at TEXT NOT NULL,    -- ISO8601, thời điểm quét thực tế
  device_id    TEXT NOT NULL,
  is_synced    INTEGER NOT NULL DEFAULT 0,  -- 0: pending, 1: synced, 2: conflict
  sync_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (qr_code, workshop_id)   -- chặn scan trùng ngay trên thiết bị
);

CREATE INDEX IF NOT EXISTS idx_offline_unsynced
  ON offline_checkins(is_synced) WHERE is_synced = 0;
```

---

### Luồng B — Check-in Online (có mạng)

**Precondition**: Thiết bị có kết nối mạng, nhân sự đã đăng nhập (role=staff).

```
Mobile App               API Gateway         Check-in Module          PostgreSQL
    │                        │                     │                       │
    │ [Scan QR → lấy chuỗi  │                     │                       │
    │  qr_code string]       │                     │                       │
    │                        │                     │                       │
    │ POST /api/checkin      │                     │                       │
    │ {                      │                     │                       │
    │   qr_code,             │                     │                       │
    │   workshop_id,         │                     │                       │
    │   device_id            │                     │                       │
    │ }                      │                     │                       │
    ├───────────────────────►│                     │                       │
    │                        │ Verify JWT          │                       │
    │                        │ requireRole(staff)  │                       │
    │                        ├────────────────────►│                       │
    │                        │                     │                       │
    │                        │                     │ [1] SELECT            │
    │                        │                     │   r.id, r.status,     │
    │                        │                     │   r.user_id,          │
    │                        │                     │   u.full_name,        │
    │                        │                     │   w.title, w.end_time │
    │                        │                     │ FROM registrations r  │
    │                        │                     │ JOIN users u          │
    │                        │                     │ JOIN workshops w      │
    │                        │                     │ WHERE r.qr_code = $1  │
    │                        │                     │   AND r.workshop_id=$2│
    │                        │                     ├──────────────────────►│
    │                        │                     │◄──────────────────────┤
    │                        │                     │                       │
    │                        │                     │ [2] Business checks:  │
    │                        │                     │ - r.status='confirmed'│
    │                        │                     │ - w.end_time không    │
    │                        │                     │   quá 2h              │
    │                        │                     │                       │
    │                        │                     │ [3] SELECT id FROM    │
    │                        │                     │ checkins WHERE        │
    │                        │                     │ registration_id = r.id│
    │                        │                     ├──────────────────────►│
    │                        │                     │◄──────────────────────┤
    │                        │                     │ (nếu tìm thấy → E2)   │
    │                        │                     │                       │
    │                        │                     │ [4] BEGIN TRANSACTION │
    │                        │                     │                       │
    │                        │                     │ INSERT INTO checkins  │
    │                        │                     │ (registration_id,     │
    │                        │                     │  user_id,             │
    │                        │                     │  workshop_id,         │
    │                        │                     │  checkin_time: NOW(), │
    │                        │                     │  device_id)           │
    │                        │                     ├──────────────────────►│
    │                        │                     │                       │
    │                        │                     │ UPDATE registrations  │
    │                        │                     │ SET status='attended' │
    │                        │                     │ WHERE id = r.id       │
    │                        │                     ├──────────────────────►│
    │                        │                     │                       │
    │                        │                     │ COMMIT                │
    │                        │                     ├──────────────────────►│
    │                        │                     │◄──────────────────────┤
    │                        │◄────────────────────┤                       │
    │◄───────────────────────┤                     │                       │
    │ 200 OK                 │                     │                       │
    │ {                      │                     │                       │
    │   status: "success",   │                     │                       │
    │   studentName,         │                     │                       │
    │   workshopTitle,       │                     │                       │
    │   checkedInAt          │                     │                       │
    │ }                      │                     │                       │
```

App hiển thị kết quả **màu xanh** với tên sinh viên và tên workshop.

---

### Luồng C — Check-in Offline (mất mạng)

**Precondition**: Thiết bị mất kết nối, `valid_qr_codes` đã được preload.
Mobile App phát hiện offline qua Flutter `Connectivity` package.

#### C1 — Quét QR khi offline

```
Nhân sự          Mobile App                    SQLite local
    │                 │                              │
    │─ Quét QR ──────►│                              │
    │                 │                              │
    │                 │ [1] Lookup QR trong cache    │
    │                 │ SELECT * FROM valid_qr_codes │
    │                 │ WHERE qr_code = ?            │
    │                 │   AND workshop_id = ?        │
    │                 ├─────────────────────────────►│
    │                 │◄─────────────────────────────┤
    │                 │                              │
    │                 │ [Nếu không tìm thấy]         │
    │                 │ → Hiện "Mã QR không hợp lệ" │
    │                 │   cho sự kiện này (dừng)     │
    │                 │                              │
    │                 │ [Nếu tìm thấy]               │
    │                 │                              │
    │                 │ [2] Kiểm tra đã scan chưa    │
    │                 │ SELECT * FROM offline_checkins│
    │                 │ WHERE qr_code = ?            │
    │                 │   AND workshop_id = ?        │
    │                 ├─────────────────────────────►│
    │                 │◄─────────────────────────────┤
    │                 │                              │
    │                 │ [Nếu đã tồn tại]             │
    │                 │ → Hiện "Đã check-in lúc X"  │
    │                 │   (màu vàng, dừng)           │
    │                 │                              │
    │                 │ [Nếu chưa có]                │
    │                 │                              │
    │                 │ [3] INSERT offline_checkins  │
    │                 │ { id: uuid_v4(),             │
    │                 │   qr_code,                   │
    │                 │   workshop_id,               │
    │                 │   checked_in_at: NOW(),      │
    │                 │   device_id,                 │
    │                 │   is_synced: 0 }             │
    │                 ├─────────────────────────────►│
    │                 │◄─────────────────────────────┤
    │                 │                              │
    │◄ ✅ OFFLINE OK ─│                              │
    │  "Nguyễn Văn A" │                              │
    │  "(Offline)"    │                              │
```

App hiển thị kết quả **màu vàng** để phân biệt với online (màu xanh).

---

#### C2 — Đồng bộ lên server khi mạng phục hồi

Flutter `Connectivity` callback phát hiện `connected` → trigger sync tự động.

```
Mobile App                API Gateway       Check-in Module           PostgreSQL
    │                          │                  │                        │
    │ [Đọc SQLite pending]     │                  │                        │
    │ SELECT * FROM            │                  │                        │
    │ offline_checkins         │                  │                        │
    │ WHERE is_synced = 0      │                  │                        │
    │ LIMIT 50                 │                  │                        │
    │                          │                  │                        │
    │ POST /api/checkin/sync-offline              │                        │
    │ {                        │                  │                        │
    │   records: [             │                  │                        │
    │     { localId,           │                  │                        │
    │       qr_code,           │                  │                        │
    │       workshop_id,       │                  │                        │
    │       checked_in_at,     │                  │                        │
    │       device_id },       │                  │                        │
    │     ...                  │                  │                        │
    │   ]                      │                  │                        │
    │ }                        │                  │                        │
    ├─────────────────────────►│                  │                        │
    │                          │ Verify JWT       │                        │
    │                          │ requireRole(staff)                        │
    │                          ├─────────────────►│                        │
    │                          │                  │                        │
    │                          │                  │ [Với mỗi record]       │
    │                          │                  │                        │
    │                          │                  │ SELECT r.id, r.status  │
    │                          │                  │ FROM registrations r   │
    │                          │                  │ WHERE r.qr_code = $1   │
    │                          │                  │   AND r.workshop_id=$2 │
    │                          │                  ├───────────────────────►│
    │                          │                  │◄───────────────────────┤
    │                          │                  │                        │
    │                          │                  │ [Nếu không tìm thấy]  │
    │                          │                  │ → mark conflict:       │
    │                          │                  │   INVALID_QR           │
    │                          │                  │                        │
    │                          │                  │ [Nếu tìm thấy]        │
    │                          │                  │                        │
    │                          │                  │ INSERT INTO checkins   │
    │                          │                  │ (registration_id,      │
    │                          │                  │  user_id,              │
    │                          │                  │  workshop_id,          │
    │                          │                  │  checkin_time:         │
    │                          │                  │    record.checked_in_at│
    │                          │                  │  device_id)            │
    │                          │                  │ ON CONFLICT            │
    │                          │                  │ (registration_id)      │
    │                          │                  │ DO NOTHING             │
    │                          │                  ├───────────────────────►│
    │                          │                  │                        │
    │                          │                  │ [Nếu conflict]         │
    │                          │                  │ → mark conflict:       │
    │                          │                  │   ALREADY_CHECKED_IN   │
    │                          │                  │                        │
    │                          │                  │ UPDATE registrations   │
    │                          │                  │ SET status='attended'  │
    │                          │                  │ WHERE id = r.id        │
    │                          │                  │ (nếu chưa attended)    │
    │                          │                  ├───────────────────────►│
    │                          │◄─────────────────┤                        │
    │◄─────────────────────────┤                  │                        │
    │ 200 OK                   │                  │                        │
    │ {                        │                  │                        │
    │   processed: 48,         │                  │                        │
    │   success: 46,           │                  │                        │
    │   skipped: 1,            │                  │                        │
    │   conflicts: [           │                  │                        │
    │     { localId,           │                  │                        │
    │       reason:            │                  │                        │
    │       "ALREADY_CHECKED_IN│                  │                        │
    │        _ONLINE" }        │                  │                        │
    │   ]                      │                  │                        │
    │ }                        │                  │                        │
    │                          │                  │                        │
    │ [Update SQLite]          │                  │                        │
    │ Success → is_synced = 1  │                  │                        │
    │ Conflict → is_synced = 2 │                  │                        │
    │           sync_error = X │                  │                        │
    │                          │                  │                        │
    │ [Nếu còn pending]        │                  │                        │
    │ Gửi batch tiếp theo      │                  │                        │
    │ (LIMIT 50 tiếp)          │                  │                        │
```

**Tại sao batch 50 thay vì tất cả?**
Tránh request quá lớn khi mạng mới phục hồi, dễ retry hơn khi thất bại.

**Idempotency của sync endpoint:**
`INSERT ON CONFLICT DO NOTHING` đảm bảo gửi lại cùng batch nhiều lần
không tạo duplicate trong DB. Server luôn trả về kết quả nhất quán.

---

#### C3 — Retry khi sync thất bại

```
POST /api/checkin/sync-offline thất bại (network error, 5xx):

  Lần 1: retry sau 15 giây
  Lần 2: retry sau 60 giây
  Lần 3: retry sau 300 giây (5 phút)
  Sau 3 lần: dừng tự động retry

  Tiếp tục retry mỗi khi:
    - App chuyển lên foreground VÀ
    - Connectivity = connected VÀ
    - Có records is_synced = 0

  Hiển thị badge: "X bản ghi chờ đồng bộ" trên màn hình chính của app.
```

---

## Kịch bản lỗi

### E1 — QR code không hợp lệ (không tồn tại trong DB / sai workshop)

- **Online**: Check-in Module query không tìm thấy registration với
  `qr_code + workshop_id` này.
  → `404 { code: "QR_NOT_FOUND" }`
  → App hiển thị "Mã QR không hợp lệ" với icon đỏ.
- **Offline**: `SELECT` trong `valid_qr_codes` không trả về kết quả.
  → App từ chối ngay, không ghi vào `offline_checkins`.
  → Hiển thị "Mã QR không thuộc sự kiện này".

### E2 — Sinh viên quét QR lần 2 (trùng)

- **Online**: Check-in Module tìm thấy record trong bảng `checkins`
  với `registration_id` này.
  → `409 { code: "ALREADY_CHECKED_IN", checkedInAt: "..." }`
  → App hiển thị "Sinh viên đã check-in lúc 08:05" màu vàng warning.
  → Nhân sự thấy thông tin nhưng không bị coi là lỗi hệ thống.
- **Offline**: UNIQUE constraint `(qr_code, workshop_id)` trong SQLite
  bắt ngay tại thiết bị.
  → App hiển thị "Đã ghi nhận check-in (offline) lúc 08:05".

### E3 — Registration không ở trạng thái `confirmed`

- Xảy ra khi: sinh viên đã hủy đăng ký nhưng vẫn show QR cũ, hoặc
  registration `pending` (chưa thanh toán xong).
- `400 { code: "REGISTRATION_NOT_CONFIRMED", currentStatus: "cancelled" }`
- App hiển thị "Đăng ký không hợp lệ — trạng thái: Đã hủy".

### E4 — Workshop đã kết thúc quá 2 giờ

- Backend kiểm tra `w.end_time + INTERVAL '2 hours' < NOW()`.
- `400 { code: "WORKSHOP_ENDED" }`
- App hiển thị "Workshop đã kết thúc, không thể check-in".
- Thời gian buffer 2 giờ để nhân sự xử lý các trường hợp đến muộn.

### E5 — Thiết bị chưa preload trước khi offline

- App mở màn hình scan nhưng `valid_qr_codes` rỗng hoặc không có
  record cho `workshop_id` hiện tại.
- App hiển thị cảnh báo: "Chưa tải danh sách cho sự kiện này.
  Vui lòng kết nối mạng và thực hiện Preload trước khi vào khu vực
  check-in."
- Không cho phép scan cho đến khi preload thành công.

### E6 — Sync thất bại do mạng ngắt giữa chừng (partial batch)

- Request POST sync bị ngắt, server không biết đã xử lý bao nhiêu record.
- **Giải pháp**: Server endpoint idempotent nhờ `ON CONFLICT DO NOTHING`.
  App gửi lại toàn bộ batch (kể cả record đã sync), server bỏ qua
  duplicate và trả về kết quả nhất quán.
- Trong SQLite: chỉ update `is_synced = 1` cho các `localId` trong
  response `success` list. Không update blind.

### E7 — Race condition: cùng QR được scan online VÀ offline gần đồng thời

- Nhân sự A scan online tại t=0s (thành công, ghi vào `checkins`).
- Nhân sự B scan offline tại t=1s (ghi vào `offline_checkins`).
- Khi B sync lên: `INSERT ON CONFLICT DO NOTHING` bỏ qua.
- Response trả về: record của B nằm trong `conflicts` với reason
  `ALREADY_CHECKED_IN_ONLINE`, kèm thông tin checkin trước đó.
- **Kết quả**: DB chỉ có 1 checkin record. Không mất dữ liệu.

### E8 — Đồng hồ thiết bị bị lệch (device clock skew)

- `checked_in_at` trong offline record có thể sai nếu thiết bị chỉnh
  sai giờ.
- Backend lưu `checkin_time = record.checked_in_at` (thời gian thiết bị)
  và `created_at = NOW()` (thời gian server insert) vào bảng `checkins`.
- Không reject record dựa trên time skew — chỉ dùng cho audit log.
- Nhân sự nên đồng bộ đồng hồ thiết bị trước sự kiện.

### E9 — Thiết bị hết bộ nhớ, SQLite full

- Flutter kiểm tra available storage trước mỗi `INSERT offline_checkins`.
- Nếu available < 50MB: hiển thị cảnh báo "Bộ nhớ thiết bị gần đầy",
  đề nghị nhân sự dùng thiết bị khác hoặc sync ngay.
- Nếu INSERT thất bại: hiển thị lỗi rõ ràng, KHÔNG silent fail.
  Nhân sự phải được biết để ghi chép thủ công.

### E10 — Preload trả về danh sách rỗng

- Workshop chưa có ai đăng ký confirmed, hoặc sai `workshop_id`.
- Server trả `200 OK` với `records: []`.
- App hiển thị cảnh báo "Không có sinh viên đã xác nhận cho sự kiện này"
  và không cho phép scan offline (để tránh nhầm lẫn).

---

## Ràng buộc

### Hiệu năng

- `POST /api/checkin`: p99 < 500ms.
- `GET /api/checkin/preload`: p99 < 2s (phụ thuộc số lượng registrations).
  Nếu workshop > 500 người, cân nhắc pagination hoặc streaming response.
- `POST /api/checkin/sync-offline`: batch tối đa **50 records/request**.
  Nếu pending queue > 50, app chia nhiều request gửi tuần tự.
- SQLite cleanup: xóa records `is_synced = 1` sau 24 giờ kể từ `created_at`
  để không tích tụ dữ liệu cũ trên thiết bị.

### Bảo mật

- Chỉ `role = 'staff'` mới được gọi mọi endpoint `/api/checkin/*`.
- `device_id` được log để audit nhưng không dùng làm yếu tố xác thực.
- QR code là UUID v4 — đủ entropy để không thể đoán (2^122 khả năng).
- Preload response không chứa thông tin nhạy cảm hơn mức cần thiết
  (chỉ `qr_code`, `student_name`, `student_id` — không có email, phone).

### Tính nhất quán

- `UNIQUE (registration_id)` trong bảng `checkins` là guardrail cuối cùng
  ở DB layer — mọi path (online và offline sync) đều bị constraint này.
- Transaction bao gồm cả `INSERT checkins` VÀ `UPDATE registrations.status
  = 'attended'` — hai thao tác này phải atomic, không được tách rời.
- Thứ tự ưu tiên khi conflict: bản ghi nào ghi vào DB trước thì thắng
  (first-write-wins). Không có cơ chế merge.

### Offline capability

- App phải hoạt động hoàn toàn không cần server cho luồng scan sau preload.
- Thời gian offline tối đa: không giới hạn về mặt thiết kế — app không
  tự xóa `is_synced = 0` theo thời gian.
- Preload data không có TTL cứng — nhưng nhân sự nên preload lại trước
  mỗi ngày sự kiện để có danh sách mới nhất.

---

## Tiêu chí chấp nhận

| ID    | Kịch bản                                                                    | Kết quả mong đợi                                                       |
|-------|-----------------------------------------------------------------------------|------------------------------------------------------------------------|
| AC-01 | Staff scan QR hợp lệ, có mạng                                              | 200, hiển thị tên sinh viên + workshop, màu xanh                       |
| AC-02 | Staff scan QR của sinh viên đã check-in trước đó (online)                  | 409 ALREADY_CHECKED_IN, hiển thị giờ check-in cũ, màu vàng            |
| AC-03 | Staff scan QR của sinh viên đã hủy đăng ký                                 | 400 REGISTRATION_NOT_CONFIRMED, hiển thị trạng thái cancelled          |
| AC-04 | Staff scan QR hợp lệ, thiết bị offline (đã preload)                       | Ghi vào SQLite, hiển thị "✓ Check-in ghi nhận (Offline)", màu vàng    |
| AC-05 | Staff scan cùng QR lần 2, thiết bị offline                                 | App từ chối, hiển thị "Đã ghi nhận lúc X", không tạo duplicate SQLite |
| AC-06 | Staff scan QR không có trong preload cache (offline)                        | App từ chối ngay "Mã QR không thuộc sự kiện này"                       |
| AC-07 | Mạng phục hồi sau khi có 30 records offline                                | App tự động sync, 30 records lên server, is_synced = 1                 |
| AC-08 | Server nhận sync batch: 1 record đã online check-in trước đó               | Record đó → conflict ALREADY_CHECKED_IN_ONLINE, còn lại success        |
| AC-09 | Gửi lại cùng sync batch đã gửi thành công trước đó (idempotency test)      | Server xử lý OK, không tạo duplicate, trả về consistent result         |
| AC-10 | Sync batch thất bại 3 lần liên tiếp                                         | App dừng auto-retry, hiển thị badge "X bản ghi chờ đồng bộ"           |
| AC-11 | Token của student cố gọi POST /api/checkin                                  | 403 FORBIDDEN                                                           |
| AC-12 | Token của admin cố gọi POST /api/checkin                                    | 403 FORBIDDEN                                                           |
| AC-13 | Staff gọi GET /api/checkin/preload cho workshop_id hợp lệ                  | 200, nhận danh sách qr_code + studentName, app lưu vào SQLite          |
| AC-14 | Staff mở app khi chưa preload, cố scan QR offline                          | App hiển thị cảnh báo preload, không cho scan                           |
| AC-15 | INSERT checkins thành công → registrations.status vẫn là confirmed         | Không chấp nhận — transaction phải update cả hai (atomically)          |
| AC-16 | Workshop đã kết thúc > 2 giờ, staff cố scan online                         | 400 WORKSHOP_ENDED                                                      |
| AC-17 | Preload workshop có 0 confirmed registrations                                | 200 OK với records: [], app hiển thị cảnh báo không có sinh viên       |
| AC-18 | Hai thiết bị scan cùng QR: 1 online, 1 offline (race)                      | DB có đúng 1 checkin record; bên offline sync nhận conflict response    |
