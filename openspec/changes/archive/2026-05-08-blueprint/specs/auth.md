# Đặc tả: Authentication & Authorization (Auth Module)

## Mô tả

Module xử lý toàn bộ vòng đời xác thực (login, refresh token, logout) và
kiểm soát truy cập theo vai trò (RBAC) cho toàn hệ thống UniHub Workshop.

Hệ thống có **3 role cố định**, không hỗ trợ gán quyền động:

| Role      | Lưu trong DB              | Mô tả                                                      |
|-----------|---------------------------|------------------------------------------------------------|
| `student` | `users.role = 'student'`  | Sinh viên. Chỉ thao tác trên dữ liệu của chính mình.      |
| `admin`   | `users.role = 'admin'`    | Ban tổ chức. Toàn quyền quản lý workshop và thống kê.     |
| `staff`   | `users.role = 'staff'`    | Nhân sự check-in. Chỉ truy cập chức năng quét QR.         |

Sinh viên **không tự đăng ký tài khoản**. Tài khoản sinh viên được tạo
tự động từ luồng CSV import đêm. Tài khoản `admin` và `staff` được seed
trực tiếp qua migration script.

JWT dùng thuật toán **RS256** (bất đối xứng). Auth Service giữ private key.
API Gateway và Backend đều tự verify bằng public key — không service nào ngoài Auth Service có thể cấp token hợp lệ.

---

## Luồng chính

### Luồng 1 — Đăng nhập

**Actors**: Client (Web App / Mobile App), API Gateway, Auth Module, PostgreSQL, Redis

**Precondition**: Tài khoản đã tồn tại trong bảng `users`, `is_active = true`.

```
Client                API Gateway           Auth Module           PostgreSQL        Redis
  │                       │                     │                     │               │
  │ POST /api/auth/login  │                     │                     │               │
  │ { email, password }   │                     │                     │               │
  ├──────────────────────►│                     │                     │               │
  │                       │ [Rate limit check]  │                     │               │
  │                       │ ratelimit:ip:{ip}   │                     │               │
  │                       │ Token Bucket Lua    │                     │               │
  │                       │ (5 req/min/IP)      │                     │               │
  │                       ├────────────────────►│                     │               │
  │                       │                     │                     │               │
  │                       │                     │ SELECT id,          │               │
  │                       │                     │ password_hash,      │               │
  │                       │                     │ role, is_active     │               │
  │                       │                     │ FROM users          │               │
  │                       │                     │ WHERE email = $1    │               │
  │                       │                     ├────────────────────►│               │
  │                       │                     │◄────────────────────┤               │
  │                       │                     │                     │               │
  │                       │                     │ bcrypt.compare()    │               │
  │                       │                     │ (password, hash)    │               │
  │                       │                     │                     │               │
  │                       │                     │ [Nếu hợp lệ]        │               │
  │                       │                     │                     │               │
  │                       │                     │ Sign accessToken    │               │
  │                       │                     │ RS256, private key  │               │
  │                       │                     │ TTL: 15 phút        │               │
  │                       │                     │ (staff: 8 giờ)      │               │
  │                       │                     │                     │               │
  │                       │                     │ Generate            │               │
  │                       │                     │ refreshToken        │               │
  │                       │                     │ (opaque, 32 bytes   │               │
  │                       │                     │  hex random)        │               │
  │                       │                     │                     │               │
  │                       │                     │ SET                 │               │
  │                       │                     │ refresh:{token}     │               │
  │                       │                     │ = {userId, role}    │               │
  │                       │                     │ EX 604800 (7 ngày)  ├──────────────►│
  │                       │◄────────────────────┤                     │               │
  │◄──────────────────────┤                     │                     │               │
  │ 200 OK                │                     │                     │               │
  │ {                     │                     │                     │               │
  │   accessToken,        │                     │                     │               │
  │   refreshToken,       │                     │                     │               │
  │   user: {             │                     │                     │               │
  │     id, role,         │                     │                     │               │
  │     fullName, email   │                     │                     │               │
  │   }                   │                     │                     │               │
  │ }                     │                     │                     │               │
```

