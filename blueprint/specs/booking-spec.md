# Đặc tả: Đặt chỗ Workshop — Booking (Sinh viên xem & đăng ký)

## Mô tả

Tính năng này cho phép sinh viên xem danh sách workshop, xem chi tiết từng workshop và thực hiện đăng ký (có phí hoặc miễn phí). Đây là module **Booking** — ranh giới nghiệp vụ bao gồm toàn bộ hành trình từ khi sinh viên nhìn thấy workshop đến khi nhận được mã QR xác nhận.

Luồng đăng ký là **đồng bộ**: Booking Module gọi Payment Module trực tiếp qua internal function call và chờ kết quả trước khi trả về cho sinh viên. Chỉ notification sau khi xác nhận mới đi qua RabbitMQ bất đồng bộ.

Bốn thách thức chính:

- **Tranh chấp chỗ ngồi:** Nhiều sinh viên đăng ký vào chỗ cuối cùng cùng lúc — chỉ đúng một người được xác nhận.
- **Tải trọng đột biến:** Hàng nghìn sinh viên cùng mở đăng ký khi workshop hot vừa mở — hệ thống không được sập hoặc oversell.
- **Idempotency thanh toán:** Sinh viên bấm "Đăng ký" nhiều lần hoặc mạng lỗi retry — không được trừ tiền hai lần.
- **Tính nhất quán trạng thái:** Workshop hết hạn đăng ký, bị hủy, hoặc đã đủ người — sinh viên phải thấy trạng thái chính xác, không phải dữ liệu cũ từ cache.

---

## Luồng chính

### Tổng quan các thành phần tham gia

| Thành phần | Vai trò |
|---|---|
| Web App / Mobile App | Sinh viên xem workshop, đăng ký, nhận QR |
| API Gateway (Nginx) | Xác thực JWT, rate limiting Token Bucket, routing |
| Booking Module | Kiểm tra điều kiện đăng ký, giữ slot, gọi Payment Module |
| Payment Module | Kiểm tra idempotency, gọi sandbox gateway, trả kết quả |
| PostgreSQL | Source of truth: `workshops`, `registrations`, `payments` |
| Redis | Seat cache (hiển thị), idempotency key, rate limit counter, distributed lock |
| RabbitMQ (`notification.queue`) | Gửi email/push sau khi `confirmed` — bất đồng bộ, không chặn response |

---

### 1. Xem danh sách Workshop

```
Client (student)   API Gateway     Booking Module      Redis           PostgreSQL
       │                │                │                │                 │
       │─GET /workshops─►               │                │                 │
       │  ?status=active│               │                │                 │
       │  &page=1        │               │                │                 │
       │                 ├─Verify JWT    │                │                 │
       │                 │──────────────►│                │                 │
       │                 │               ├─GET workshop:  │                 │
       │                 │               │  list:{hash} ─►│                 │
       │                 │               │                │                 │
       │                 │               │ [Cache HIT]    │                 │
       │◄─200 [{...}] ───│◄──────────────│◄─ data ────────│                 │
       │                 │               │                │                 │
       │                 │               │ [Cache MISS]   │                 │
       │                 │               ├─SELECT workshops┼────────────────►
       │                 │               │  + seats_avail  │                │
       │                 │               │◄─ rows ─────────┼────────────────│
       │                 │               ├─SET list:{hash}►│  TTL=30s       │
       │◄─200 [{...}] ───│◄──────────────│                 │                │
```

Response mỗi workshop trong danh sách bao gồm: `id`, `title`, `speaker`, `room`, `start_time`, `end_time`, `is_paid`, `price`, `capacity`, `seats_available` (từ Redis cache), `status`, `registration_open_at`, `registration_close_at`.

`seats_available` đọc từ Redis key `workshop:{id}:seats_available` (TTL 30 giây). Nếu cache miss, tính từ DB và ghi vào cache. Giá trị này **chỉ dùng để hiển thị** — không dùng để quyết định cấp slot.

---

### 2. Xem chi tiết Workshop

