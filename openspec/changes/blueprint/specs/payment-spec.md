# Đặc tả: Thanh toán Workshop (Payment — Sandbox)

## Mô tả

Tính năng này xử lý toàn bộ luồng thanh toán cho các workshop có phí trong môi trường **sandbox** (giả lập cổng thanh toán). Payment Service được gọi **đồng bộ** từ Registration Service qua internal function call (cùng process, không qua message broker), chờ kết quả rồi mới xác nhận đăng ký cho sinh viên.

Thiết kế phải chịu được bốn thách thức chính:
- **Cổng thanh toán không ổn định:** timeout, lỗi ngẫu nhiên, phản hồi chậm.
- **Idempotency:** sinh viên bấm "Thanh toán" nhiều lần hoặc mạng bị lỗi retry không được trừ tiền hai lần.
- **Tranh chấp chỗ ngồi:** nhiều sinh viên đăng ký cùng lúc vào chỗ cuối cùng.
- **Tải trọng đột biến:** hàng nghìn request đồng thời khi mở đăng ký workshop hot.

Môi trường sandbox cho phép giả lập toàn bộ các kịch bản trên (thành công, timeout, từ chối, lỗi mạng) mà không ảnh hưởng đến tiền thật.

---

## Luồng chính

### Tổng quan các thành phần tham gia

| Thành phần | Vai trò |
|---|---|
| Web/Mobile Client | Sinh key idempotency trước khi gửi request, giữ nguyên key khi retry |
| API Gateway (Nginx) | Xác thực JWT, rate limiting (Token Bucket), routing |
| Registration Service | Kiểm tra slot, tạo bản ghi `pending`, gọi Payment Service trực tiếp |
| Payment Service | Kiểm tra idempotency, gọi sandbox gateway, cập nhật trạng thái |
| Circuit Breaker | Bảo vệ hệ thống khi gateway liên tục thất bại |
| Sandbox Gateway | Giả lập cổng thanh toán (success / timeout / declined / error) |
| Redis | Idempotency cache (24h), Circuit Breaker state, Rate Limit counter, seat counter cache |
| PostgreSQL | Source of truth: slot chỗ ngồi, bản ghi registrations, payments |
| RabbitMQ | Publish event `notification.queue` sau khi đăng ký confirmed |
| Reconcile Worker | Xử lý các payment ở trạng thái `pending` do timeout |

### Luồng happy path — Workshop có phí

```
Client          API Gateway      Reg. Service        PostgreSQL      Payment Svc     Sandbox GW      Redis         Broker
  │                 │                │                   │               │               │              │              │
  │─POST /register─►│                │                   │               │               │              │              │
  │  {workshop_id,  │                │                   │               │               │              │              │
  │   idempotency_  │                │                   │               │               │              │              │
  │   key}          │                │                   │               │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 ├─Verify JWT     │                   │               │               │              │              │
  │                 ├─Rate limit ────┼───────────────────┼───────────────┼───────────────┼──────────────►              │
  │                 │  (per user     │                   │               │               │  Redis check │              │
  │                 │   + /register) │                   │               │               │  token bucket│              │
  │                 │                │                   │               │               │              │              │
  │                 │───────────────►│                   │               │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                │ [BEGIN TRANSACTION]               │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                ├─SELECT capacity   │               │               │              │              │
  │                 │                │  - confirmed_count│               │               │              │              │
  │                 │                │  FOR UPDATE ─────►│               │               │              │              │
  │                 │                │◄─ remaining = N ──│               │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                │  [N <= 0 → ROLLBACK, 409]         │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                ├─INSERT registration               │               │              │              │
  │                 │                │  status='pending' │               │               │              │              │
  │                 │                │  UNIQUE(user,ws)─►│               │               │              │              │
  │                 │                │  [duplicate → ROLLBACK, 409]      │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                │  [COMMIT]         │               │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                ├─── Gọi trực tiếp (đồng bộ) ─────► │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                │                   │               ├─GET idempotent│              │              │
  │                 │                │                   │               │  key ─────────┼─────────────►│              │
  │                 │                │                   │               │◄─ MISS ───────┼──────────────│              │
  │                 │                │                   │               │               │              │              │
  │                 │                │                   │               ├─SET key=      │              │              │
  │                 │                │                   │               │  processing──►┼─────────────►│              │
  │                 │                │                   │               │   (NX, TTL24h)│              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                │                   │               ├─Circuit Breaker CLOSED?      │              │
  │                 │                │                   │               ├─POST /charge─►│              │              │
  │                 │                │                   │               │◄─ 200 success─│              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                │                   │               ├─UPDATE payment│              │              │
  │                 │                │                   │               │  status=success              │              │
  │                 │                │                   │               │  transaction_id ─────────────►              │
  │                 │                │                   │               ├─SET key=      │              │              │
  │                 │                │                   │               │  success─────►┼─────────────►│              │
  │                 │                │                   │               │               │              │              │
  │                 │                │◄──── SUCCESS ─────│───────────────│               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                ├─UPDATE registration               │               │              │              │
  │                 │                │  status='confirmed'               │               │              │              │
  │                 │                ├─Generate QR code──►               │               │              │              │
  │                 │                │                   │               │               │              │              │
  │                 │                ├─PUBLISH ──────────┼───────────────┼───────────────┼──────────────┼─────────────►│
  │                 │                │  notification.    │               │               │              │              │
  │                 │                │  queue            │               │               │              │              │
  │                 │                │                   │               │               │              │              │
  │◄─ 200 {qr_code}─│◄───────────────│                   │               │               │              │              │
```

