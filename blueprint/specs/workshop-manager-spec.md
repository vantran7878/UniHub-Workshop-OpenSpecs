# Đặc tả: Quản lý Workshop (Workshop Manager — Admin CRUD)

## Mô tả

Tính năng này cung cấp cho `admin` đầy đủ khả năng tạo, xem, chỉnh sửa và xóa workshop. Đây là tính năng **đồng bộ** — mọi thao tác CRUD trả kết quả ngay lập tức trong cùng một request/response cycle, không qua message broker.

Bốn thách thức chính cần xử lý:

- **Tính nhất quán khi chỉnh sửa:** Thay đổi `capacity` khi đã có đăng ký tồn tại không được tạo ra tình trạng oversell. Thay đổi `price` chỉ áp dụng cho đăng ký mới, không ảnh hưởng đăng ký cũ đã thanh toán.
- **Xóa an toàn:** Workshop đã có đăng ký `confirmed` không được xóa vật lý. Phải hủy (`cancelled`) và thông báo cho sinh viên đã đăng ký.
- **Cache invalidation:** Sau mỗi thao tác ghi (tạo, sửa, hủy, xóa), các Redis key liên quan phải được xóa để sinh viên không thấy dữ liệu cũ.
- **Audit trail:** Mọi thao tác ghi của admin phải được ghi vào `audit_logs` để truy vết sau này.

---

## Luồng chính

### Tổng quan các thành phần tham gia

| Thành phần | Vai trò |
|---|---|
| Web App (Next.js Admin Portal) | Giao diện quản lý workshop cho admin |
| API Gateway (Nginx) | Xác thực JWT, kiểm tra `role = admin` (Layer 1 & 2), rate limiting |
| Workshop Service | Xử lý toàn bộ logic nghiệp vụ CRUD |
| PostgreSQL | Source of truth: bảng `workshops`, `registrations`, `audit_logs` |
| Redis | Cache danh sách workshop và seat counter — phải invalidate sau mỗi thao tác ghi |
| RabbitMQ (`notification.queue`) | Gửi thông báo hủy cho sinh viên khi workshop bị cancel/delete |

---

### 1. Tạo Workshop (CREATE)

```
Admin (Web)     API Gateway      Workshop Svc         PostgreSQL         Redis
    │                │                │                    │                │
    │─POST /workshops►│                │                    │                │
    │  {title, desc,  │                │                    │                │
    │   speaker, room,│                │                    │                │
    │   capacity,     │                │                    │                │
    │   start_time,   │                │                    │                │
    │   end_time,     │                │                    │                │
    │   is_paid,      │                │                    │                │
    │   price,        │                │                    │                │
    │   registration_ │                │                    │                │
    │   open_at,      │                │                    │                │
    │   registration_ │                │                    │                │
    │   close_at}     │                │                    │                │
    │                 │                │                    │                │
    │                 ├─Verify JWT     │                    │                │
    │                 ├─role = admin?  │                    │                │
    │                 │                │                    │                │
    │                 │───────────────►│                    │                │
    │                 │                │                    │                │
    │                 │                ├─Validate input     │                │
    │                 │                │  (xem ràng buộc)   │                │
    │                 │                │                    │                │
    │                 │                ├─INSERT workshops──►│                │
    │                 │                │  created_by=       │                │
    │                 │                │  {admin_id}        │                │
    │                 │                │◄─ workshop row ────│                │
    │                 │                │                    │                │
    │                 │                ├─INSERT audit_logs─►│                │
    │                 │                │  action=           │                │
    │                 │                │  'CREATE_WORKSHOP' │                │
    │                 │                │  new_values={...}  │                │
    │                 │                │                    │                │
    │                 │                ├─DEL workshop_list──┼────────────────►
    │                 │                │  cache             │  DEL workshop: │
    │                 │                │                    │  list:*        │
    │                 │                │                    │                │
    │◄─201 {workshop}─│◄───────────────│                    │                │
```

**Validation khi tạo:**