```
Client (student)   API Gateway     Booking Module       Redis           PostgreSQL
       │                │                │                 │                 │
       │─GET /workshops─►               │                 │                 │
       │  /:id           │               │                 │                 │
       │                 ├─Verify JWT    │                 │                 │
       │                 │──────────────►│                 │                 │
       │                 │               ├─GET workshop:   │                 │
       │                 │               │  {id}:cached ──►│                 │
       │                 │               │                 │                 │
       │                 │               │ [Cache HIT]     │                 │
       │◄─200 {workshop}─│◄──────────────│◄─ data ─────────│                 │
       │                 │               │                 │                 │
       │                 │               │ [Cache MISS]    │                 │
       │                 │               ├─SELECT workshop─┼────────────────►│
       │                 │               │  + seats_avail  │                 │
       │                 │               │◄─ row ──────────┼─────────────────│
       │                 │               ├─SET {id}:cached►│  TTL=300s       │
       │◄─200 {workshop}─│◄──────────────│                 │                 │
```

Trang chi tiết hiển thị thêm: `description`, `summary` (từ AI PDF nếu có), nút đăng ký với trạng thái động (xem bảng trạng thái nút bên dưới).

**Trạng thái nút "Đăng ký" phía client:**

| Điều kiện | Trạng thái nút |
|---|---|
| `status = 'cancelled'` | Disabled — "Workshop đã hủy" |
| `status = 'completed'` | Disabled — "Workshop đã kết thúc" |
| `NOW() < registration_open_at` | Disabled — "Chưa mở đăng ký (mở lúc HH:MM DD/MM)" |
| `NOW() > registration_close_at` | Disabled — "Đã hết hạn đăng ký" |
| `seats_available = 0` | Disabled — "Hết chỗ" (stale 30s, có thể không chính xác) |
| Đã có `registration.status IN (confirmed, pending)` | Disabled — "Bạn đã đăng ký" |
| Đủ điều kiện | Active — "Đăng ký ngay" / "Đăng ký và thanh toán" |

> Trạng thái nút là **best-effort** dựa trên cache. Kiểm tra thực sự xảy ra ở server khi sinh viên bấm đăng ký.

---

### 3. Đăng ký Workshop Miễn phí

```
Client (student)  API Gateway    Booking Module         PostgreSQL        Redis         RabbitMQ
      │                │               │                    │                │              │
      │─POST /register─►│              │                    │                │              │
      │  {workshop_id}  │              │                    │                │              │
      │                 ├─Verify JWT   │                    │                │              │
      │                 ├─Rate limit───┼────────────────────┼────────────────►              │
      │                 │──────────────►│                    │                │              │
      │                 │               │                    │                │              │
      │                 │               ├─[BEGIN TRANSACTION]│                │              │
      │                 │               │                    │                │              │
      │                 │               ├─SELECT workshops───►                │              │
      │                 │               │  FOR UPDATE        │                │              │
      │                 │               │  (capacity, status,│                │              │
      │                 │               │   reg_open/close,  │                │              │
      │                 │               │   confirmed_count) │                │              │
      │                 │               │◄─ row ─────────────│                │              │
      │                 │               │                    │                │              │
      │                 │               ├─[Kiểm tra điều kiện — xem bảng guard bên dưới]    │
      │                 │               │                    │                │              │
      │                 │               ├─INSERT registrations►               │              │
      │                 │               │  status='confirmed'│                │              │
      │                 │               │  qr_code=UUID()    │                │              │
      │                 │               │  UNIQUE(user,ws)   │                │              │
      │                 │               │◄─ OK ──────────────│                │              │
      │                 │               │                    │                │              │
      │                 │               ├─[COMMIT]───────────►                │              │
      │                 │               │                    │                │              │
      │                 │               ├─DEL seats cache────┼────────────────►              │
      │                 │               │  workshop:{id}:    │                │              │
      │                 │               │  seats_available   │                │              │
      │                 │               │                    │                │              │
      │                 │               ├─PUBLISH notification►───────────────┼─────────────►
      │                 │               │  {type:'confirmed',│                │              │
      │                 │               │   user_id, ws_id,  │                │              │
      │                 │               │   qr_code}         │                │              │
      │                 │               │                    │                │              │
      │◄─200 {qr_code}──│◄──────────────│                    │                │              │
```

**Bảng guard — kiểm tra điều kiện trước INSERT (trong DB transaction):**

