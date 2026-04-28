## 7. Cơ chế Bảo vệ Hệ thống (Bổ sung Sâu)
<!-- 
> Tài liệu gốc đề cập tên kỹ thuật nhưng chưa giải thích cơ chế hoạt động chi tiết. Phần này hoàn thiện phân tích.

--- -->

### 7.1 Kiểm soát Tải Đột biến — Token Bucket Rate Limiting

#### 7.1.1 Tại sao chọn Token Bucket thay vì các thuật toán khác?

| Thuật toán | Ưu điểm | Nhược điểm | Phù hợp với UniHub? |
|---|---|---|---|
| Fixed Window | Đơn giản, ít bộ nhớ | Spike ở ranh giới window (2× lưu lượng) | ❌ Dễ bị bypass |
| Sliding Window | Không có spike ranh giới | Cần lưu timestamp từng request, tốn RAM | ⚠️ Tốt nhưng nặng |
| **Token Bucket** | **Cho phép burst ngắn, tốc độ trung bình ổn định** | Phức tạp hơn Fixed Window | **✅ Phù hợp nhất** |
| Leaky Bucket | Rate đầu ra hoàn toàn ổn định | Không ưu tiên được request đầu tiên của user | ❌ Không công bằng lắm |

Token Bucket phù hợp với sinh viên đăng ký vì: sinh viên thực sự sẽ load trang 1-2 lần (burst nhỏ được chấp nhận), nhưng bot/script sẽ bị chặn vì tiêu hết token.

#### 7.1.2 Cơ chế hoạt động chi tiết

```
Mỗi user/IP có một "xô" (bucket) chứa token:

Cấu hình:
  max_tokens    = 20       (dung lượng xô)
  refill_rate   = 5        (token/giây được nạp lại)
  cost_per_req  = 1        (mỗi request tiêu 1 token)

Trạng thái lưu trong Redis:
  Key: ratelimit:user:{userId}:tokens
  Value: {tokens: 15.5, last_refill_ts: 1700000000.000}
  TTL: 60s

Khi request đến:
  now = current_timestamp
  elapsed = now - last_refill_ts
  new_tokens = min(tokens + elapsed × refill_rate, max_tokens)
                                ↑ đây là lý do Token Bucket "mượt"

  if new_tokens >= 1:
    new_tokens -= 1
    SAVE {tokens: new_tokens, last_refill_ts: now}
    → Cho request đi qua

  else:
    wait_time = (1 - new_tokens) / refill_rate
    → 429 Too Many Requests
    → Header: Retry-After: {wait_time}s
```

#### 7.1.3 Triển khai với Redis (Lua script — atomic)

```lua
-- Script chạy atomic trên Redis để tránh race condition
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])  -- 20
local refill_rate = tonumber(ARGV[2]) -- 5 token/s
local now = tonumber(ARGV[3])         -- unix timestamp ms

local data = redis.call('GET', key)
local tokens, last_ts

if data then
  local parsed = cjson.decode(data)
  tokens = parsed.tokens
  last_ts = parsed.last_ts
  local elapsed = (now - last_ts) / 1000  -- ms to seconds
  tokens = math.min(max_tokens, tokens + elapsed * refill_rate)
else
  tokens = max_tokens  -- user mới: xô đầy
  last_ts = now
end

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('SET', key, cjson.encode({tokens=tokens, last_ts=now}), 'EX', 60)
  return {1, tokens}  -- 1 = allowed
else
  local wait = (1 - tokens) / refill_rate
  return {0, wait}    -- 0 = blocked, wait = giây chờ
end
```

#### 7.1.4 Phân tầng Rate Limit

| Tầng | Key | Ngưỡng | Mục đích |
|---|---|---|---|
| Global | `ratelimit:global` | 60.000 req/phút | Bảo vệ toàn hệ thống |
| Per IP | `ratelimit:ip:{ip}` | 120 req/phút | Chống bot từ 1 IP |
| Per User | `ratelimit:user:{id}` | 60 req/phút | Chống script từ 1 tài khoản |
| Per User + Endpoint | `ratelimit:register:{id}` | 5 req/phút | Chỉ áp dụng `/register` |
| Per Workshop | Unique constraint DB | 1 lần/workshop/user | Tầng nghiệp vụ — chặn hoàn toàn |