### Sandbox Gateway — hành vi được giả lập

Sandbox gateway mô phỏng bốn kịch bản dựa trên số cuối của `amount` hoặc một header đặc biệt `X-Sandbox-Scenario`:

| Kịch bản | Trigger | Phản hồi |
|---|---|---|
| `success` | Mặc định hoặc `amount` không thuộc nhóm dưới | HTTP 200, `{status: "success", transaction_id: "..."}` |
| `timeout` | `amount` kết thúc bằng `.99` hoặc scenario=`timeout` | Không phản hồi trong 15 giây (Payment Svc timeout sau 10s) |
| `declined` | `amount` kết thúc bằng `.00` hoặc scenario=`declined` | HTTP 402, `{status: "declined", reason: "insufficient_funds"}` |
| `gateway_error` | scenario=`error` | HTTP 500, `{status: "error"}` — đếm vào Circuit Breaker |

---

## Kịch bản lỗi

### 1. Tranh chấp chỗ ngồi (Race Condition)

```
Thời điểm T=0: Workshop chỉ còn 1 chỗ

Sinh viên A                        Sinh viên B
     │                                   │
     ├─POST /register ──────────────────►│ (đồng thời)
     │                                   │
     │    [Reg. Service A: BEGIN TX]     │    [Reg. Service B: BEGIN TX]
     │    SELECT ... FOR UPDATE          │    SELECT ... FOR UPDATE
     │    ◄── remaining = 1              │    [CHỜ vì row đã bị A lock]
     │    INSERT registration (pending)  │
     │    COMMIT                         │
     │    [Lock giải phóng]              │
     │                                   │    ◄── remaining = 0 (sau khi A commit)
     │                                   │    ROLLBACK
     │                                   │    ◄── 409 Hết chỗ
     │
     ├─ Tiếp tục gọi Payment Svc ───────►
     ├─ ... (luồng happy path)
     ◄── 200 {qr_code}
```

`SELECT ... FOR UPDATE` (row-level lock trong PostgreSQL) đảm bảo chỉ một transaction được đếm slot tại một thời điểm. Redis seat counter chỉ dùng để **hiển thị** số chỗ còn lại nhanh cho UI, không tham gia vào quyết định cấp slot.

### 2. Idempotency — Sinh viên bấm "Thanh toán" nhiều lần