| Kiểm tra | Điều kiện thất bại | Response |
|---|---|---|
| Workshop tồn tại | Không tìm thấy row | `404 "Workshop không tồn tại"` |
| Trạng thái workshop | `status != 'active'` | `409 "Workshop không còn nhận đăng ký"` |
| Cửa sổ đăng ký | `NOW() < registration_open_at` | `409 "Chưa đến giờ mở đăng ký"` |
| Cửa sổ đăng ký | `NOW() > registration_close_at` | `409 "Đã hết hạn đăng ký"` |
| Còn chỗ | `capacity - confirmed_count <= 0` | `409 "Workshop đã hết chỗ"` |
| Chưa đăng ký | `UNIQUE(user_id, workshop_id)` vi phạm | `409 "Bạn đã đăng ký workshop này"` |
| Sinh viên hợp lệ | `users.is_active = FALSE` | `403 "Tài khoản không còn hợp lệ"` |

---

### 4. Đăng ký Workshop Có Phí

```
Client (student)  API Gateway    Booking Module         PostgreSQL      Payment Module   Sandbox GW    Redis       RabbitMQ
      │                │               │                    │                │               │             │            │
      │─POST /register─►│              │                    │                │               │             │            │
      │  {workshop_id,  │              │                    │                │               │             │            │
      │   idempotency_  │              │                    │                │               │             │            │
      │   key}          │              │                    │                │               │             │            │
      │                 ├─Verify JWT   │                    │                │               │             │            │
      │                 ├─Rate limit──►│                    │                │               │             │            │
      │                 │──────────────►│                    │                │               │             │            │
      │                 │               │                    │                │               │             │            │
      │                 │               ├─[BEGIN TRANSACTION]│                │               │             │            │
      │                 │               ├─SELECT workshops───►                │               │             │            │
      │                 │               │  FOR UPDATE        │                │               │             │            │
      │                 │               │◄─ row ─────────────│                │               │             │            │
      │                 │               ├─[Guard checks]     │                │               │             │            │
      │                 │               ├─INSERT registrations►               │               │             │            │
      │                 │               │  status='pending'  │                │               │             │            │
      │                 │               │◄─ OK ──────────────│                │               │             │            │
      │                 │               ├─[COMMIT]───────────►                │               │             │            │
      │                 │               │                    │                │               │             │            │
      │                 │               ├─── Gọi trực tiếp (internal call) ──►│               │             │            │
      │                 │               │                    │                │               │             │            │
      │                 │               │                    │                ├─GET idempotent►             │            │
      │                 │               │                    │                │  key ─────────┼─────────────►            │
      │                 │               │                    │                │◄─ MISS ────────┼─────────────│            │
      │                 │               │                    │                ├─SET processing►─────────────►            │
      │                 │               │                    │                ├─Circuit Breaker closed?      │            │
      │                 │               │                    │                ├─POST /charge──►│             │            │
      │                 │               │                    │                │◄─ success ─────│             │            │
      │                 │               │                    │                ├─UPDATE payment─►             │            │
      │                 │               │                    │                │  status=success│             │            │
      │                 │               │                    │                ├─SET success───►─────────────►            │
      │                 │               │◄─── SUCCESS ────────────────────────│               │             │            │
      │                 │               │                    │                │               │             │            │
      │                 │               ├─UPDATE registration►                │               │             │            │
      │                 │               │  status='confirmed'│                │               │             │            │
      │                 │               ├─Gen QR code────────►                │               │             │            │
      │                 │               ├─DEL seats cache─────────────────────┼───────────────►             │            │
      │                 │               ├─PUBLISH notification►───────────────┼───────────────┼────────────►            │
      │◄─200 {qr_code}──│◄──────────────│                    │                │               │             │            │
```

**Sinh idempotency key — trách nhiệm của Client:**

```javascript
// React — sinh một lần duy nhất khi component mount
const [idempotencyKey] = useState(() => crypto.randomUUID());

// Giữ nguyên key khi retry — KHÔNG sinh key mới
await fetch('/api/register', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify({ workshop_id })
});
```

Format Redis key: `idempotent:payment:{userId}:{workshopId}:{uuid}` — ngăn hai user dùng trùng UUID.

---

### 5. Hủy đăng ký