---

### 7.2 Xử lý Cổng Thanh Toán Không Ổn định — Circuit Breaker

#### 7.2.1 Ba trạng thái và điều kiện chuyển

```
                         5 lỗi liên tiếp trong 30s
              ┌──────────────────────────────────────────┐
              │                                          │
              ▼                                          │
   ┌────────────────────┐                     ┌──────────────────────┐
   │       CLOSED       │                     │         OPEN         │
   │  (Bình thường)     │                     │    (Ngắt mạch)       │
   │                    │                     │                      │
   │ • Forward request  │                     │ • Từ chối mọi req    │
   │   tới gateway      │                     │   ngay (fast-fail)   │
   │ • Đếm lỗi liên tiếp│                     │ • Không gọi gateway  │
   │ • Reset count khi  │                     │ • Thời gian chờ: 60s │
   │   có 1 success     │                     │                      │
   └────────────────────┘                     └──────────────────────┘
              ▲                                          │
              │   Test request thành công               │  Sau 60s timeout
              │                                          ▼
              │                              ┌──────────────────────┐
              └──────────────────────────────│      HALF-OPEN       │
                  Test request thất bại  ──► │  (Thăm dò)          │
                  → Quay lại OPEN            │                      │
                                             │ • Cho phép 1 req     │
                                             │   thử nghiệm         │
                                             │ • Nếu thành công     │
                                             │   → về CLOSED        │
                                             │ • Nếu thất bại       │
                                             │   → về OPEN          │
                                             └──────────────────────┘
```

#### 7.2.2 Cấu hình ngưỡng

```javascript
const circuitBreakerConfig = {
  failureThreshold: 5,       // 5 lỗi liên tiếp → OPEN
  successThreshold: 2,       // 2 success liên tiếp ở HALF-OPEN → CLOSED
  timeout: 60_000,           // 60 giây ở trạng thái OPEN trước khi thử HALF-OPEN
  requestTimeout: 10_000,    // 10 giây timeout mỗi request tới gateway
  monitoringWindow: 30_000,  // Đếm lỗi trong cửa sổ 30 giây
};
```

#### 7.2.3 Trạng thái lưu trong Redis

```
Key: circuit:payment_gateway
Value: {
  "state": "open",
  "failure_count": 7,
  "last_failure_at": 1700000050000,
  "opened_at": 1700000050000,
  "success_count_half_open": 0
}
TTL: 600s (tự xóa nếu không hoạt động)
```

#### 7.2.4 Graceful Degradation theo loại tính năng

```
Circuit Breaker → OPEN
        │
        ├─── Request đăng ký workshop CÓ PHÍ
        │         → Fast-fail ngay (không chờ 10s timeout)
        │         → Rollback: INCR slot Redis, xóa pending registration
        │         → Response: 503 "Thanh toán tạm thời gián đoạn.
        │                         Vui lòng thử lại sau ít phút."
        │         → Log sự kiện để alert
        │
        ├─── Request đăng ký workshop MIỄN PHÍ
        │         → Không qua Payment Service
        │         → Tiếp tục bình thường ✅
        │
        ├─── Request xem danh sách workshop
        │         → Không liên quan Payment Service
        │         → Tiếp tục bình thường ✅
        │
        └─── Request check-in
                  → Không liên quan Payment Service
                  → Tiếp tục bình thường ✅
```

**Nguyên tắc cốt lõi:** Chỉ những tính năng **thực sự phụ thuộc** cổng thanh toán mới bị ảnh hưởng. Phần còn lại của hệ thống hoạt động bình thường — đây là mục tiêu của Graceful Degradation.

---

### 7.3 Chống Trừ Tiền Hai Lần — Idempotency Key

#### 7.3.1 Tại sao cần Idempotency Key?

```
Tình huống xảy ra không có Idempotency Key:

Sinh viên bấm "Thanh toán"
    │
    ├─ Request 1 ──► Server ──► Cổng thanh toán ──► Charge 50.000đ ✅
    │                │
    │            Network timeout ← sinh viên thấy lỗi
    │
    ├─ Sinh viên bấm lại (retry)
    │
    └─ Request 2 ──► Server ──► Cổng thanh toán ──► Charge 50.000đ ✅ (lần 2!)
                                                                      ❌ Bị trừ 2 lần!
```