| Trường | Quy tắc |
|---|---|
| `title` | Bắt buộc, 1–255 ký tự |
| `capacity` | Bắt buộc, số nguyên > 0 |
| `start_time` | Bắt buộc, phải ở tương lai |
| `end_time` | Bắt buộc, phải sau `start_time` |
| `registration_open_at` | Bắt buộc, phải trước `registration_close_at` |
| `registration_close_at` | Bắt buộc, phải trước `start_time` |
| `is_paid = true` | `price` bắt buộc và > 0 |
| `is_paid = false` | `price` bỏ qua hoặc phải = 0 |

---

### 2. Xem danh sách và chi tiết Workshop (READ)

```
Client (any role)   API Gateway     Workshop Svc        Redis          PostgreSQL
       │                │                │                 │                │
       │─GET /workshops─►               │                 │                │
       │  ?status=active│               │                 │                │
       │  &page=1        │               │                 │                │
       │  &limit=20      │               │                 │                │
       │                 ├─Verify JWT    │                 │                │
       │                 │──────────────►│                 │                │
       │                 │               ├─GET workshop:   │                │
       │                 │               │  list:{hash}   ►│                │
       │                 │               │◄─ HIT: data ────│                │
       │◄─200 [{...}] ───│◄──────────────│                 │                │
       │                 │               │                 │                │
       │                 │               │  [Cache MISS]   │                │
       │                 │               ├─SELECT workshops┼────────────────►
       │                 │               │  + seat_count   │                │
       │                 │               │◄─ rows ─────────┼────────────────│
       │                 │               ├─SET workshop:   │                │
       │                 │               │  list:{hash}   ►│                │
       │                 │               │  TTL=30s        │                │
       │◄─200 [{...}] ───│◄──────────────│                 │                │
```

Với `GET /workshops/:id`: tương tự, cache key là `workshop:{id}`, TTL 30 giây.

Với `GET /workshops/:id/participants` (chỉ `admin`): không cache, luôn đọc thẳng từ DB vì cần dữ liệu realtime để admin điểm danh.

Với `GET /workshops/statistics` (chỉ `admin`): tổng hợp số workshop theo trạng thái, tổng đăng ký, tổng doanh thu. Cache TTL 60 giây, invalidate sau mọi thao tác ghi.

---

### 3. Cập nhật Workshop (UPDATE)

Update có hai loại hành vi khác nhau tùy trường được sửa. Workshop Service phân biệt và xử lý riêng:

```
Admin (Web)      API Gateway      Workshop Svc              PostgreSQL           Redis
    │                │                │                          │                  │
    │─PUT /workshops/ ►│               │                          │                  │
    │  :id            │               │                          │                  │
    │  {fields...}    │               │                          │                  │
    │                 ├─Verify JWT    │                          │                  │
    │                 ├─role = admin? │                          │                  │
    │                 │──────────────►│                          │                  │
    │                 │               │                          │                  │
    │                 │               ├─SELECT workshops──────►  │                  │
    │                 │               │  FOR UPDATE              │                  │
    │                 │               │◄─ current row ──────────-│                  │
    │                 │               │                          │                  │
    │                 │               ├─[workshop.status = cancelled?]               │
    │                 │               │   → 409 "Workshop đã hủy, không thể sửa"    │
    │                 │               │                          │                  │
    │                 │               ├─Validate từng trường thay đổi               │
    │                 │               │  (xem bảng phân loại bên dưới)              │
    │                 │               │                          │                  │
    │                 │               ├─UPDATE workshops─────────►│                  │
    │                 │               │  SET {fields},           │                  │
    │                 │               │  updated_at=NOW()        │                  │
    │                 │               │                          │                  │
    │                 │               ├─INSERT audit_logs─────►  │                  │
    │                 │               │  action='UPDATE_WORKSHOP' │                  │
    │                 │               │  old_values={trước}      │                  │
    │                 │               │  new_values={sau}        │                  │
    │                 │               │                          │                  │
    │                 │               ├─DEL cache keys──────────►┼─────────────────►│
    │                 │               │  workshop:{id}           │  DEL workshop:id │
    │                 │               │  workshop:list:*         │  DEL list:*      │
    │                 │               │  workshop:{id}:seats_*   │  DEL seats:*     │
    │                 │               │                          │                  │
    │◄─200 {workshop}─│◄──────────────│                          │                  │
```