```
Client (student)  API Gateway    Booking Module          PostgreSQL        RabbitMQ
      │                │               │                     │                 │
      │─POST /registrations►│          │                     │                 │
      │  /:id/cancel    │              │                     │                 │
      │                 ├─Verify JWT   │                     │                 │
      │                 │──────────────►│                     │                 │
      │                 │               ├─SELECT registration─►                 │
      │                 │               │  WHERE id = :id     │                 │
      │                 │               │  AND user_id = {me} │                 │
      │                 │               │◄─ row ──────────────│                 │
      │                 │               │                     │                 │
      │                 │               ├─[Kiểm tra có thể hủy không]           │
      │                 │               │  status = 'confirmed' AND             │
      │                 │               │  workshop.start_time > NOW() + 1h     │
      │                 │               │                     │                 │
      │                 │               ├─UPDATE registrations►                 │
      │                 │               │  SET status='cancelled'               │
      │                 │               │                     │                 │
      │                 │               ├─INVALIDATE qr_code──►                 │
      │                 │               │  (SET qr_code=NULL)  │                 │
      │                 │               │                     │                 │
      │                 │               ├─DEL seats cache──────►                │
      │                 │               ├─PUBLISH notification►─────────────────►
      │◄─200 {cancelled}│◄──────────────│                     │                 │
```

**Điều kiện cho phép hủy:**
- `registration.status = 'confirmed'`
- `workshop.start_time > NOW() + 1 giờ` (không hủy trong vòng 1 giờ trước khi bắt đầu)
- `registration.user_id = JWT.user_id` (chỉ hủy của chính mình)

Sinh viên **không** được hủy đăng ký có phí đã thanh toán trực tiếp qua hệ thống — phải liên hệ admin. Hoàn tiền là quy trình thủ công ngoài phạm vi tính năng này.

---

## Kịch bản lỗi

### 1. Tranh chấp chỗ ngồi — Race Condition

```
T=0: Workshop còn đúng 1 chỗ

Sinh viên A                              Sinh viên B
      │                                        │
      ├─POST /register ───────────────────────►│ (đồng thời)
      │                                        │
      │   [Booking Module A: BEGIN TRANSACTION]│   [Booking Module B: BEGIN TRANSACTION]
      │   SELECT workshops FOR UPDATE          │   SELECT workshops FOR UPDATE
      │   → A acquire row lock                 │   → B CHỜ (row đã bị A lock)
      │   remaining = 1 ✓                      │
      │   INSERT registration (pending/confirmed)
      │   COMMIT → lock giải phóng             │
      │                                        │   → B đọc lại: remaining = 0
      │                                        │   → ROLLBACK
      │                                        │◄── 409 "Workshop đã hết chỗ"
      │
      ├─ [Nếu paid: gọi Payment Module]
      ├─ ... (luồng happy path)
      ◄── 200 {qr_code}
```

`SELECT ... FOR UPDATE` serialize các request tranh chấp cùng một workshop. Redis seat counter **không tham gia** vào quyết định này — chỉ được DEL sau khi transaction commit để cache stale không còn hiển thị chỗ sai.

**Lock timeout:** Nếu chờ lock quá 3 giây (quá nhiều request dồn vào), ROLLBACK và trả `409 "Hệ thống đang bận, vui lòng thử lại"` thay vì làm queue DB tắc nghẽn.

### 2. Tải trọng đột biến khi mở đăng ký

```
12.000 sinh viên online lúc 8:00 AM — workshop hot mở đăng ký

Tầng 1 — Rate Limiting (API Gateway, Token Bucket):
  Per User  + /register: 5 req/phút
  Per IP:                120 req/phút
  Global:                60.000 req/phút
  Vượt ngưỡng → 429, header Retry-After: {N}s

Tầng 2 — DB Row Lock (SELECT ... FOR UPDATE):
  Serialize request tranh chấp cùng workshop
  Lock timeout: 3 giây → 409 "Hệ thống bận"

Tầng 3 — UNIQUE constraint DB:
  Chặn duplicate (user + workshop) ở tầng thấp nhất

Redis Seat Cache (chỉ đọc):
  GET /workshops và GET /workshops/:id đọc từ Redis (TTL 30s/300s)
  12.000 request đọc đồng thời không hit DB → giảm tải đáng kể
```