#### 7.3.2 Cách sinh Idempotency Key

```javascript
// Phía CLIENT (React / Flutter) — sinh key TRƯỚC khi gửi request
// Key được sinh 1 lần duy nhất khi user bấm "Thanh toán"
// Và được LƯU trong state để dùng lại khi retry

const [idempotencyKey] = useState(() => crypto.randomUUID());
// Ví dụ: "f47ac10b-58cc-4372-a567-0e02b2c3d479"

// Không sinh key mới khi retry!
// Nếu sinh key mới → server coi là giao dịch mới → charge lần 2

async function handlePayment(isRetry = false) {
  // Dùng cùng một key dù là lần đầu hay retry
  await fetch('/api/payment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Idempotency-Key': idempotencyKey,  // ← cùng key mọi lần
    },
    body: JSON.stringify({ workshop_id, amount })
  });
}
```

#### 7.3.3 Luồng xử lý phía Server

```
POST /payment với header Idempotency-Key: {key}
           │
           ▼
Payment Service:
  ┌─────────────────────────────────────────┐
  │  GET idempotency:{key} từ Redis         │
  └─────────────────────────────────────────┘
           │
           ├─── KEY TỒN TẠI với status="processing"
           │         → Đang có request khác xử lý cùng key
           │         → Trả 202: "Giao dịch đang được xử lý"
           │         → Client poll lại sau 3 giây
           │
           ├─── KEY TỒN TẠI với status="success"
           │         → Trả response lưu sẵn (payment_id, status)
           │         → Không gọi gateway ✅
           │
           ├─── KEY TỒN TẠI với status="failed"
           │         → Trả lỗi lưu sẵn
           │         → Client cần sinh KEY MỚI nếu muốn thử lại
           │           (vì giao dịch này đã thực sự thất bại)
           │
           └─── KEY KHÔNG TỒN TẠI (request hoàn toàn mới)
                     │
                     ├─ SET idempotency:{key} = {status:"processing"} TTL=24h
                     │  (atomic SET NX để tránh 2 request song song với cùng key)
                     │
                     ├─ Gọi cổng thanh toán
                     │
                     ├─── Thành công:
                     │       INSERT payments (DB)
                     │       SET idempotency:{key} = {
                     │         status: "success",
                     │         payment_id: "uuid",
                     │         amount: 50000,
                     │         completed_at: "..."
                     │       } TTL=24h
                     │
                     └─── Thất bại:
                             SET idempotency:{key} = {
                               status: "failed",
                               error: "Gateway timeout"
                             } TTL=24h
```

#### 7.3.4 Quy tắc quản lý Key

| Thuộc tính | Giá trị | Lý do |
|---|---|---|
| Nơi lưu | Redis (không phải DB) | Cần đọc cực nhanh (sub-millisecond), TTL tự động |
| TTL | 24 giờ | Đủ dài để cover mọi retry trong ngày, tự dọn sau |
| Format key | `idempotency:{user_id}:{workshop_id}:{uuid}` | Thêm user_id để tránh 2 user dùng cùng uuid (dù cực kỳ hiếm) |
| Ai sinh key | Client | Server không thể biết user sẽ retry lúc nào |
| Retry policy | Dùng lại key cũ nếu status=processing/pending; sinh key mới nếu status=failed | failed = đã kết luận thất bại, cần giao dịch mới |
| Race condition | `SET NX` (atomic) | Nếu 2 request với cùng key đến đồng thời, chỉ 1 cái SET được |

#### 7.3.5 Ví dụ sequence đầy đủ với retry

```
t=0s   Client gửi request với key="abc-123"
t=0s   Server: Redis MISS → SET status=processing → gọi gateway
t=8s   Network timeout → Client nhận lỗi
t=8s   [Server: gateway trả về success sau 8s, UPDATE Redis key=success]

t=9s   Client retry với cùng key="abc-123"
t=9s   Server: Redis HIT, status=success
t=9s   Trả response thành công ✅ — không gọi gateway lần 2

t=10s  Sinh viên reload trang
t=10s  Client thử lại với key="abc-123"
t=10s  Server: Redis HIT, status=success → trả kết quả ngay ✅
```

---