```
Client giữ nguyên idempotency_key = "abc-123" trong toàn bộ session

Lần 1 (t=0s):
  Client ──► Server: POST /register {key: "abc-123"}
  Server: Redis MISS → SET key=processing (NX)
  Server: Gọi sandbox gateway → thành công
  Server: SET key=success, response={qr_code, ...} TTL=24h
  [Network lỗi - client không nhận được response]

Lần 2 - Retry (t=5s):
  Client ──► Server: POST /register {key: "abc-123"}
  Server: Redis HIT → status=success
  Server: Trả lại response đã lưu ✅ (không gọi gateway lần 2)

Lần 3 - Reload trang (t=60s):
  Client ──► Server: POST /register {key: "abc-123"}
  Server: Redis HIT → status=success
  Server: Trả lại response đã lưu ✅
```

**Quy tắc sinh key phía client (React / Next.js):**
```javascript
// Sinh 1 lần duy nhất khi component mount
const [idempotencyKey] = useState(() => crypto.randomUUID());

// KHÔNG sinh key mới khi retry — dùng lại key cũ
async function handlePayment() {
  await fetch('/api/register', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ workshop_id })
  });
}
```

**Xử lý trường hợp key=processing (hai request song song):**
Nếu cùng một key đến khi đang xử lý (status=`processing`), trả `202 Accepted` và yêu cầu client poll lại sau 3 giây. Không chạy song song hai luồng thanh toán.

### 3. Cổng thanh toán timeout

```
Reg. Service gọi Payment Svc
    │
    ├─ Payment Svc gọi Sandbox GW (timeout scenario)
    │   requestTimeout = 10 giây
    │
    │   [Sau 10 giây không có phản hồi]
    │
    ├─ Payment Svc:
    │   • KHÔNG kết luận FAILED (gateway có thể đã charge)
    │   • UPDATE payments SET status='pending'
    │   • SET idempotency key = {status: 'pending'} TTL=24h
    │   • Trả về trạng thái PENDING cho Reg. Service
    │
    ├─ Reg. Service:
    │   • GIỮ registration.status = 'pending' (không rollback)
    │   • Trả 202 cho client: "Đăng ký ghi nhận, thanh toán đang xử lý"
    │
    │   [Reconcile Worker chạy mỗi 5 phút]
    │   • SELECT payments WHERE status='pending' AND attempted_at < NOW() - 10min
    │   • Gọi GET /sandbox/transactions/{transaction_id} để hỏi kết quả
    │   • Nếu success → UPDATE payment=success, registration=confirmed, gen QR, notify
    │   • Nếu failed  → UPDATE payment=failed, registration=failed, hoàn trả slot
    │   • Nếu không tìm thấy → giữ pending, retry lần tiếp
```

### 4. Circuit Breaker — Cổng thanh toán liên tục lỗi

```
Trạng thái lưu trong Redis:
Key: circuit:payment_gateway
Value: {state, failure_count, last_failure_at, opened_at, success_count_half_open}
TTL: 600s

Cấu hình:
  failureThreshold  = 5    (5 lỗi liên tiếp trong 30s → OPEN)
  successThreshold  = 2    (2 success ở HALF-OPEN → CLOSED)
  openTimeout       = 60s  (thời gian chờ trước khi thử HALF-OPEN)
  requestTimeout    = 10s  (timeout mỗi request tới gateway)

CLOSED (bình thường):
  • Forward request tới gateway
  • Đếm lỗi liên tiếp (gateway_error, timeout)
  • Reset counter khi có 1 success
  • Đạt 5 lỗi trong 30s → chuyển OPEN

OPEN (ngắt mạch):
  • Từ chối tất cả request ngay lập tức (fast-fail)
  • Không gọi gateway
  • Payment Svc trả FAILED cho Reg. Service
  • Reg. Service: ROLLBACK bản ghi pending, hoàn trả slot
  • Trả 503 cho client: "Thanh toán tạm thời không khả dụng"
  • Sau 60s → chuyển HALF-OPEN

HALF-OPEN (thăm dò):
  • Cho qua 1 request thử nghiệm
  • Thành công → CLOSED (reset counter)
  • Thất bại   → OPEN lại (reset 60s timer)

Graceful Degradation:
  Workshop MIỄN PHÍ → bypass Payment Svc hoàn toàn → vẫn hoạt động bình thường
  Workshop CÓ PHÍ   → bị từ chối khi CB OPEN, thông báo rõ ràng cho sinh viên
```

