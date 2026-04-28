## 6. Thiết kế Kiểm soát Truy cập

### 6.1 Mô hình RBAC — Role-Based Access Control

UniHub Workshop sử dụng **RBAC phẳng (Flat RBAC)** với 3 role cố định. Không dùng ABAC vì quyền hạn không phức tạp theo attribute, không dùng ACL vì số resource type có giới hạn và rõ ràng.

#### 6.1.1 Định nghĩa Role

| Role | Lưu trong DB | Mô tả |
|---|---|---|
| `student` | `users.role = 'student'` | Sinh viên đã xác thực qua hệ thống. Chỉ thao tác trên dữ liệu của chính mình. |
| `admin` | `users.role = 'admin'` | Ban tổ chức. Toàn quyền quản lý workshop và xem thống kê. |
| `staff` | `users.role = 'staff'` | Nhân sự check-in. Chỉ truy cập chức năng quét QR. |

---

### 6.2 Ma trận Quyền hạn

#### 6.2.1 Workshop Management

| Endpoint | Method | student | admin | staff |
|---|---|---|---|---|
| `/workshops` | GET | ✅ | ✅ | ✅ |
| `/workshops/:id` | GET | ✅ | ✅ | ✅ |
| `/workshops` | POST | ❌ | ✅ | ❌ |
| `/workshops/:id` | PUT | ❌ | ✅ | ❌ |
| `/workshops/:id` | DELETE | ❌ | ✅ | ❌ |
| `/workshops/:id/participants` | GET | ❌ | ✅ | ❌ |
| `/workshops/:id/pdf` | POST | ❌ | ✅ | ❌ |
| `/workshops/statistics` | GET | ❌ | ✅ | ❌ |

#### 6.2.2 Registration

| Endpoint | Method | student | admin | staff | Ghi chú |
|---|---|---|---|---|---|
| `/register` | POST | ✅ | ❌ | ❌ | Chỉ đăng ký cho chính mình |
| `/my-registrations` | GET | ✅ | ❌ | ❌ | Chỉ thấy của mình |
| `/registrations` | GET | ❌ | ✅ | ❌ | Xem tất cả |
| `/registrations/:id/cancel` | POST | ✅* | ✅ | ❌ | *Chỉ hủy của mình |

#### 6.2.3 Check-in

| Endpoint | Method | student | admin | staff |
|---|---|---|---|---|
| `/checkin` | POST | ❌ | ❌ | ✅ |
| `/checkin/preload` | GET | ❌ | ❌ | ✅ |
| `/checkin/sync-offline` | POST | ❌ | ❌ | ✅ |

#### 6.2.4 User Management

| Endpoint | Method | student | admin | staff |
|---|---|---|---|---|
| `/users/me` | GET | ✅ | ✅ | ✅ |
| `/users` | GET | ❌ | ✅ | ❌ |
| `/users/:id` | GET | ❌ | ✅ | ❌ |

---

### 6.3 Kiến trúc kiểm tra quyền — 3 lớp

```
Request từ Client
       │
       ▼
┌──────────────────────────────┐
│  LAYER 1: API Gateway        │  ← Authentication
│                              │
│  1. Có header Authorization? │
│     └─ Không → 401           │
│  2. JWT valid & chưa hết hạn?│
│     └─ Không → 401           │
│  3. Đọc {user_id, role}      │
│     từ JWT payload           │
│  4. Gắn vào request:         │
│     X-User-Id: uuid          │
│     X-User-Role: student     │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  LAYER 2: Backend Service    │  ← Authorization (Role check)
│                              │
│  Middleware requireRole():   │
│  • Đọc X-User-Role header    │
│  • Role có trong allowedRoles│
│    không?                    │
│     └─ Không → 403 Forbidden │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  LAYER 3: Business Logic     │  ← Ownership check (student only)
│                              │
│  Với role 'student':         │
│  • registration.user_id      │
│    === X-User-Id ?           │
│     └─ Không → 403           │
│  • Chỉ áp dụng cho resource  │
│    có owner (registrations,  │
│    notifications)            │
└──────────────────────────────┘
       │
       ▼
   Xử lý nghiệp vụ
```

#### 6.3.1 Cài đặt middleware (Node.js)

```javascript
// Layer 2: Role-based authorization middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bạn không có quyền thực hiện hành động này'
      });
    }
    req.userRole = role;
    req.userId = req.headers['x-user-id'];
    next();
  };
}

// Layer 3: Ownership middleware (dành cho student)
function requireOwnership(resourceFetcher) {
  return async (req, res, next) => {
    if (req.userRole !== 'student') return next(); // admin/staff bỏ qua
    const resource = await resourceFetcher(req.params.id);
    if (!resource || resource.user_id !== req.userId) {
      return res.status(403).json({ error: 'Không có quyền truy cập tài nguyên này' });
    }
    req.resource = resource;
    next();
  };
}

// Áp dụng trên router
router.post('/workshops',
  requireRole('admin'),
  workshopController.create
);

router.post('/checkin',
  requireRole('staff'),
  checkinController.scan
);

router.post('/registrations/:id/cancel',
  requireRole('student', 'admin'),
  requireOwnership(registrationService.findById),
  registrationController.cancel
);
```

---

### 6.4 JWT — Cấu trúc và Chiến lược

#### 6.4.1 Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "role": "staff",
  "email": "nhansu01@university.edu.vn",
  "iat": 1700000000,
  "exp": 1700028800,
  "jti": "unique-token-id-for-blacklist"
}
```

#### 6.4.2 Chiến lược bảo mật JWT

| Thuộc tính | Quyết định | Lý do |
|---|---|---|
| Algorithm | RS256 (asymmetric) | API Gateway chỉ cần public key để verify; Auth Service giữ private key. Không service nào khác có thể tạo token hợp lệ. |
| Access token TTL | 1 giờ | Đủ ngắn để giới hạn thiệt hại nếu bị lộ |
| Refresh token TTL | 7 ngày | Cho phép user không phải login lại thường xuyên |
| TTL cho `staff` | 8 giờ (1 ca làm) | Staff token hết hạn cuối ca, không dùng được ngày hôm sau |
| Blacklist | Redis `jwt:blacklist:{jti}` | Cho phép revoke token khi logout hoặc phát hiện lạm dụng |

#### 6.4.3 Luồng xác thực Mobile App (staff)

```
Staff mở app → Login với email/password
     │
     ▼
Auth Service verify → Issue JWT (role=staff, exp=8h)
     │
     ▼
Mobile App lưu JWT an toàn (Secure Storage, không localStorage)
     │
     ▼
Mỗi request: gắn JWT vào header Authorization: Bearer {token}
     │
     ▼
API Gateway verify signature, check exp → extract role=staff
     │
     ▼
Check-in Service nhận X-User-Role: staff → cho phép /checkin/*
```

---