**Phân loại trường có thể sửa và ràng buộc:**

| Trường | Điều kiện cho phép sửa | Ràng buộc nghiệp vụ |
|---|---|---|
| `title`, `description`, `speaker`, `room` | Bất kỳ lúc nào khi `status != cancelled` | Không |
| `start_time`, `end_time` | Chưa có `confirmed` registration nào | Không thể sửa giờ khi đã có người đăng ký thành công |
| `registration_open_at`, `registration_close_at` | `registration_close_at` phải chưa qua | Phải thỏa mãn `open < close < start_time` |
| `capacity` | Giá trị mới ≥ số `confirmed` registrations hiện tại | Không được giảm xuống dưới số đã đăng ký |
| `price` | Bất kỳ lúc nào | Chỉ áp dụng cho đăng ký **mới**. Đăng ký `confirmed` cũ giữ nguyên giá đã thanh toán. |
| `is_paid` | Chưa có `confirmed` registration nào | Không thể đổi từ miễn phí sang có phí (hoặc ngược lại) khi đã có người đăng ký |
| `status` → `cancelled` | Xem luồng hủy riêng bên dưới | Không dùng PUT để hủy — dùng `DELETE /workshops/:id` |
| `status` → `completed` | Chỉ tự động bởi cron job | Admin không được tự set `completed` |

---

### 4. Hủy và Xóa Workshop (DELETE)

`DELETE /workshops/:id` có hai hành vi tùy trạng thái:

```
Admin gọi DELETE /workshops/:id
              │
              ▼
    SELECT workshops
    + COUNT confirmed registrations
    FOR UPDATE
              │
              ├── confirmed_count = 0 (chưa ai đăng ký thành công)
              │         │
              │         ▼
              │   Hard delete:
              │   DELETE FROM workshops WHERE id = :id
              │   (CASCADE xóa registrations, workshop_summaries)
              │   INSERT audit_logs (action='DELETE_WORKSHOP')
              │   DEL Redis cache keys
              │   → 204 No Content
              │
              └── confirmed_count > 0 (đã có sinh viên đăng ký thành công)
                        │
                        ▼
                  Soft cancel:
                  UPDATE workshops SET status='cancelled'
                  UPDATE registrations SET status='cancelled'
                    WHERE workshop_id = :id
                    AND status IN ('confirmed', 'pending')
                  INSERT audit_logs (action='CANCEL_WORKSHOP')
                  DEL Redis cache keys
                  PUBLISH notification.queue:
                    {type: 'workshop_cancelled',
                     workshop_id, affected_user_ids}
                  → 200 {status: 'cancelled',
                          affected_registrations: N}
```

> **Lý do không xóa vật lý khi có người đăng ký:** Lịch sử đăng ký và thanh toán của sinh viên phải được bảo toàn. Sinh viên đã thanh toán cần bằng chứng để yêu cầu hoàn tiền. Audit trail không được phá vỡ.

**Luồng xử lý hoàn tiền (ngoài phạm vi tính năng này):** Notification Service nhận event `workshop_cancelled` và gửi thông báo cho sinh viên kèm hướng dẫn yêu cầu hoàn tiền thủ công qua admin. Payment refund tự động là tính năng riêng.

---

## Kịch bản lỗi

### Validation thất bại khi tạo / sửa

Trả lỗi đồng bộ ngay tại Workshop Service, không ghi DB, không ghi audit log.

| Vi phạm | HTTP | Message |
|---|---|---|
| `end_time <= start_time` | 400 | "Thời gian kết thúc phải sau thời gian bắt đầu" |
| `registration_close_at >= start_time` | 400 | "Hết hạn đăng ký phải trước khi workshop bắt đầu" |
| `is_paid=true` nhưng `price` thiếu hoặc = 0 | 400 | "Workshop có phí phải có giá > 0" |
| `capacity < confirmed_count` khi sửa | 409 | "Số chỗ mới ({N}) nhỏ hơn số đã đăng ký ({M})" |
| `start_time` trong quá khứ khi tạo mới | 400 | "Thời gian bắt đầu phải ở tương lai" |
| Sửa `start_time` / `end_time` khi đã có `confirmed` | 409 | "Không thể sửa giờ khi đã có {N} người đăng ký thành công" |
| Sửa `is_paid` khi đã có `confirmed` | 409 | "Không thể thay đổi loại phí khi đã có người đăng ký" |