**JWT Access Token payload:**
```json
{
  "sub":   "550e8400-e29b-41d4-a716-446655440000",
  "role":  "staff",
  "email": "nhansu01@university.edu.vn",
  "iat":   1700000000,
  "exp":   1700028800,
  "jti":   "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

> `jti` (JWT ID) là UUID v4 dùng để blacklist refresh token khi logout.
> Không nhúng thông tin nhạy cảm như `password_hash`, `student_id`.

**TTL theo role:**
| Role      | Access Token TTL | Lý do                                           |
|-----------|------------------|-------------------------------------------------|
| `student` | 15 phút          | Ngắn — giảm thiệt hại nếu bị lộ                |
| `admin`   | 15 phút          | Như student                                     |
| `staff`   | 8 giờ            | Hết hạn cuối ca làm, không dùng được ngày sau  |

---

### Luồng 2 — Làm mới Access Token

**Precondition**: Client giữ `refreshToken` hợp lệ còn trong Redis.

```
Client                  Auth Module                    Redis
  │                          │                            │
  │ POST /api/auth/refresh   │                            │
  │ { refreshToken }         │                            │
  ├─────────────────────────►│                            │
  │                          │ GET refresh:{token}        │
  │                          ├───────────────────────────►│
  │                          │◄───────────────────────────┤
  │                          │                            │
  │                          │ [Nếu key tồn tại]          │
  │                          │ Sign accessToken mới       │
  │                          │ (cùng RS256, TTL theo role)│
  │                          │                            │
  │                          │ [Không rotate refreshToken │
  │                          │  trong phiên bản này —     │
  │                          │  giữ nguyên để đơn giản]   │
  │◄─────────────────────────┤                            │
  │ 200 OK { accessToken }   │                            │
```

---

### Luồng 3 — Đăng xuất

```
POST /api/auth/logout
Header: Authorization: Bearer <accessToken>
Body:   { refreshToken }

Auth Module:
  [1] Middleware xác thực accessToken (verify RS256 signature + exp)
  [2] Pipeline Redis (atomic):
        DEL  refresh:{refreshToken}
        SET  jwt:blacklist:{jti}  = "1"
             EX <thời gian còn lại của accessToken tính bằng giây>
  [3] Trả về 204 No Content
```

> **Tại sao blacklist accessToken?**
> AccessToken TTL 15 phút. Nếu không blacklist, token cũ vẫn hợp lệ
> sau khi logout cho đến khi hết hạn tự nhiên. Dùng TTL bằng thời gian còn lại của token — Redis tự dọn, không cần cronjob.

---

### Luồng 4 — Middleware xác thực mỗi request

Thứ tự middleware bắt buộc cho mọi protected endpoint:

```
Request đến
    │
    ▼
[1] extractToken
    - Đọc header Authorization: Bearer <token>
    - Thiếu header → 401 { code: "MISSING_TOKEN" }
    │
    ▼
[2] verifyJWT (Backend tự verify — KHÔNG đọc X-User-Role từ Gateway)
    - jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] })
    - Sai chữ ký    → 401 { code: "INVALID_TOKEN" }
    - Hết hạn       → 401 { code: "TOKEN_EXPIRED" }
    - Gắn payload vào req.jwtPayload
    │
    ▼
[3] checkBlacklist
    - GET jwt:blacklist:{payload.jti} từ Redis
    - Tồn tại       → 401 { code: "TOKEN_REVOKED" }
    │
    ▼
[4] loadUser
    - SELECT id, role, is_active FROM users WHERE id = payload.sub
    - Không tồn tại → 401 { code: "USER_NOT_FOUND" }
    - is_active = false → 401 { code: "USER_INACTIVE" }
    - Gắn vào req.user, req.userRole, req.userId
    │
    ▼