### 5. Tải trọng đột biến khi mở đăng ký

```
Thời điểm mở đăng ký workshop hot (12.000 sinh viên online):

Tầng 1 — API Gateway (Nginx) — Rate Limiting Token Bucket:
  Per User + /register: 5 req/phút
  Per IP:               120 req/phút
  Global:               60.000 req/phút
  → Request vượt ngưỡng → 429, header Retry-After: {N}s

Tầng 2 — DB Row Lock (SELECT ... FOR UPDATE):
  → Serialize các request cạnh tranh cùng workshop
  → Lock timeout: 3 giây (tránh queue dài)
  → Quá 3s không acquire lock → 409 "Hệ thống đang bận, vui lòng thử lại"

Tầng 3 — UNIQUE constraint DB:
  → Chặn duplicate (user + workshop) tại tầng DB
  → Lớp cuối cùng nếu application logic bị bypass

Redis seat counter (chỉ để hiển thị):
  → Workshop list page đọc từ Redis (cache 30s) thay vì hit DB
  → Giảm tải đọc khi 12.000 sinh viên xem danh sách đồng thời
```

### Bảng tổng hợp kịch bản lỗi

| Kịch bản | Hành động Payment Svc | Hành động Reg. Service | Response Client |
|---|---|---|---|
| Gateway thành công | `payment.status = success`, SET Redis key=success | `registration.status = confirmed`, gen QR, publish notify | `200 {qr_code}` |
| Gateway từ chối (declined) | `payment.status = failed`, SET Redis key=failed | ROLLBACK `registration` pending, hoàn trả slot | `402 "Thanh toán bị từ chối"` |
| Gateway timeout (>10s) | `payment.status = pending`, SET Redis key=pending | Giữ `registration.status = pending` | `202 "Đang xử lý, vui lòng chờ"` |
| Gateway lỗi 5xx | Đếm vào Circuit Breaker. Nếu CB OPEN: fast-fail | ROLLBACK pending, hoàn trả slot | `503 "Thanh toán tạm thời gián đoạn"` |
| Idempotency hit (success) | Trả response đã cache, không gọi gateway | Không tạo bản ghi mới | `200 {qr_code}` (cached) |
| Idempotency hit (processing) | Không gọi gateway | Không tạo bản ghi mới | `202 "Đang xử lý"` |
| Idempotency hit (failed) | Trả lỗi đã cache | Không retry | `402` (cached) — client cần sinh key mới |
| Hết chỗ | — (không đến Payment Svc) | ROLLBACK, slot không bị giữ | `409 "Workshop đã hết chỗ"` |
| Đăng ký trùng | — (không đến Payment Svc) | ROLLBACK (unique constraint) | `409 "Bạn đã đăng ký workshop này"` |
| Rate limit vượt ngưỡng | — (không đến backend) | — | `429 Retry-After: {N}s` |
| Lock timeout DB | — (không đến Payment Svc) | ROLLBACK sau 3s chờ | `409 "Hệ thống bận, thử lại sau"` |
| Reconcile: timeout → success | Cập nhật `success`, lưu transaction_id | Cập nhật `confirmed`, gen QR | Notification push/email sau |
| Reconcile: timeout → failed | Cập nhật `failed` | Cập nhật `failed`, hoàn trả slot | Notification thất bại |

---

## Ràng buộc

### Thứ tự xử lý (bất biến về kiến trúc)

1. **Slot phải được kiểm tra và giữ trước khi gọi Payment.** Không gọi gateway khi chưa biết còn chỗ.
2. **Registration chỉ chuyển `confirmed` khi Payment trả `success`.** Không xác nhận trước, thanh toán sau.
3. **Payment thất bại → Registration không ở trạng thái `pending` mãi mãi.** Phải rollback hoặc Reconcile Worker xử lý trong vòng 15 phút.
4. **QR code chỉ được sinh khi `registration.status = confirmed`.** Không sinh QR cho `pending`.

### Idempotency