**Fallback khi Redis không khả dụng:**
- Rate limiting tắt → tăng tải DB, vẫn chạy nhưng chậm hơn.
- Seat cache miss → đọc thẳng DB cho mọi request đọc — tăng tải đáng kể.
- Row lock (DB) vẫn hoạt động → tính đúng đắn không bị ảnh hưởng.
- Idempotency key không kiểm tra được → có thể charge trùng, log cảnh báo.

### 3. Sinh viên bấm "Đăng ký" nhiều lần (Idempotency)

```
Client giữ nguyên idempotency_key = "abc-123"

Lần 1 (t=0s):
  POST /register {key: "abc-123"} → payment processing → success
  Redis: SET idempotent:...:abc-123 = {status:success, qr_code:...}
  [Network drop — client không nhận response]

Lần 2 — Retry (t=3s):
  POST /register {key: "abc-123"}
  Booking Module: kiểm tra UNIQUE(user, workshop) → đã tồn tại
  Booking Module: SELECT registration → status=confirmed
  Trả lại {qr_code} đã lưu trong DB ✅ (không gọi Payment lần 2)

Hoặc nếu đến được Payment Module:
  GET Redis key → HIT status=success → trả cached response ✅
```

**Đăng ký trùng sau khi confirmed:** Nếu UNIQUE constraint bắt được (cùng `user_id + workshop_id`), Booking Module SELECT lại bản ghi hiện có và trả lại `qr_code` đã có — không báo lỗi 409 gây nhầm lẫn cho sinh viên.

### 4. Đăng ký khi workshop sắp hết hạn (edge case thời gian)

```
registration_close_at = 12:00:00
Sinh viên gửi request lúc 11:59:58 (2 giây trước deadline)

API Gateway nhận lúc 11:59:58 ✓
Backend nhận lúc 11:59:59 ✓ (1ms lag)
SELECT FOR UPDATE tại PostgreSQL lúc 12:00:01 ✗ (quá deadline)

→ Guard check: NOW() > registration_close_at → true
→ ROLLBACK → 409 "Đã hết hạn đăng ký"
```

Thời gian kiểm tra là **server time tại PostgreSQL**, không phải client time hay API Gateway time. Tránh edge case client fake timestamp.

### 5. Hủy workshop sau khi sinh viên đang trong luồng đăng ký

```
T=0: Sinh viên đang chờ kết quả thanh toán (registration.status='pending')
T=1: Admin hủy workshop → tất cả 'pending' và 'confirmed' chuyển 'cancelled'

T=2: Payment Module nhận kết quả từ gateway (success)
  → UPDATE registration: workshop đã cancelled
  → Booking Module kiểm tra: registration.status='cancelled' → không gen QR
  → Nếu đã charge tiền → payment.status='refund_pending'
  → Response cho client: 409 "Workshop đã bị hủy trong khi xử lý"
```

### Bảng tổng hợp kịch bản lỗi

| Tình huống | Hành động | Response |
|---|---|---|
| Hết chỗ (seats = 0) | ROLLBACK, không tạo record | `409 "Workshop đã hết chỗ"` |
| Đã đăng ký trước đó | Trả lại qr_code cũ nếu confirmed, thông báo nếu pending | `200 {qr_code}` hoặc `202` |
| Ngoài cửa sổ đăng ký | ROLLBACK ngay trong guard check | `409 "Đã hết hạn"` / `"Chưa mở"` |
| Workshop không active | ROLLBACK ngay | `409 "Workshop không nhận đăng ký"` |
| Thanh toán timeout | Giữ `pending`, trả 202 | `202 "Đang xử lý"` |
| Thanh toán bị từ chối | ROLLBACK pending, hoàn slot | `402 "Thanh toán bị từ chối"` |
| Circuit Breaker OPEN | Fast-fail, ROLLBACK pending | `503 "Thanh toán tạm thời gián đoạn"` |
| Rate limit vượt | Từ chối tại API Gateway | `429 Retry-After: {N}s` |
| Lock timeout DB (>3s) | ROLLBACK | `409 "Hệ thống bận, thử lại sau"` |
| Workshop bị hủy giữa luồng | Không gen QR, đánh refund_pending | `409 "Workshop đã bị hủy"` |
| Notification lỗi | Log lỗi, retry qua broker | Không ảnh hưởng — QR đã trả về |