### Xung đột khi nhiều admin sửa cùng lúc

```
Admin A đang sửa workshop X
Admin B cũng sửa workshop X cùng lúc

Workshop Service dùng SELECT ... FOR UPDATE
→ Admin A acquire lock trước
→ Admin B phải chờ (tối đa 3 giây lock timeout)
→ Nếu Admin A commit xong trong 3s:
     Admin B đọc dữ liệu mới nhất, tiếp tục xử lý
→ Nếu Admin A giữ lock > 3s:
     Admin B nhận 409 "Dữ liệu đang được cập nhật bởi người khác, vui lòng thử lại"
```

Last-write-wins trong giới hạn lock. Không implement optimistic locking (ETag) trong phiên bản này.

### Sửa capacity xuống dưới số đã đăng ký

```
Workshop X: capacity=50, confirmed=45
Admin muốn sửa capacity xuống 40

Workshop Service:
  SELECT COUNT(*) FROM registrations
    WHERE workshop_id = X AND status = 'confirmed'
  → 45 > 40 → trả 409 ngay lập tức
  Không ghi DB, không ghi audit log
```

### Xóa workshop trong khi sinh viên đang trong luồng đăng ký

```
T=0: Sinh viên A đang ở bước thanh toán cho workshop X (registration.status='pending')
T=1: Admin xóa workshop X (soft cancel vì có confirmed registrations khác)

Kết quả:
  Sinh viên A có registration.status='pending' → bị UPDATE thành 'cancelled'
  Sinh viên A nhận notification 'workshop_cancelled'
  Luồng thanh toán của A hoàn thành sau đó:
    Payment Svc nhận kết quả gateway
    → UPDATE registration: workshop đã cancelled
    → Trả về lỗi cho client: "Workshop đã bị hủy"
    → Payment Service không tạo registration 'confirmed' cho workshop đã cancelled
    → Nếu đã charge tiền → payment.status='refund_pending' (xử lý thủ công)
```

### Cache stale sau ghi thất bại

```
Workshop Service:
  1. UPDATE workshops → thành công
  2. INSERT audit_logs → thành công
  3. DEL Redis keys → thất bại (Redis tạm down)

Hành động:
  Log lỗi cấp WARN với workshopId
  Không rollback DB (dữ liệu DB đúng là nguồn chính)
  Redis key tự hết TTL sau 30 giây → cache tự refresh đúng
  Chấp nhận stale cache tối đa 30 giây
```

### Hủy workshop không notify được sinh viên (RabbitMQ down)

```
Workshop Service:
  1. UPDATE workshops SET status='cancelled' → thành công
  2. UPDATE registrations → thành công
  3. INSERT audit_logs → thành công
  4. PUBLISH notification.queue → thất bại

Hành động:
  Retry publish 3 lần (1s → 2s → 4s)
  Vẫn thất bại → log lỗi ERROR với danh sách user_ids cần notify
  Trả 200 cho admin kèm cảnh báo:
    "Workshop đã hủy thành công. Thông báo đến {N} sinh viên chưa gửi được,
     vui lòng kiểm tra và thông báo thủ công."
  (DB đã đúng — notification là best-effort)
```

---

## Ràng buộc

### Kiến trúc

- CRUD workshop là luồng **đồng bộ** — không qua message broker. Chỉ notification hủy mới publish lên RabbitMQ.
- Mọi thao tác ghi phải ghi `audit_logs` trong **cùng DB transaction**. Không ghi audit ngoài transaction (tránh tình trạng ghi workshop thành công nhưng audit bị mất).
- Redis cache là **read-through** với TTL 30 giây. DB là source of truth. Không có trường hợp nào chỉ ghi Redis mà không ghi DB.

### Phân quyền