- Idempotency key do **client sinh**, không do server sinh. Server không thể biết user sẽ retry khi nào.
- Format key: `idempotency:{user_id}:{workshop_id}:{uuid}` — ngăn hai user dùng cùng UUID trùng nhau.
- TTL: 24 giờ. Sau 24h, key coi như mới hoàn toàn.
- `SET NX` (atomic) để tránh race condition khi hai request cùng key đến đồng thời.
- Key ở trạng thái `failed`: client **phải sinh key mới** để thử lại — không dùng key cũ (vì giao dịch đã kết luận thất bại).

### Circuit Breaker

- Trạng thái Circuit Breaker lưu trong Redis, chia sẻ giữa tất cả instance Backend (không per-instance).
- Chỉ đếm lỗi do **gateway** (HTTP 5xx, timeout). Lỗi do client (declined, 4xx) không đếm vào threshold.
- Workshop miễn phí **không đi qua** Payment Svc và không bị ảnh hưởng khi CB OPEN.

### Hiệu năng

- `requestTimeout` tới sandbox gateway: **10 giây** (production có thể điều chỉnh).
- DB transaction cho slot check phải hoàn thành trong **3 giây** (bao gồm lock wait). Quá ngưỡng → rollback, trả lỗi.
- Redis idempotency read phải là thao tác **đầu tiên** trong Payment Svc — trước khi mở bất kỳ DB connection nào.
- Seat counter cache trên Redis được refresh mỗi **30 giây** từ DB. Chấp nhận stale data 30s cho UI, không chấp nhận cho logic đăng ký.

### Sandbox

- Sandbox không gọi ra internet. Toàn bộ chạy trong môi trường local/staging.
- Sandbox phải hỗ trợ giả lập **độ trễ có thể cấu hình** (0ms → 15s) để test timeout.
- Mọi giao dịch sandbox được log đầy đủ vào `payments.gateway_response` (JSONB) để debug.
- **Không dùng endpoint sandbox trong production.** URL gateway phải được inject qua biến môi trường `PAYMENT_GATEWAY_URL`.

### Bảo mật

- Idempotency key **không được** chứa thông tin nhạy cảm (không embed số thẻ, không embed số tiền).
- `gateway_response` (JSONB) không được log ra stdout ở mức INFO — chỉ DEBUG — vì có thể chứa dữ liệu nhạy cảm từ gateway.
- Payment amount được **tính lại phía server** từ `workshops.price`, không tin giá trị client gửi lên.
- Chỉ `role = 'student'` mới được gọi `POST /register`. Admin và staff không đăng ký workshop.

---

## Tiêu chí chấp nhận

### Happy path

- [ ] Sinh viên đăng ký workshop có phí, thanh toán thành công → nhận `qr_code` trong response, `registration.status = confirmed`, `payment.status = success`.
- [ ] Workshop miễn phí bỏ qua hoàn toàn Payment Service, vẫn nhận `qr_code` ngay.
- [ ] Notification (email + push) được gửi sau khi confirmed (qua RabbitMQ, không chặn response).

### Idempotency

- [ ] Gửi cùng request với cùng `Idempotency-Key` hai lần: lần 2 trả đúng kết quả lần 1, `payments` chỉ có **một** bản ghi, sandbox gateway chỉ nhận **một** lần charge.
- [ ] Key ở trạng thái `processing` → response `202`, không chạy thêm luồng thanh toán mới.
- [ ] Key ở trạng thái `failed` → response trả lỗi ngay, không gọi gateway. Client phải đổi key mới để thử lại.
- [ ] Sau 24h key hết TTL, gửi lại request với key cũ được coi là giao dịch mới.

### Tranh chấp chỗ ngồi

- [ ] Hai sinh viên đăng ký workshop còn 1 chỗ cùng lúc: chính xác **một** người nhận `200 {qr_code}`, người còn lại nhận `409 "Workshop đã hết chỗ"`. Không có trường hợp cả hai đều confirmed.
- [ ] `registrations` không có hai bản ghi `confirmed` cho cùng một `(user_id, workshop_id)`.
- [ ] Sau race condition, số chỗ trong DB khớp với số bản ghi `confirmed` trong `registrations`.