---

## Ràng buộc

### Thứ tự xử lý (bất biến về kiến trúc)

1. **Kiểm tra điều kiện workshop trước, giữ slot trước, gọi Payment sau.** Không gọi cổng thanh toán khi chưa biết còn chỗ hay không.
2. **DB (PostgreSQL) là source of truth cho slot.** `SELECT ... FOR UPDATE` trong transaction quyết định ai được slot — không dùng Redis làm nguồn quyết định.
3. **Workshop miễn phí bỏ qua hoàn toàn Payment Module.** Không có transaction, không có idempotency key, không có circuit breaker — chỉ INSERT và trả QR.
4. **QR code chỉ được sinh khi `registration.status = 'confirmed'`.** Không sinh QR cho `pending`.
5. **Notification publish là thao tác cuối cùng**, sau khi tất cả DB đã commit. Notification thất bại không rollback đăng ký.

### Tính nhất quán

- **UNIQUE(user_id, workshop_id)** ở tầng DB: chắc chắn không có hai bản ghi `confirmed` cho cùng một cặp.
- `capacity - confirmed_count` được tính bên trong transaction `FOR UPDATE` — không bao giờ cho phép oversell dù có race condition.
- Redis seat cache **bị DEL** ngay sau khi transaction commit thành công. Không giữ cache stale sau khi số chỗ thay đổi.
- Sinh viên `is_active = FALSE` (đã rời trường theo CSV sync) không được đăng ký workshop.

### Phân quyền

- `POST /register`, `POST /registrations/:id/cancel`, `GET /my-registrations` — chỉ `student`.
- `GET /workshops`, `GET /workshops/:id` — mọi role.
- Sinh viên chỉ hủy được đăng ký của **chính mình** (`registration.user_id = JWT.user_id`).
- Admin và staff không đăng ký workshop — `403 Forbidden`.

### Cửa sổ đăng ký

- Kiểm tra `registration_open_at` và `registration_close_at` bằng **server time tại DB** trong `SELECT FOR UPDATE`.
- Không tin vào timestamp từ client.
- Cache 30 giây của `seats_available` và 300 giây của chi tiết workshop có thể hiển thị sai trạng thái nút — chấp nhận. Kiểm tra thực sự ở server.

### Hiệu năng

- `GET /workshops` (danh sách): < 200ms với cache hit, < 500ms với cache miss.
- `POST /register` (miễn phí): < 500ms tổng cộng.
- `POST /register` (có phí): < 3 giây tổng cộng (bao gồm cả thời gian sandbox gateway).
- DB transaction `FOR UPDATE` phải hoàn thành trong 3 giây — quá ngưỡng ROLLBACK, tránh connection pool cạn kiệt.
- Notification publish **không chặn** response — bất đồng bộ qua RabbitMQ.

---

## Tiêu chí chấp nhận

### Xem workshop

- [ ] `GET /workshops?status=active` trả danh sách workshop đang mở, có `seats_available` đúng (chấp nhận stale 30 giây).
- [ ] Request thứ hai với cùng filter không tăng DB query count — đang đọc từ cache.
- [ ] `GET /workshops/:id` trả đầy đủ thông tin bao gồm `summary` (nếu có AI PDF) và `seats_available`.
- [ ] Workshop `status = 'cancelled'` vẫn trả `200` với `status = 'cancelled'` (không `404`).

### Đăng ký workshop miễn phí

- [ ] Sinh viên hợp lệ đăng ký workshop miễn phí còn chỗ, đúng cửa sổ thời gian → `200 {qr_code}`, `registration.status = 'confirmed'`, không tạo bản ghi `payments`.
- [ ] `seats_available` Redis cache bị xóa sau khi đăng ký thành công.
- [ ] Notification event được publish lên `notification.queue` sau khi commit.

### Đăng ký workshop có phí