[5] requireRole(...allowedRoles)
    - req.userRole NOT IN allowedRoles → 403 { code: "FORBIDDEN" }
    │
    ▼
[6] requireOwnership (chỉ áp dụng với student + resource có owner)
    - resource.user_id !== req.userId → 403 { code: "FORBIDDEN" }
    │
    ▼
Handler nghiệp vụ
```

**Lý do Backend tự verify JWT thay vì đọc header từ Gateway:**
Gateway forward `Authorization: Bearer <token>` nguyên bản xuống backend.
Backend tự parse và verify — tránh rủi ro giả mạo `X-User-Role` header
nếu có request bypass gateway.

---

### Luồng 5 — Cài đặt middleware Node.js

```javascript
// Middleware [2]: verify JWT bằng RS256 public key
const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH);

function verifyJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ code: 'MISSING_TOKEN' });

  try {
    req.jwtPayload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ code: 'INVALID_TOKEN' });
  }
}

// Middleware [5]: role-based authorization
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }
    next();
  };
}

// Middleware [6]: ownership check cho student
function requireOwnership(resourceFetcher) {
  return async (req, res, next) => {
    if (req.userRole !== 'student') return next(); // admin/staff bỏ qua
    const resource = await resourceFetcher(req.params.id);
    if (!resource || resource.user_id !== req.userId) {
      return res.status(403).json({ code: 'FORBIDDEN' });
    }
    req.resource = resource;
    next();
  };
}

// Ví dụ áp dụng trên router
router.post('/workshops',
  verifyJWT, checkBlacklist, loadUser,
  requireRole('admin'),
  workshopController.create
);

router.post('/checkin',
  verifyJWT, checkBlacklist, loadUser,
  requireRole('staff'),
  checkinController.scan
);

router.post('/registrations/:id/cancel',
  verifyJWT, checkBlacklist, loadUser,
  requireRole('student', 'admin'),
  requireOwnership(registrationService.findById),
  registrationController.cancel
);
```

---

### Luồng 6 — Rate Limiting đăng nhập (Token Bucket, Lua script)

Endpoint `/api/auth/login` áp dụng rate limit nghiêm ngặt hơn:
5 request/phút/IP để chống brute-force.

```lua
-- Script Lua chạy atomic trên Redis (tránh race condition)
local key        = KEYS[1]             -- ratelimit:ip:{ip}:login
local max_tokens = tonumber(ARGV[1])   -- 5
local refill_rate = tonumber(ARGV[2])  -- 0.083 token/s (5/phút)
local now        = tonumber(ARGV[3])   -- unix timestamp ms

local data = redis.call('GET', key)
local tokens, last_ts

if data then
  local parsed  = cjson.decode(data)
  tokens  = parsed.tokens
  last_ts = parsed.last_ts
  local elapsed = (now - last_ts) / 1000
  tokens = math.min(max_tokens, tokens + elapsed * refill_rate)
else
  tokens  = max_tokens
  last_ts = now
end

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('SET', key, cjson.encode({tokens=tokens, last_ts=now}), 'EX', 120)
  return {1, tokens}   -- allowed
else
  local wait = math.ceil((1 - tokens) / refill_rate)
  return {0, wait}     -- blocked, số giây chờ
