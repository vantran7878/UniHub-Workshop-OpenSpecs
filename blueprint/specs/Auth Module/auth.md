# Auth Module — Feature Specs

Tổng quan: Module được chia thành **7 feature** độc lập, có thể implement và review riêng lẻ. Thứ tự thực hiện theo dependency từ trên xuống.

---

## Feature 1 — Database Schema & User Model

**Mục tiêu:** Thiết lập nền tảng dữ liệu cho toàn bộ auth module.

**Việc cần làm:**
- Tạo bảng `users` với các trường: `id` (UUID), `email` (unique), `password_hash`, `role` (`student` | `staff` | `admin`), `created_at`, `updated_at`, `is_active` (boolean).
- Tạo bảng `audit_logs` với các trường: `id`, `event_type`, `user_id` (nullable), `metadata` (JSON), `ip_address`, `created_at`.
- Viết migration script.
- Seed script cho tài khoản admin đầu tiên.

**Acceptance criteria:**
- Migration chạy thành công, rollback được.
- Seed tạo được 1 admin account với mật khẩu đã được hash.
- Không có trường `password` plaintext nào trong DB.

**Dependencies:** Không có.

---

## Feature 2 — Student Registration

**Mục tiêu:** Cho phép student tự đăng ký tài khoản qua endpoint công khai.

**Endpoint:** `POST /auth/register`

**Request body:**
```json
{
  "email": "student@example.com",
  "password": "Abc@12345",
  "full_name": "Nguyen Van A"
}
```

**Việc cần làm:**
- Validate email format và kiểm tra trùng lặp.
- Validate password theo policy: tối thiểu 8 ký tự, có chữ hoa, số, ký tự đặc biệt.
- Hash password bằng bcrypt (cost factor 12) trước khi lưu.
- Gán `role = student` mặc định, không cho phép client tự chọn role.
- Trả về `201 Created` khi thành công (không trả về token — yêu cầu login riêng).
- Ghi audit log: `REGISTER_SUCCESS`.

**Error cases:**
| Tình huống | Response |
|---|---|
| Email đã tồn tại | `409 Conflict` |
| Password không đủ mạnh | `400 Bad Request` |
| Email sai format | `400 Bad Request` |

**Acceptance criteria:**
- Không thể đăng ký với `role: admin` hoặc `role: staff` qua endpoint này.
- Gọi 2 lần với cùng email → lần 2 trả về `409`.
- Password không bao giờ xuất hiện trong response hoặc log.

**Dependencies:** Feature 1.

---

## Feature 3 — Login & JWT Issuance

**Mục tiêu:** Xác thực người dùng và phát hành access token + refresh token.

