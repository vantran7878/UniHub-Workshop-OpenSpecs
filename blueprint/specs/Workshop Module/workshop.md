# Workshop Management — Feature Specs

Tổng quan: Module được chia thành **6 feature** độc lập, có thể implement và review riêng lẻ. Thứ tự thực hiện theo dependency từ trên xuống.

---

## Feature 1 — Database Schema & Workshop Model

**Mục tiêu:** Thiết lập nền tảng dữ liệu cho toàn bộ workshop module.

**Việc cần làm:**
- Tạo bảng `workshops` với các trường:
  - `id` (UUID)
  - `title` (string, not null)
  - `description` (text)
  - `location` (string)
  - `starts_at` (timestamptz, not null)
  - `ends_at` (timestamptz, not null)
  - `capacity` (integer, not null)
  - `status` (`draft` | `published` | `cancelled`)
  - `pricing_type` (`free` | `paid`)
  - `created_by` (UUID, FK → `users.id`)
  - `created_at`, `updated_at`
- Tạo bảng `workshop_pricing` với các trường:
  - `id` (UUID)
  - `workshop_id` (UUID, FK → `workshops.id`, unique)
  - `base_price` (decimal, not null)
  - `currency` (char(3), default `VND`)
  - `early_bird_price` (decimal, nullable)
  - `early_bird_deadline` (timestamptz, nullable)
- Viết migration script (up + down).
- Seed script tạo 2–3 workshop mẫu để dev/test.

**Acceptance criteria:**
- Migration chạy thành công và rollback được.
- `ends_at` phải lớn hơn `starts_at` — ràng buộc ở DB level (check constraint).
- `capacity` phải > 0 — ràng buộc ở DB level.
- Bảng `workshop_pricing` chỉ tồn tại khi `pricing_type = paid`; nếu `free` thì không có row tương ứng.

**Dependencies:** Không có.

---

## Feature 2 — Create & Read Workshop

**Mục tiêu:** Cho phép admin tạo workshop mới và đọc danh sách / chi tiết workshop.

---

### 2a. Create Workshop

**Endpoint:** `POST /api/admin/workshops`

**Request body:**
```json
{
  "title": "UX Research 101",
  "description": "Workshop nhập môn UX Research",
  "location": "Phòng B2, Tòa nhà A",
  "starts_at": "2025-09-01T09:00:00+07:00",
  "ends_at": "2025-09-01T12:00:00+07:00",
  "capacity": 30,
  "pricing_type": "free"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "title": "UX Research 101",
  "status": "draft",
  "pricing_type": "free",
  "created_at": "2025-08-01T10:00:00+07:00"
}
```

**Việc cần làm:**
- Validate tất cả required fields.
- Validate `ends_at > starts_at`.
- Validate `capacity > 0`.
- Gán `status = draft` mặc định — client không được tự set status.
- Gán `created_by = request.user.userId`.
- Nếu `pricing_type = paid`: bắt buộc phải gọi thêm endpoint pricing (Feature 3) để set giá — chưa lưu pricing ở bước này.
- Ghi audit log: `WORKSHOP_CREATED`.

**Error cases:**
| Tình huống | Response |
|---|---|
| Thiếu `title`, `starts_at`, `ends_at`, hoặc `capacity` | `400 Bad Request` |
| `ends_at` ≤ `starts_at` | `400 Bad Request` |
| `capacity` ≤ 0 | `400 Bad Request` |
| `pricing_type` không hợp lệ | `400 Bad Request` |
| Không có access token hoặc role không phải `admin` | `401` / `403` |

**Acceptance criteria:**
- Workshop được tạo với `status = draft`, bất kể client gửi giá trị nào cho `status`.
- `created_by` luôn là ID của admin đang đăng nhập, không thể override từ request body.
- Tạo workshop `paid` mà chưa set pricing → workshop vẫn được tạo, nhưng không thể publish (sẽ chặn ở Feature 4).

---

### 2b. List Workshops