end
```

Khi bị chặn → `429 Too Many Requests` với header `Retry-After: {wait}`.

---

### Ma trận phân quyền (RBAC)

| Endpoint                              | Method | student | admin | staff |
|---------------------------------------|:------:|:-------:|:-----:|:-----:|
| `/api/auth/login`                     | POST   | ✅      | ✅    | ✅    |
| `/api/auth/refresh`                   | POST   | ✅      | ✅    | ✅    |
| `/api/auth/logout`                    | POST   | ✅      | ✅    | ✅    |
| `/api/workshops`                      | GET    | ✅      | ✅    | ✅    |
| `/api/workshops/:id`                  | GET    | ✅      | ✅    | ✅    |
| `/api/workshops`                      | POST   | ❌      | ✅    | ❌    |
| `/api/workshops/:id`                  | PUT    | ❌      | ✅    | ❌    |
| `/api/workshops/:id`                  | DELETE | ❌      | ✅    | ❌    |
| `/api/workshops/:id/participants`     | GET    | ❌      | ✅    | ❌    |
| `/api/workshops/statistics`           | GET    | ❌      | ✅    | ❌    |
| `/api/register`                       | POST   | ✅      | ❌    | ❌    |
| `/api/my-registrations`               | GET    | ✅      | ❌    | ❌    |
| `/api/registrations`                  | GET    | ❌      | ✅    | ❌    |
| `/api/registrations/:id/cancel`       | POST   | ✅*     | ✅    | ❌    |
| `/api/checkin`                        | POST   | ❌      | ❌    | ✅    |
| `/api/checkin/preload`                | GET    | ❌      | ❌    | ✅    |
| `/api/checkin/sync-offline`           | POST   | ❌      | ❌    | ✅    |
| `/api/users/me`                       | GET    | ✅      | ✅    | ✅    |

> `*` student chỉ hủy được registration của chính mình (ownership check).

---

## Kịch bản lỗi

### E1 — Sai mật khẩu hoặc email không tồn tại

- Luôn trả `401 { code: "INVALID_CREDENTIALS" }`.
- **Không phân biệt** "email không tồn tại" vs "sai mật khẩu" trong response —
  tránh user enumeration attack.
- Đếm lần thất bại qua Token Bucket rate limit (5 req/phút/IP).

### E2 — Tài khoản bị deactivate (`is_active = false`)

- Middleware `loadUser` phát hiện → `401 { code: "USER_INACTIVE" }`.
- RefreshToken trong Redis **không bị xóa tự động**. Lần refresh tiếp theo
  tạo accessToken mới → bị chặn tại bước `loadUser`.
- Để revoke ngay lập tức: xóa thủ công key `refresh:{token}` trong Redis.

### E3 — RefreshToken không tồn tại hoặc hết hạn

- `GET refresh:{token}` trả về null (key đã hết 7 ngày hoặc đã logout).
- → `401 { code: "REFRESH_TOKEN_EXPIRED" }`.
- Client phải redirect về trang đăng nhập.

### E4 — Redis down khi checkBlacklist

- Middleware `checkBlacklist` **fail open**: nếu Redis không phản hồi trong
  50ms, bỏ qua bước check, log cảnh báo, cho request đi tiếp.
- **Lý do**: availability quan trọng hơn việc chặn token trong cửa sổ
  15 phút. Thiệt hại tối đa: token đã logout dùng được tối đa 15 phút.
- Bước `loadUser` vẫn query PostgreSQL bình thường.

### E5 — Redis down khi lưu refreshToken lúc login

- `redis.set(...)` ném exception sau timeout.
- Auth Module bắt exception → trả `500 { code: "AUTH_SERVICE_ERROR" }`.
- **Không** trả token nếu chưa lưu được refresh key — tránh token mà
  server không có cách revoke.

### E6 — JWT_PRIVATE_KEY bị thay đổi (key rotation)

- Toàn bộ accessToken hiện tại bị invalid (sai chữ ký).
- Toàn bộ refreshToken trong Redis vẫn còn, nhưng khi refresh sẽ tạo
  accessToken mới với key mới → hợp lệ.
- Hành vi: user bị logout ngay tại request tiếp theo, phải đăng nhập lại.
- Key rotation phải qua environment variable restart, không hot-reload.

### E7 — Hai request đăng nhập đồng thời cùng tài khoản

- Cả hai đều thành công, mỗi cái nhận refreshToken riêng biệt.
- Redis lưu cả hai keys (multi-session).
- Logout một session không ảnh hưởng session kia.
- Trong phiên bản này không giới hạn số session đồng thời.

---

## Ràng buộc

### Hiệu năng
- `bcrypt.compare()` với work factor 10: phải < 200ms trên server.
- Middleware chain (bước 1–4): phải hoàn thành < 20ms khi Redis khả dụng.
- Endpoint `/api/auth/login`: p99 < 500ms (bao gồm bcrypt).
- Mọi Redis key liên quan auth phải có TTL — không set key vĩnh viễn.

### Bảo mật
- Thuật toán JWT: **RS256** (không dùng HS256 hay HS512).
- `JWT_PRIVATE_KEY` chỉ tồn tại trong Auth Service process, không share
  sang module khác.
- `JWT_PUBLIC_KEY` được đọc bởi API Gateway và Backend để verify.
- `refreshToken` là opaque string (`crypto.randomBytes(32).toString('hex')`),
  **không phải JWT** — không expose thông tin role khi decode.
- Web App: accessToken lưu trong memory (React state), không `localStorage`.
  RefreshToken lưu trong `httpOnly; Secure; SameSite=Strict` cookie.
- Mobile App: accessToken và refreshToken lưu trong Secure Storage
  (Keychain iOS / Keystore Android), không plain SharedPreferences.
- Tất cả `/api/auth/*` endpoint phải qua HTTPS (Nginx enforce redirect).
- Không log password, token, hay hash ra stdout/file log.

### Tính nhất quán
- Logout phải xóa refreshToken VÀ thêm accessToken vào blacklist
  trong cùng một Redis pipeline (atomic) — không được để trạng thái
  trung gian (xóa refresh thành công nhưng blacklist thất bại).

---

## Tiêu chí chấp nhận

| ID    | Kịch bản                                                          | Kết quả mong đợi                                          |
|-------|-------------------------------------------------------------------|-----------------------------------------------------------|
| AC-01 | Đăng nhập đúng email/password của student                        | 200, nhận accessToken (15 phút) + refreshToken            |
| AC-02 | Đăng nhập đúng email/password của staff                          | 200, nhận accessToken (8 giờ) + refreshToken              |
| AC-03 | Đăng nhập sai password                                            | 401 INVALID_CREDENTIALS (không lộ lý do cụ thể)          |
| AC-04 | Đăng nhập 6 lần liên tiếp trong 1 phút từ cùng IP                | Lần 6 nhận 429 Too Many Requests, có header Retry-After   |
| AC-05 | Gọi protected endpoint với accessToken hợp lệ role=admin         | Request đến handler thành công                            |
| AC-06 | Student gọi POST /api/workshops (admin-only)                     | 403 FORBIDDEN                                             |
| AC-07 | Staff gọi POST /api/register (student-only)                      | 403 FORBIDDEN                                             |
| AC-08 | Student gọi cancel registration của student khác                 | 403 FORBIDDEN (ownership check fail)                      |
| AC-09 | AccessToken hết hạn, gọi /api/auth/refresh với refreshToken hợp lệ | 200, nhận accessToken mới                              |
| AC-10 | Đăng xuất, sau đó dùng accessToken cũ (chưa hết 15 phút)        | 401 TOKEN_REVOKED                                         |
| AC-11 | RefreshToken hết hạn 7 ngày                                       | 401 REFRESH_TOKEN_EXPIRED, client phải login lại          |
| AC-12 | Gọi /api/auth/refresh với refreshToken giả mạo                   | 401 REFRESH_TOKEN_EXPIRED                                 |
| AC-13 | Tài khoản bị set is_active=false, gọi endpoint bất kỳ           | 401 USER_INACTIVE                                         |
| AC-14 | Redis down, gọi protected endpoint với token hợp lệ chưa logout  | 200, request thành công (fail open), có log cảnh báo      |
| AC-15 | Verify JWT bằng public key đúng                                   | Signature hợp lệ, request đi tiếp                         |
| AC-16 | Verify JWT bằng public key sai (giả mạo token)                   | 401 INVALID_TOKEN                                         |
| AC-17 | Mobile App đăng nhập với role=student                             | App nhận token, có thể xem workshop và QR của mình        |