**Endpoint:** `POST /auth/login`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "Abc@12345"
}
```

**Response (200 OK):**
```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900
}
```
Refresh token được set qua HTTP-only cookie (`Set-Cookie: refresh_token=...`).

**Việc cần làm:**
- So sánh password với hash trong DB bằng bcrypt.
- Nếu xác thực thành công, ký access token bằng RS256 private key với payload:
  ```json
  { "sub": "user_id", "role": "student", "iat": ..., "exp": ... }
  ```
  - Access token TTL: **15 phút**.
- Tạo refresh token (opaque random string), hash SHA-256 rồi lưu vào Redis với TTL **7 ngày**.
- Set refresh token vào HTTP-only, Secure, SameSite=Strict cookie.
- Ghi audit log: `LOGIN_SUCCESS` hoặc `LOGIN_FAILURE`.

**Error cases:**
| Tình huống | Response |
|---|---|
| Email không tồn tại | `401 Unauthorized` — `"Invalid credentials"` |
| Sai password | `401 Unauthorized` — `"Invalid credentials"` |
| Tài khoản bị vô hiệu hóa | `401 Unauthorized` — `"Invalid credentials"` |

> **Lưu ý bảo mật:** Tất cả lỗi login đều trả về cùng 1 message để tránh user enumeration. Lý do thực sự chỉ ghi vào audit log.

**Acceptance criteria:**
- Access token decode ra đúng `sub`, `role`, `exp`.
- Refresh token không xuất hiện trong response body.
- Login với email không tồn tại và login sai password trả về response giống hệt nhau.

**Dependencies:** Feature 1, Feature 2 (cần có user để test).

---

## Feature 4 — Token Refresh & Rotation

**Mục tiêu:** Cấp access token mới khi token cũ hết hạn, không yêu cầu login lại.

**Endpoint:** `POST /auth/refresh`

**Request:** Không cần body — refresh token được đọc từ HTTP-only cookie.

**Response (200 OK):**
```json
{
  "access_token": "<new_jwt>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

**Việc cần làm:**
- Đọc refresh token từ cookie.
- Hash token và kiểm tra trong Redis: tồn tại và chưa bị blacklist.
- Nếu hợp lệ:
  - Xóa (blacklist) refresh token cũ khỏi Redis.
  - Tạo access token mới + refresh token mới.
  - Lưu refresh token mới vào Redis.
  - Set cookie mới.
- Nếu Redis unavailable: trả về `503 Service Unavailable`.
- Ghi audit log: `TOKEN_REFRESH`.

**Error cases:**
| Tình huống | Response |
|---|---|
| Cookie không có refresh token | `401 Unauthorized` |
| Token không tồn tại trong Redis (đã xoay vòng hoặc hết hạn) | `401 Unauthorized` |
| Redis unavailable | `503 Service Unavailable` |

**Acceptance criteria:**
- Sau khi refresh, token cũ không thể dùng lại (rotation).
- Dùng refresh token đã dùng một lần → `401`.
- Khi Redis down → `503`, không phải crash.

**Dependencies:** Feature 3.

---

## Feature 5 — Logout & Token Blacklisting

**Mục tiêu:** Vô hiệu hóa session ngay lập tức khi người dùng logout hoặc có sự kiện bảo mật.

**Endpoint:** `POST /auth/logout`

**Request:** Cần access token hợp lệ trong header. Refresh token đọc từ cookie.

**Việc cần làm:**
- Đọc refresh token từ cookie và xóa khỏi Redis.
- Xóa cookie `refresh_token`.
- Trả về `204 No Content`.
- Ghi audit log: `LOGOUT`.

**Blacklist triggers ngoài logout:**
- Khi admin đổi role của user → gọi internal `blacklistAllTokens(userId)`.
- Khi user đổi mật khẩu → gọi internal `blacklistAllTokens(userId)`.

`blacklistAllTokens(userId)`: xóa toàn bộ refresh token đang active của user đó trong Redis (dùng key pattern `refresh:<userId>:*`).

**Acceptance criteria:**
- Sau logout, refresh token không còn dùng được.
- Access token hiện tại vẫn hợp lệ tối đa 15 phút (hết hạn tự nhiên) — đây là trade-off chấp nhận được.
- Đổi mật khẩu → mọi phiên khác bị kick.

**Dependencies:** Feature 3, Feature 4.

---

## Feature 6 — Auth Middleware & RBAC

**Mục tiêu:** Bảo vệ toàn bộ API route, kiểm tra quyền truy cập theo role và ownership.

**Việc cần làm:**

### 6a. `authenticateToken` middleware
- Đọc JWT từ `Authorization: Bearer <token>` header.
- Verify chữ ký bằng RS256 public key.
- Kiểm tra `exp` — nếu hết hạn trả về `401`.
- Gắn `{ userId, role }` vào `request.user`.

### 6b. `requireRole(...roles)` middleware
- Nhận danh sách role được phép, ví dụ `requireRole("admin", "staff")`.
- So sánh với `request.user.role`.
- Không khớp → `403 Forbidden`.

### 6c. `requireOwnership(getOwnerId)` middleware
- Nhận một hàm `getOwnerId(req)` để lấy `owner_id` của resource từ DB.
- So sánh với `request.user.userId`.
- Nếu không khớp **và** user không phải `admin` → `403 Forbidden`.

**Cách dùng trong route:**
```ts
// Chỉ student mới tự đăng ký workshop của mình
router.post(
  "/registrations",
  authenticateToken,
  requireRole("student"),
  createRegistration
);

// Student chỉ xem được registration của mình; admin xem được tất cả
router.get(
  "/registrations/:id",
  authenticateToken,
  requireRole("student", "admin"),
  requireOwnership((req) => getRegistrationOwnerId(req.params.id)),
  getRegistration
);
```

**Permission matrix áp dụng:**

| Action | Middleware chain |
|---|---|
| Đăng ký workshop | `authenticateToken` → `requireRole("student")` |
| Huỷ đăng ký | `authenticateToken` → `requireRole("student", "admin")` → `requireOwnership` |
| Xem danh sách attendee | `authenticateToken` → `requireRole("staff", "admin")` |
| Điểm danh | `authenticateToken` → `requireRole("staff", "admin")` |
| CRUD workshop | `authenticateToken` → `requireRole("admin")` |
| Tạo tài khoản staff | `authenticateToken` → `requireRole("admin")` |
| Đổi role user | `authenticateToken` → `requireRole("admin")` |

**Acceptance criteria:**
- Student gọi admin endpoint → `403`.
- Student gọi endpoint của student khác (có ownership check) → `403`.
- Token hết hạn → `401`, không phải `403`.
- Middleware hoạt động đúng khi không có token → `401`.

**Dependencies:** Feature 3.

---

## Feature 7 — Rate Limiting & Audit Logging

**Mục tiêu:** Chống brute-force trên auth endpoints và ghi lại mọi sự kiện bảo mật quan trọng.

### 7a. Rate Limiting

**Việc cần làm:**
- Implement rate limiter dùng Redis (sliding window hoặc fixed window).
- Áp dụng cho:

| Endpoint | Giới hạn |
|---|---|
| `POST /auth/login` | 10 request / IP / 15 phút |
| `POST /auth/register` | 5 request / IP / giờ |
| `POST /auth/refresh` | 30 request / IP / 15 phút |

- Khi vượt giới hạn: trả về `429 Too Many Requests` với header `Retry-After: <seconds>`.
- Khi Redis unavailable: fail-open (bỏ qua rate limit, không block request) — ghi warning log.

> Fail-open ở đây khác với token blacklist (fail-closed). Rate limit là defense-in-depth, mất đi tạm thời thì chấp nhận được; mất token blacklist thì không.

**Acceptance criteria:**
- Gửi 11 request login liên tiếp từ cùng IP → request thứ 11 nhận `429`.
- Response có header `Retry-After`.
- IP khác nhau không ảnh hưởng lẫn nhau.

### 7b. Audit Logging

**Việc cần làm:**
- Tạo service `auditLog(event, metadata)` ghi vào bảng `audit_logs`.
- Ghi log bất đồng bộ (không block response).
- Các event cần log:

| Event | Metadata |
|---|---|
| `REGISTER_SUCCESS` | `user_id`, `ip` |
| `LOGIN_SUCCESS` | `user_id`, `role`, `ip` |
| `LOGIN_FAILURE` | `email_attempted`, `ip`, `reason` |
| `LOGOUT` | `user_id`, `ip` |
| `TOKEN_REFRESH` | `user_id`, `ip` |
| `TOKEN_BLACKLISTED` | `user_id`, `reason` |
| `ROLE_CHANGED` | `target_user_id`, `old_role`, `new_role`, `changed_by` |
| `PASSWORD_CHANGED` | `user_id`, `changed_by` |
| `ACCOUNT_CREATED` | `new_user_id`, `role`, `created_by` |

- Log không được chứa plaintext password, raw token, hoặc thông tin nhạy cảm khác.

**Acceptance criteria:**
- Mỗi login thành công tạo 1 bản ghi `LOGIN_SUCCESS` trong DB.
- Login thất bại tạo `LOGIN_FAILURE` với `reason` — nhưng `reason` này **không** xuất hiện trong API response.
- Audit log không thể bị xóa qua bất kỳ API nào của ứng dụng.

**Dependencies:** Feature 1, tích hợp vào Feature 2–6.

---

## Thứ tự implement gợi ý

```
Feature 1 (Schema)
    ↓
Feature 2 (Register) ──→ Feature 3 (Login)
                               ↓
                    Feature 4 (Refresh) + Feature 5 (Logout)
                               ↓
                    Feature 6 (Middleware & RBAC)
                               ↓
                    Feature 7 (Rate Limit + Audit) ← tích hợp xuyên suốt
```

Feature 7b (Audit Logging) nên được tích hợp dần vào mỗi feature trước đó thay vì để cuối — tránh phải quay lại sửa nhiều chỗ.