### Circuit Breaker

- [ ] Sau 5 lỗi liên tiếp từ gateway trong 30 giây, CB chuyển OPEN. Request tiếp theo nhận `503` ngay (không gọi gateway, < 50ms).
- [ ] Sau 60 giây, CB chuyển HALF-OPEN. 1 request thử nghiệm được gửi tới gateway.
- [ ] Thử nghiệm thành công → CB CLOSED, hoạt động bình thường trở lại.
- [ ] Thử nghiệm thất bại → CB OPEN lại, đếm lại 60 giây.
- [ ] Workshop miễn phí vẫn đăng ký được khi CB OPEN.
- [ ] Trạng thái CB được chia sẻ đúng giữa các instance (kiểm tra bằng cách restart một instance và gửi request qua instance kia).

### Timeout và Reconcile

- [ ] Gateway timeout (scenario `.99`): Payment Svc không kết luận `failed`, registration giữ `pending`, client nhận `202`.
- [ ] Reconcile Worker chạy sau 5 phút, hỏi lại gateway, cập nhật đúng trạng thái (success hoặc failed).
- [ ] Nếu Reconcile xác định `success`: registration chuyển `confirmed`, QR được gen, notification được gửi.
- [ ] Nếu Reconcile xác định `failed`: registration chuyển `failed`, slot được hoàn trả.
- [ ] Không có payment nào ở `pending` quá **15 phút** mà không được Reconcile xử lý.

### Tải trọng đột biến

- [ ] 100 request đồng thời tới cùng workshop còn 10 chỗ: chính xác 10 người confirmed, 90 người nhận `409`. Không có oversell.
- [ ] Rate limit hoạt động: một user gửi 6 request `/register` trong 1 phút → request thứ 6 nhận `429` với header `Retry-After`.
- [ ] Dưới tải cao, API workshop list vẫn phản hồi < 200ms (đọc từ Redis cache, không hit DB).

### Sandbox-specific

- [ ] Scenario `success`: nhận `200`, `payment.status = success`, `transaction_id` được ghi vào DB.
- [ ] Scenario `declined`: nhận `402`, `payment.status = failed`, slot được hoàn trả.
- [ ] Scenario `timeout`: nhận `202`, `payment.status = pending`, Reconcile Worker xử lý sau.
- [ ] Scenario `gateway_error`: nhận `503` (nếu CB OPEN) hoặc `502` (nếu CB CLOSED và đây là lỗi đầu tiên), failure counter tăng.
- [ ] Biến môi trường `PAYMENT_GATEWAY_URL` trỏ đúng sandbox. Thay URL là đủ để chuyển sang production (không cần sửa code).

### Kiểm thử thủ công (smoke test)

**Test 1 — Idempotency:**
Sinh một UUID làm idempotency key. Gửi 3 request `POST /register` liên tiếp với cùng key và `amount` dạng success. Kỳ vọng: 3 response đều trả `200` với cùng `qr_code`. DB chỉ có 1 bản ghi `payments`. Sandbox log chỉ có 1 lần charge.

**Test 2 — Race condition:**
Dùng tool (Artillery / k6) gửi 50 concurrent request đến workshop chỉ còn 1 chỗ. Kỳ vọng: đúng 1 request nhận `200`, 49 request nhận `409`. Query DB: `SELECT COUNT(*) FROM registrations WHERE workshop_id = ? AND status = 'confirmed'` = 1.

**Test 3 — Circuit Breaker:**
Gửi 5 request với `amount` dạng `gateway_error` liên tiếp. Request thứ 6 gửi ngay → kỳ vọng `503` trong < 50ms (không chờ gateway). Đợi 60s → gửi tiếp với `amount` dạng `success` → kỳ vọng `200` (CB đã CLOSED).

**Test 4 — Timeout + Reconcile:**
Gửi request với `amount` dạng timeout. Kỳ vọng nhận `202`. Kiểm tra DB: `payment.status = pending`. Đợi 5 phút (hoặc trigger Reconcile Worker thủ công). Kiểm tra DB: `payment.status = success`, `registration.status = confirmed`, `qr_code` đã được tạo.