**Endpoint:** `GET /api/admin/workshops`

**Query params:**
| Param | Loại | Mô tả |
|---|---|---|
| `status` | string | Lọc theo status (`draft`, `published`, `cancelled`) |
| `pricing_type` | string | Lọc theo loại giá |
| `from` | ISO date | Lọc workshop bắt đầu từ ngày này |
| `to` | ISO date | Lọc workshop kết thúc đến ngày này |
| `page` | integer | Trang hiện tại (default: 1) |
| `limit` | integer | Số item mỗi trang (default: 20, max: 100) |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "UX Research 101",
      "starts_at": "2025-09-01T09:00:00+07:00",
      "status": "published",
      "pricing_type": "free",
      "capacity": 30,
      "registration_count": 18
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

**Việc cần làm:**
- Query có filter, sort mặc định theo `starts_at DESC`.
- Join với bảng `registrations` để tính `registration_count`.
- Paginate kết quả.

---

### 2c. Get Workshop Detail

**Endpoint:** `GET /api/admin/workshops/:id`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "UX Research 101",
  "description": "...",
  "location": "Phòng B2",
  "starts_at": "2025-09-01T09:00:00+07:00",
  "ends_at": "2025-09-01T12:00:00+07:00",
  "capacity": 30,
  "status": "published",
  "pricing_type": "paid",
  "pricing": {
    "base_price": 500000,
    "currency": "VND",
    "early_bird_price": 350000,
    "early_bird_deadline": "2025-08-15T23:59:59+07:00"
  },
  "registration_count": 18,
  "created_by": "uuid",
  "created_at": "2025-08-01T10:00:00+07:00",
  "updated_at": "2025-08-05T14:30:00+07:00"
}
```

**Error cases:**
| Tình huống | Response |
|---|---|
| `id` không tồn tại | `404 Not Found` |

**Acceptance criteria:**
- Nếu workshop `free`, field `pricing` trả về `null`.
- `registration_count` luôn là số thực từ DB, không được cache cứng.

**Dependencies:** Feature 1.

---

## Feature 3 — Pricing Setup

**Mục tiêu:** Cho phép admin cấu hình giá cho workshop paid.

**Endpoint:** `POST /api/admin/workshops/:id/pricing`

**Request body:**
```json
{
  "base_price": 500000,
  "currency": "VND",
  "early_bird_price": 350000,
  "early_bird_deadline": "2025-08-15T23:59:59+07:00"
}
```

**Response (200 OK):**
```json
{
  "workshop_id": "uuid",
  "base_price": 500000,
  "currency": "VND",
  "early_bird_price": 350000,
  "early_bird_deadline": "2025-08-15T23:59:59+07:00",
  "updated_at": "2025-08-01T10:00:00+07:00"
}
```

**Việc cần làm:**
- Chỉ áp dụng cho workshop có `pricing_type = paid`; nếu `free` thì từ chối.
- Upsert vào bảng `workshop_pricing` (tạo mới nếu chưa có, cập nhật nếu đã có).
- Validate `base_price > 0`.
- Nếu có `early_bird_price`: validate `early_bird_price < base_price` và `early_bird_deadline` phải trước `starts_at` của workshop.
- Nếu đã có registration tồn tại: **cảnh báo** trong response (field `warning`), không chặn cập nhật — admin tự chịu trách nhiệm.
- Ghi audit log: `PRICING_UPDATED` với `old_value` và `new_value`.

**Error cases:**
| Tình huống | Response |
|---|---|
| Workshop `id` không tồn tại | `404 Not Found` |
| Workshop có `pricing_type = free` | `400 Bad Request` |
| `base_price` ≤ 0 | `400 Bad Request` |
| `early_bird_price` ≥ `base_price` | `400 Bad Request` |
| `early_bird_deadline` sau `starts_at` của workshop | `400 Bad Request` |
| Workshop đã `cancelled` | `409 Conflict` |

**Acceptance criteria:**
- Gọi endpoint 2 lần → lần 2 update thay vì tạo row mới (upsert).
- Đổi giá khi đã có registration → response có thêm field `warning: "Workshop đã có X registrations. Thay đổi giá sẽ không ảnh hưởng đến các đăng ký đã thanh toán."`.
- Audit log ghi đầy đủ `old_value` / `new_value` dạng JSON.

**Dependencies:** Feature 1, Feature 2.

---

## Feature 4 — Update & Cancel Workshop

**Mục tiêu:** Cho phép admin chỉnh sửa thông tin workshop và huỷ workshop khi cần.

---

### 4a. Update Workshop

**Endpoint:** `PUT /api/admin/workshops/:id`

**Request body** (tất cả fields đều optional — partial update):
```json
{
  "title": "UX Research 101 — Updated",
  "location": "Phòng C3",
  "capacity": 40
}
```

**Response (200 OK):** Trả về toàn bộ workshop object đã cập nhật (cấu trúc giống 2c).

**Việc cần làm:**
- Chỉ cho phép cập nhật các fields: `title`, `description`, `location`, `starts_at`, `ends_at`, `capacity`.
- Không cho phép thay đổi `pricing_type`, `status`, `created_by` qua endpoint này.
- Validate `capacity` mới ≥ `registration_count` hiện tại — không được giảm capacity xuống dưới số người đã đăng ký.
- Validate `ends_at > starts_at` nếu cập nhật một trong hai.
- Nếu thay đổi `starts_at`, `ends_at`, hoặc `location`: đánh dấu `needs_notification = true` để trigger gửi email cho participants (xử lý async, không block response).
- Ghi audit log: `WORKSHOP_UPDATED` với `changed_fields`, `old_value`, `new_value`.

**Error cases:**
| Tình huống | Response |
|---|---|
| Workshop `id` không tồn tại | `404 Not Found` |
| Workshop đã `cancelled` | `409 Conflict` |
| `capacity` mới < số registration hiện tại | `400 Bad Request` |
| `ends_at` ≤ `starts_at` sau khi cập nhật | `400 Bad Request` |
| Cố tình set `status` hoặc `created_by` | Bỏ qua silently (không báo lỗi) |

**Acceptance criteria:**
- Giảm capacity xuống dưới số người đã đăng ký → `400`, kèm message rõ ràng số người hiện tại.
- Thay đổi `location` → audit log ghi `old_value: { location: "Phòng B2" }`, `new_value: { location: "Phòng C3" }`.
- Publish một workshop `paid` chưa có pricing → `400 Bad Request` với message yêu cầu set pricing trước.

---

### 4b. Cancel Workshop

**Endpoint:** `PATCH /api/admin/workshops/:id/cancel`

**Request body:**
```json
{
  "reason": "Giảng viên bị bệnh, sẽ dời lịch sau."
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "cancelled",
  "cancelled_at": "2025-08-10T08:00:00+07:00",
  "reason": "Giảng viên bị bệnh, sẽ dời lịch sau."
}
```

**Việc cần làm:**
- Set `status = cancelled`.
- Không xóa dữ liệu — mọi registration vẫn được giữ trong DB với `status = cancelled`.
- Trigger async job: gửi email thông báo huỷ đến toàn bộ participants (kèm `reason`).
- Nếu workshop là `paid`: trigger refund flow cho các registration đã thanh toán (xử lý async).
- Ghi audit log: `WORKSHOP_CANCELLED` với `reason` và `registration_count` tại thời điểm huỷ.

**Error cases:**
| Tình huống | Response |
|---|---|
| Workshop `id` không tồn tại | `404 Not Found` |
| Workshop đã `cancelled` | `409 Conflict` |
| `reason` bị bỏ trống | `400 Bad Request` |

**Acceptance criteria:**
- Workshop bị cancel không thể update hay publish được nữa.
- Cancel workshop `paid` có registrations → refund job được enqueue (kiểm tra bằng job queue, không cần refund thật trong test).
- Gọi cancel 2 lần → lần 2 trả về `409`.

**Dependencies:** Feature 1, Feature 2.

---

## Feature 5 — Analytics & Reporting

**Mục tiêu:** Cung cấp số liệu thống kê và danh sách participants cho từng workshop.

---

### 5a. Registration Statistics

**Endpoint:** `GET /api/admin/workshops/:id/stats`

**Response (200 OK):**
```json
{
  "workshop_id": "uuid",
  "capacity": 30,
  "registration_count": 18,
  "capacity_used_pct": 60.0,
  "waitlist_count": 3,
  "revenue": {
    "total_collected": 9000000,
    "currency": "VND",
    "pending_count": 2
  },
  "registrations_over_time": [
    { "date": "2025-08-01", "count": 5 },
    { "date": "2025-08-02", "count": 8 },
    { "date": "2025-08-03", "count": 5 }
  ]
}
```

**Việc cần làm:**
- Tính `capacity_used_pct = registration_count / capacity * 100`, làm tròn 1 chữ số thập phân.
- Field `revenue` chỉ xuất hiện nếu workshop là `paid`; nếu `free` thì `revenue: null`.
- `registrations_over_time`: group by ngày, tính cumulative hoặc daily count (ghi rõ trong response field `count_type: "daily"`).

**Error cases:**
| Tình huống | Response |
|---|---|
| Workshop `id` không tồn tại | `404 Not Found` |

---

### 5b. Participant List

**Endpoint:** `GET /api/admin/workshops/:id/participants`

**Query params:**
| Param | Loại | Mô tả |
|---|---|---|
| `payment_status` | string | `paid`, `pending`, `refunded` |
| `attendance_status` | string | `attended`, `absent`, `not_marked` |
| `page` | integer | Default: 1 |
| `limit` | integer | Default: 50, max: 200 |

**Response (200 OK):**
```json
{
  "data": [
    {
      "registration_id": "uuid",
      "user_id": "uuid",
      "full_name": "Nguyen Van A",
      "email": "a@example.com",
      "registered_at": "2025-08-02T10:30:00+07:00",
      "payment_status": "paid",
      "attendance_status": "not_marked"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 18
  }
}
```

**Việc cần làm:**
- Join bảng `registrations` với `users`.
- Áp dụng filter theo `payment_status` và `attendance_status`.
- Sort mặc định theo `registered_at ASC`.

---

### 5c. Export Participant List

**Endpoint:** `GET /api/admin/workshops/:id/participants/export`

**Query params:**
| Param | Loại | Mô tả |
|---|---|---|
| `format` | string | `csv` hoặc `xlsx` (default: `csv`) |

**Response:** File download với header:
```
Content-Disposition: attachment; filename="participants-<workshop-id>.csv"
Content-Type: text/csv
```

**Việc cần làm:**
- Generate file với các cột: `full_name`, `email`, `registered_at`, `payment_status`, `attendance_status`.
- Stream response — không load toàn bộ data vào memory.

**Acceptance criteria:**
- Export 0 participants → file vẫn hợp lệ, chỉ có header row.
- File CSV encode UTF-8 BOM để Excel Windows hiển thị tiếng Việt đúng.

---

### 5d. Aggregate Report

**Endpoint:** `GET /api/admin/reports/workshops`

**Query params:**
| Param | Loại | Mô tả |
|---|---|---|
| `from` | ISO date | Bắt đầu khoảng thời gian |
| `to` | ISO date | Kết thúc khoảng thời gian |
| `status` | string | Lọc theo status |

**Response (200 OK):**
```json
{
  "summary": {
    "total_workshops": 12,
    "total_registrations": 320,
    "total_revenue": 45000000,
    "currency": "VND"
  },
  "workshops": [
    {
      "id": "uuid",
      "title": "UX Research 101",
      "starts_at": "2025-09-01T09:00:00+07:00",
      "status": "published",
      "registration_count": 18,
      "capacity": 30,
      "revenue": 9000000
    }
  ]
}
```

**Acceptance criteria:**
- `total_revenue` chỉ tính các payment có `payment_status = paid`.
- Khoảng thời gian `from`/`to` filter theo `starts_at` của workshop.

**Dependencies:** Feature 1, Feature 2, cần có dữ liệu registrations từ module Registration.

---

## Feature 6 — Audit Logging

**Mục tiêu:** Ghi lại mọi hành động quản trị quan trọng trên workshop để phục vụ truy vết.

**Việc cần làm:**
- Tái sử dụng bảng `audit_logs` từ Auth Module (Feature 1 của Auth).
- Tạo service `auditLog(event, metadata)` ghi log bất đồng bộ (không block response).
- Audit log là **append-only** — không có API xóa hoặc sửa.

**Các event cần log:**

| Event | Metadata |
|---|---|
| `WORKSHOP_CREATED` | `workshop_id`, `title`, `created_by`, `ip` |
| `WORKSHOP_UPDATED` | `workshop_id`, `changed_fields`, `old_value`, `new_value`, `updated_by`, `ip` |
| `WORKSHOP_CANCELLED` | `workshop_id`, `reason`, `registration_count`, `cancelled_by`, `ip` |
| `WORKSHOP_PUBLISHED` | `workshop_id`, `published_by`, `ip` |
| `PRICING_UPDATED` | `workshop_id`, `old_value`, `new_value`, `updated_by`, `ip` |
| `CAPACITY_CHANGED` | `workshop_id`, `old_capacity`, `new_capacity`, `updated_by`, `ip` |

> **Lưu ý:** `CAPACITY_CHANGED` được log **riêng** dù capacity thay đổi thông qua `WORKSHOP_UPDATED` — để dễ query theo loại hành động nhạy cảm.

**Endpoint xem audit log:**

`GET /api/admin/audit-logs`

**Query params:**
| Param | Loại | Mô tả |
|---|---|---|
| `entity_type` | string | `workshop` |
| `entity_id` | UUID | ID của workshop cụ thể |
| `event_type` | string | Lọc theo loại event |
| `admin_id` | UUID | Lọc theo admin thực hiện |
| `from` | ISO date | Từ ngày |
| `to` | ISO date | Đến ngày |
| `page` | integer | Default: 1 |
| `limit` | integer | Default: 50 |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "event_type": "CAPACITY_CHANGED",
      "entity_type": "workshop",
      "entity_id": "uuid",
      "metadata": {
        "old_capacity": 30,
        "new_capacity": 50,
        "updated_by": "uuid"
      },
      "ip_address": "203.0.113.5",
      "created_at": "2025-08-05T14:30:00+07:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 23
  }
}
```

**Acceptance criteria:**
- Mỗi lần update capacity tạo đúng 1 bản ghi `CAPACITY_CHANGED` trong DB.
- Không có endpoint nào cho phép xóa hoặc sửa audit log.
- Audit log không chứa thông tin nhạy cảm (payment card, raw token, v.v.).
- Admin không có quyền xem audit log của chính mình hay của admin khác ngoài mục đích truy vết — endpoint này chỉ dành cho `role = admin`.

**Dependencies:** Feature 1 của Auth Module, tích hợp vào Feature 2–5 của module này.

---

## Thứ tự implement gợi ý

```
Feature 1 (Schema)
    ↓
Feature 2 (Create & Read) ──→ Feature 3 (Pricing Setup)
                ↓
        Feature 4 (Update & Cancel)
                ↓
        Feature 5 (Analytics & Reporting)
                ↓
        Feature 6 (Audit Logging) ← tích hợp xuyên suốt từ Feature 2
```

> **Lưu ý:** Feature 6 (Audit Logging) nên được tích hợp dần vào mỗi feature trước đó thay vì để cuối — tránh phải quay lại sửa nhiều chỗ. Ưu tiên log `WORKSHOP_CREATED`, `WORKSHOP_CANCELLED`, và `CAPACITY_CHANGED` trước vì đây là các hành động nhạy cảm nhất.