- [ ] Thanh toán thành công → `200 {qr_code}`, `registration.status = 'confirmed'`, `payment.status = 'success'`, `transaction_id` được lưu.
- [ ] Thanh toán bị từ chối (`declined`) → `402`, `registration` bị ROLLBACK hoặc chuyển `failed`, slot được hoàn trả.
- [ ] Thanh toán timeout → `202`, `registration.status = 'pending'`, Reconcile Worker xử lý sau.

### Tranh chấp chỗ ngồi

- [ ] 50 concurrent request vào workshop còn 1 chỗ: chính xác **1 request** nhận `200 {qr_code}`, 49 request nhận `409`. Truy vấn DB: `SELECT COUNT(*) FROM registrations WHERE workshop_id = ? AND status = 'confirmed'` = 1.
- [ ] Không có trường hợp hai sinh viên cùng `confirmed` cho một workshop đã hết chỗ.
- [ ] Sau race condition, `seats_available` trong Redis phản ánh đúng số thực tế trong DB (sau tối đa 30 giây).

### Idempotency

- [ ] Gửi cùng request `POST /register` với cùng `Idempotency-Key` hai lần: lần 2 trả lại `qr_code` lần 1, chỉ có **một** bản ghi `registrations`, sandbox chỉ bị charge **một** lần.
- [ ] Sau khi `confirmed`, gửi lại request đăng ký (không có key, hoặc key mới) → Booking Module phát hiện UNIQUE constraint → trả lại `qr_code` đã có, không tạo bản ghi mới.

### Cửa sổ đăng ký

- [ ] Đăng ký trước `registration_open_at` → `409 "Chưa đến giờ mở đăng ký"`.
- [ ] Đăng ký sau `registration_close_at` → `409 "Đã hết hạn đăng ký"`.
- [ ] Đăng ký workshop `status = 'cancelled'` → `409`.

### Hủy đăng ký

- [ ] Sinh viên hủy đăng ký `confirmed` của chính mình, workshop còn > 1 giờ → `200`, `registration.status = 'cancelled'`, `qr_code = NULL`, seat cache bị DEL.
- [ ] Sinh viên hủy trong vòng 1 giờ trước giờ bắt đầu → `409 "Không thể hủy trong vòng 1 giờ trước workshop"`.
- [ ] Sinh viên hủy đăng ký của người khác → `404` (không tìm thấy record thuộc user đó).

### Tải trọng

- [ ] 100 concurrent request `GET /workshops` → tất cả trả < 200ms (cache hit), DB query count không tăng tuyến tính.
- [ ] Rate limit hoạt động: một user gửi 6 request `POST /register` trong 1 phút → request thứ 6 nhận `429` với `Retry-After`.

### Kiểm thử thủ công (smoke test)

**Test 1 — Workshop miễn phí happy path:**
Sinh viên đăng ký workshop miễn phí còn 10 chỗ. Kỳ vọng: `200 {qr_code}` trong < 500ms. DB: `registration.status = 'confirmed'`, `qr_code` không null. RabbitMQ: có message trong `notification.queue`. Redis: `workshop:{id}:seats_available` đã bị xóa.

**Test 2 — Tranh chấp chỗ:**
Dùng k6 / Artillery gửi 30 concurrent request đến workshop còn 3 chỗ. Kỳ vọng: đúng 3 request nhận `200`, 27 request nhận `409`. `SELECT COUNT(*) FROM registrations WHERE workshop_id=? AND status='confirmed'` = 3.

**Test 3 — Idempotency:**
Sinh một UUID làm key. Gửi `POST /register` lần 1 → nhận `200 {qr_code}`. Gửi lại lần 2 với cùng key → nhận `200` với cùng `qr_code`. `SELECT COUNT(*) FROM registrations WHERE user_id=? AND workshop_id=?` = 1. Sandbox log: 1 lần charge.

**Test 4 — Cửa sổ thời gian:**
Sửa `registration_close_at` của workshop về 1 phút trước. Gửi `POST /register` → `409 "Đã hết hạn đăng ký"`. Sửa `registration_open_at` về 1 giờ sau. Gửi lại → `409 "Chưa đến giờ mở đăng ký"`.

**Test 5 — Phân quyền:**
JWT của `admin` gọi `POST /register` → `403`. JWT của `staff` gọi `POST /register` → `403`. JWT của `student` với `is_active = FALSE` gọi → `403`. JWT hợp lệ của `student` active → `200`.