- `POST /workshops`, `PUT /workshops/:id`, `DELETE /workshops/:id`, `GET /workshops/:id/participants`, `GET /workshops/statistics` — chỉ `admin`.
- `GET /workshops`, `GET /workshops/:id` — mọi role (kể cả unauthenticated nếu có workshop public — ngoài phạm vi tính năng này, mặc định yêu cầu JWT).
- Admin chỉ xem và sửa được workshop. Không có khái niệm "admin chỉ quản lý workshop của mình" — mọi admin đều có quyền ngang nhau.

### Tính nhất quán dữ liệu

- `capacity` không bao giờ nhỏ hơn số `confirmed` registrations. Constraint này được kiểm tra ở **application layer** (không chỉ DB constraint) để trả lỗi rõ ràng.
- `status = 'completed'` chỉ do cron job tự động set khi `end_time` đã qua. Admin không set trực tiếp.
- `price` sau khi sửa chỉ áp dụng cho payment mới. Giá của payment `confirmed` cũ được lưu trong `payments.amount` — không phụ thuộc vào `workshops.price` hiện tại.
- Hard delete chỉ được phép khi **không có** bản ghi `registrations` với `status = 'confirmed'`. `CASCADE` xử lý xóa các bản ghi con (`pending`, `cancelled`, `workshop_summaries`).

### Audit Log

Mỗi thao tác ghi phải tạo một bản ghi `audit_logs` với:
- `actor_id`: UUID của admin thực hiện (từ JWT).
- `action`: `CREATE_WORKSHOP`, `UPDATE_WORKSHOP`, `CANCEL_WORKSHOP`, `DELETE_WORKSHOP`.
- `resource_type`: `'workshop'`.
- `resource_id`: UUID của workshop.
- `old_values`: snapshot JSON toàn bộ row trước khi thay đổi (`null` với CREATE).
- `new_values`: snapshot JSON toàn bộ row sau khi thay đổi (`null` với DELETE).
- `ip_address`, `user_agent`: lấy từ request header.

### Cache Invalidation

Sau mỗi thao tác ghi thành công, Workshop Service xóa các Redis keys sau:
- `workshop:{id}:seats_available`
- `workshop:{id}:registered_count`
- `workshop:list:*` (xóa theo pattern — tất cả variant của danh sách)
- `workshop:statistics` (nếu có cache statistics)

Xóa cache là **best-effort**: thất bại không rollback DB, chỉ log WARN.

### Hiệu năng

- `GET /workshops` (danh sách): phải trả về trong < 200ms với cache hit. Cache miss < 500ms.
- `POST`, `PUT`, `DELETE`: không có yêu cầu cache, chấp nhận 500ms–1s cho các thao tác có DB transaction.
- `GET /workshops/:id/participants`: không cache, chấp nhận 1s vì cần dữ liệu realtime.

---

## Tiêu chí chấp nhận

### Tạo Workshop (CREATE)

- [ ] Admin tạo workshop hợp lệ → nhận `201` với đầy đủ thông tin workshop, `created_by` = UUID của admin đang đăng nhập.
- [ ] `audit_logs` có bản ghi `CREATE_WORKSHOP` với `new_values` chứa đầy đủ trường của workshop vừa tạo.
- [ ] Redis cache danh sách (`workshop:list:*`) bị xóa sau khi tạo thành công.
- [ ] `is_paid = true` không có `price` → `400`.
- [ ] `end_time` trước `start_time` → `400`.
- [ ] `registration_close_at` sau `start_time` → `400`.
- [ ] `start_time` trong quá khứ → `400`.

### Xem Workshop (READ)

- [ ] `GET /workshops` trả danh sách đúng theo filter `status`, có phân trang (`page`, `limit`), bao gồm số chỗ còn lại (`seats_available`).
- [ ] Request thứ hai đến `GET /workshops` với cùng filter trả kết quả từ Redis cache (kiểm tra bằng query count DB không tăng).
- [ ] `GET /workshops/:id/participants` trả danh sách sinh viên `confirmed`, chỉ admin gọi được.
- [ ] Sinh viên gọi `GET /workshops/:id/participants` → `403`.

### Cập nhật Workshop (UPDATE)

- [ ] Admin sửa `title`, `description`, `speaker`, `room` → `200`, DB cập nhật, cache `workshop:{id}` và `workshop:list:*` bị invalidate.
- [ ] `audit_logs` có bản ghi `UPDATE_WORKSHOP` với `old_values` là snapshot trước, `new_values` là snapshot sau.
- [ ] Admin giảm `capacity` xuống dưới số `confirmed` → `409` với message rõ số hiện tại và số yêu cầu.
- [ ] Admin sửa `capacity` lên bằng hoặc hơn số `confirmed` → `200`.
- [ ] Admin sửa `start_time` khi có `confirmed` registration → `409`.
- [ ] Admin sửa `price` thành công → giá cũ trong `payments.amount` của các đăng ký đã `confirmed` không thay đổi.
- [ ] Admin sửa workshop có `status = 'cancelled'` → `409`.

### Hủy và Xóa Workshop (DELETE)

- [ ] Admin xóa workshop **chưa có** `confirmed` registration → `204`, DB xóa vật lý, `registrations` liên quan (nếu có `pending`) cũng bị xóa (CASCADE).
- [ ] Admin xóa workshop **đã có** `confirmed` registration → `200`, `workshops.status = 'cancelled'`, tất cả `confirmed` và `pending` registrations chuyển `cancelled`, notification được publish lên RabbitMQ.
- [ ] `audit_logs` có bản ghi `DELETE_WORKSHOP` hoặc `CANCEL_WORKSHOP` tương ứng.
- [ ] Sau khi hủy, `GET /workshops/:id` trả `status = 'cancelled'` (không trả `404`).
- [ ] Cache `workshop:{id}`, `workshop:list:*` bị invalidate sau khi hủy.

### Cache Invalidation

- [ ] Tạo/sửa/xóa workshop xong: request `GET /workshops` tiếp theo hit DB (cache miss), không trả dữ liệu cũ.
- [ ] Cache tự hồi phục sau 30 giây mà không cần can thiệp thủ công.

### Audit Log

- [ ] Mọi thao tác CREATE, UPDATE, DELETE / CANCEL đều tạo bản ghi `audit_logs` trong cùng transaction.
- [ ] Nếu DB transaction rollback (ví dụ validation thất bại), không có bản ghi `audit_logs` nào được tạo.
- [ ] `audit_logs.actor_id` luôn là UUID của admin đang đăng nhập (không null, không sai).

### Kiểm thử thủ công (smoke test)

**Test 1 — Happy path tạo và xem:**
Admin tạo workshop có phí. Kỳ vọng: `201`. Gọi `GET /workshops/:id` → thấy đúng dữ liệu. Gọi lần 2 → DB query count không tăng (cache hit). Kiểm tra `audit_logs`: có bản ghi `CREATE_WORKSHOP`.

**Test 2 — Sửa capacity an toàn:**
Workshop có 10 `confirmed` registrations. Admin sửa `capacity` từ 50 xuống 8 → `409`. Sửa xuống 10 → `200`. Sửa xuống 15 → `200`. `audit_logs` chỉ có 1 bản ghi `UPDATE_WORKSHOP` (lần thành công).

**Test 3 — Xóa có người đăng ký:**
Workshop có 5 `confirmed` registrations. Admin DELETE. Kỳ vọng: `200`, `workshops.status = 'cancelled'`, 5 registrations chuyển `cancelled`. RabbitMQ có 1 message trong `notification.queue`. Kiểm tra `audit_logs`: `CANCEL_WORKSHOP` với `old_values.status = 'active'`.

**Test 4 — Xóa không có người đăng ký:**
Workshop mới tạo, chưa ai đăng ký. Admin DELETE. Kỳ vọng: `204`. `SELECT * FROM workshops WHERE id = ?` → không tìm thấy. `audit_logs`: `DELETE_WORKSHOP` với `old_values` chứa snapshot, `new_values = null`.

**Test 5 — Phân quyền:**
Sinh viên gọi `POST /workshops` → `403`. Staff gọi `DELETE /workshops/:id` → `403`. Admin gọi `POST /workshops` với payload hợp lệ → `201`.
