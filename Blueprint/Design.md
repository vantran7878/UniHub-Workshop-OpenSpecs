## Kiến trúc tổng thể
Hệ thống UniHub Workshop được thiết kế theo mô hình **hybrid architecture (REST + Event-driven)** nhằm đảm bảo:

- Khả năng chịu tải cao (120000 user)
- Tính nhất quán dữ liệu trong đăng ký workshop
- Khả năng mở rộng và tích hợp hệ thống ngoài
- Khả năng degrade khi service phụ bị lỗi

## High-Level Architecture Diagram
### Tổng quan kiến trúc 4-layer
Hệ thống bao gồm 4 layer chính:

1. Client Layer
2. API Layer
3. Data Layer
4. Message Broker Layer

```
┌──────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────┐   ┌──────────────────────────┐ │
│  │  Web App (React/Next.js)     │   │ Mobile App (Flutter)     │ │
│  │  - Student Dashboard         │   │ - QR Scan Check-in       │ │
│  │  - Admin Panel               │   │ - Offline Data Sync      │ │
│  │  - Login/Register            │   │ - Local SQLite DB        │ │
│  └──────────────────────────────┘   └──────────────────────────┘ │
│                │                              │                  │
└────────────────┼──────────────────────────────┼──────────────────┘
                 │        HTTPS/REST            │
                 └──────────────┬───────────────┘
                                │
                ┌───────────────▼────────────────┐
                │     API GATEWAY (Nginx)        │
                ├────────────────────────────────┤
                │ - JWT Authentication           │
                │ - Rate Limiting (Token Bucket) │
                │ - Request/Response Logging     │
                │ - Load Balancing               │
                └───────────────┬────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                   API SERVICES LAYER                             │
├───────────────────────────────┼──────────────────────────────────┤
│                               │                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Auth Service   │  │ Workshop     │  │ Registration Service │  │
│  │                │  │ Service      │  │                      │  │
│  │ - Login        │  │              │  │ - Register Workshop  │  │
│  │ - Register     │  │ - CRUD       │  │ - Cancel Register    │  │
│  │ - JWT Verify   │  │ - List       │  │ - Conflict Detection │  │
│  └────────────────┘  │ - AI Summary │  └──────────────────────┘  │
│         │            │   Generator  │              │             │
│         └────────────┼──────────────┼──────────────┘             │
│                      │              │                            │
│  ┌────────────────┐  │  ┌──────────────┐  ┌──────────────────┐   │
│  │ Payment Service│  │  │ Check-in     │  │ Notification     │   │
│  │                │  │  │ Service      │  │ Service          │   │
│  │ - Process Pay. │  │  │              │  │                  │   │
│  │ - Verify Idem. │  │  │ - Record     │  │ - Send via App   │   │
│  │ - Handle 3DS   │  │  │ - Offline    │  │ - Send via Email │   │
│  │                │  │  │   Handling   │  │ - Send via SMS   │   │
│  └────────┬───────┘  │  │ - Sync to DB │  │ - Queue Events   │   │
│           │          │  └──────────────┘  └──────────────────┘   │
│           │          │         │                    │            │
│           └──────────┼─────────┼────────────────────┘            │
│                      │         │                                 │
└──────────────────────┼─────────┼─────────────────────────────────┘
                       │         │
                       │ (REST + gRPC - internal only)
                       │         │
         ┌─────────────▼─────────▼───────────┐
         │   Message Broker (RabbitMQ)       │
         ├───────────────────────────────────┤
         │ Queues:                           │
         │ - payment.process                 │
         │ - payment.callback                │
         │ - notification.queue              │
         │ - checkin.sync                    │
         │ - csv.import                      │
         │ - ai_summary.generate             │
         └─────────────┬───────────────────┬─┘
                       │                   │
┌──────────────────────┼───────────────────┼──────────────────────┐
│              DATA PERSISTENCE LAYER                             │
├──────────────────────┼───────────────────┼──────────────────────┤
│                      │                   │                      │
│  ┌──────────────┐   ┌▼───────────┐   ┌───▼─────────────┐        │
│  │ PostgreSQL   │   │ Redis      │   │ External APIs   │        │
│  │ (Primary DB) │   │ (Cache &   │   │                 │        │
│  │              │   │  Counters) │   │ - Payment       │        │
│  │ - Users      │   │            │   │   Gateway       │        │
│  │ - Workshops  │   │ - Counters │   │ - AI Model      │        │
│  │ - Registr.   │   │ - TTL      │   │ - Email SMTP    │        │
│  │ - Payments   │   │ - Lock     │   │ - SMS Service   │        │
│  │ - Check-ins  │   │ - Session  │   │                 │        │
│  │ - Notif.     │   │ - Rate     │   └─────────────────┘        │
│  │ - Audit logs │   │   Limits   │                              │
│  └──────────────┘   └────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Mô tả từng layer
#### 1. Client Layer

**Web App (React/Next.js)**
- Sinh viên: xem danh sách workshop, đăng ký, xem QR code
- Ban tổ chức: tạo workshop, sửa room/time, xem thống kê, xem danh sách đăng ký

**Mobile App (Flutter)**
- Nhân sự: quét QR code để check-in
- Hỗ trợ offline mode: SQLite local database lưu registration list
- Khi mất mạng: check-in được ghi nhận local
- Khi có mạng: tự động sync với server

#### 2. API Layer

#### API Gateway

Chịu trách nhiệm:
- **JWT Authentication**: Verify token, extract user info
- **Rate Limiting**: Dùng Token Bucket để chống burst (120,000 user)
- **Request/Response Logging**: Audit trail, debugging
- **Load Balancing**: Phân phối traffic tới backend instances

#### Backend API (Service-based)

**Auth Service**
- Login/Register với JWT token
- Token refresh
- Đồng bộ user từ CSV hàng đêm

**Workshop Service**
- GET /workshops (danh sách workshop)
- GET /workshops/{id} (chi tiết workshop)
- POST /workshops (tạo workshop - admin)
- PUT /workshops/{id} (sửa workshop - admin)
- DELETE /workshops/{id} (hủy workshop - admin)
- AI Summary generator (consume từ message queue)

**Registration Service**
- POST /register (sinh viên đăng ký)
- GET /my-registrations (xem những đơn đăng ký của mình)
- POST /registrations/{id}/cancel (hủy đơn)
- Xử lý race condition: 2 user cùng đăng ký 1 chỗ cuối cùng
- Gửi event tới message broker khi registration success

**Payment Service**
- Consume event từ message queue (payment.process)
- Call payment gateway với idempotency key
- Xử lý timeout (check transaction status)
- Circuit breaker: nếu gateway fail nhiều lần → OPEN
- Graceful degradation: khi gateway down, free workshop vẫn available

**Check-in Service**
- POST /checkin (quét QR online)
- POST /checkin/sync-offline (đồng bộ check-in khi offline)
- Xử lý deduplication: QR code scan 2 lần → chỉ record 1 lần

**Notification Service**
- Consume event từ message queue (notification.queue)
- Gửi push notification qua app
- Gửi email qua SMTP

#### 3. Message Broker Layer

**RabbitMQ** - xử lý asynchronous tasks

**Queues:**
- `payment.process` - registration service publish → payment service consume
- `payment.callback` - payment gateway webhook → payment service consume
- `notification.queue` - event sources → notification service consume
- `checkin.sync` - mobile app → check-in service consume
- `csv.import` - scheduled task → auth service consume
- `ai_summary.generate` - workshop service → AI service consume

#### 4. Data Persistence Layer

**PostgreSQL (Primary Database)**
- Lưu tất cả dữ liệu persistent
- ACID transactions → đảm bảo consistency

**Redis (Cache + Counters + Locks)**
- **Counters**: `workshop:{id}:seats_available` - atomic DECR
- **Locks**: `lock:workshop:{id}:register` - distributed lock
- **Rate Limiting**: `ratelimit:ip:{ip}:tokens` - token bucket counter
- **Idempotency**: `idempotent:payment:{uuid}` - cache payment result 24h
- **Session**: JWT token blacklist

**External APIs**
- Payment Gateway (3rd party)
- AI Model API (OpenAI, Claude, etc.)
- Email SMTP Server

## Thiết kế cơ sở dữ liệu

### Lựa chọn công nghệ

**PostgreSQL**: Lưu dữ liệu persistent
- Ưu điểm: ACID transactions, strong consistency, complex queries
- Dùng cho: users, workshops, registrations, payments, check-ins, notifications, audit logs

**Redis**: Cache + Counters + Locks
- Ưu điểm: Ultra-fast atomic operations, TTL support
- Dùng cho: seat counters, distributed locks, rate limiting, idempotency cache

### Database Schema

#### 1. Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'admin', 'staff')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_student_id (student_id),
    INDEX idx_email (email),
    INDEX idx_role (role)
);

COMMENT ON TABLE users IS 'Lưu thông tin tất cả users trong hệ thống';
COMMENT ON COLUMN users.student_id IS 'ID sinh viên từ hệ thống cũ (unique key)';
COMMENT ON COLUMN users.role IS 'student: sinh viên; admin: ban tổ chức; staff: nhân sự check-in';
COMMENT ON COLUMN users.password_hash IS 'Dùng bcrypt, salt 10 rounds';
```

#### 2. Workshops Table

```sql
CREATE TABLE workshops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    speaker VARCHAR(255),
    room VARCHAR(100),
    capacity INT NOT NULL CHECK (capacity > 0),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    price DECIMAL(10, 2) CHECK (price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled', 'completed')),
    registration_open_at TIMESTAMP NOT NULL,
    registration_close_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_start_time (start_time),
    INDEX idx_is_paid (is_paid),
    CHECK (end_time > start_time),
    CHECK (registration_close_at IS NULL OR registration_close_at > registration_open_at)
);

COMMENT ON TABLE workshops IS 'Lưu thông tin workshop/sự kiện';
COMMENT ON COLUMN workshops.capacity IS 'Số chỗ ngồi tối đa';
COMMENT ON COLUMN workshops.is_paid IS 'TRUE: có phí; FALSE: miễn phí';
COMMENT ON COLUMN workshops.status IS 'active: có thể đăng ký; cancelled: đã hủy; completed: đã kết thúc';
COMMENT ON COLUMN workshops.price IS 'Giá tiền workshop (VND)';
```

#### 3. Registrations Table

```sql
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show')),
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    qr_code_generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, workshop_id),
    INDEX idx_status (status),
    INDEX idx_qr_code (qr_code),
    INDEX idx_workshop_id (workshop_id),
    INDEX idx_user_id (user_id)
);

COMMENT ON TABLE registrations IS 'Lưu thông tin đăng ký của sinh viên cho workshop';
COMMENT ON COLUMN registrations.status IS 'pending: chưa thanh toán (paid workshop); confirmed: đã xác nhận; cancelled: hủy; no_show: không đến';
COMMENT ON COLUMN registrations.qr_code IS 'Unique QR code dùng cho check-in, generated từ UUID';
COMMENT ON COLUMN registrations.UNIQUE(user_id, workshop_id) IS 'Đảm bảo 1 user không đăng ký cùng workshop 2 lần';
```

**Tại sao cần UNIQUE(user_id, workshop_id)?**
- Prevent duplicate registration từ user click register 2 lần
- Database constraint làm lớp thứ 2 defense (lớp thứ 1 là application logic)

#### 4. Payments Table

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'VND',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    gateway_response JSONB,
    error_message TEXT,
    attempted_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_registration_id (registration_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_idempotency_key (idempotency_key),
    INDEX idx_created_at (created_at)
);

COMMENT ON TABLE payments IS 'Lưu thông tin giao dịch thanh toán';
COMMENT ON COLUMN payments.idempotency_key IS 'Dùng để chống trừ tiền 2 lần: user click register 2 lần → same key → gateway chỉ charge 1 lần';
COMMENT ON COLUMN payments.gateway_response IS 'JSON response từ payment gateway (include transaction details)';
COMMENT ON COLUMN payments.status IS 'pending: chưa xử lý; processing: đang xử lý; success: thành công; failed: thất bại; refunded: hoàn tiền';
```

**Tại sao cần idempotency_key?**
- Chống double-charge: user bấm "Thanh toán" 2 lần → 2 requests gửi tới server
- Server check Redis: idempotent:payment:{key} → nếu hit → return cached result (không charge lần 2)
- Nếu miss → call payment gateway → save result to Redis (TTL: 24h)

#### 5. Check-ins Table

```sql
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    checkin_time TIMESTAMP NOT NULL,
    device_id VARCHAR(255),
    location VARCHAR(100),
    is_synced BOOLEAN DEFAULT TRUE,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_workshop_id (workshop_id),
    INDEX idx_user_id (user_id),
    INDEX idx_checkin_time (checkin_time),
    INDEX idx_is_synced (is_synced)
);

COMMENT ON TABLE checkins IS 'Lưu thông tin check-in của sinh viên';
COMMENT ON COLUMN checkins.is_synced IS 'TRUE: đã sync với server; FALSE: vẫn trong offline queue của mobile app';
COMMENT ON COLUMN checkins.device_id IS 'Device ID của mobile app, dùng để track offline device';
COMMENT ON COLUMN checkins.UNIQUE(registration_id) IS 'Mỗi registration chỉ có 1 check-in record (one-to-one)';
```

**Tại sao cần is_synced flag?**
- Offline mode: mobile app quét QR locally → INSERT checkins với is_synced=FALSE
- Khi có mạng: mobile app batch upload tất cả unsynced check-ins
- Server xử lý + confirm → mobile app UPDATE is_synced=TRUE

#### 6. Notifications Table

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL
        CHECK (type IN ('registration_confirmed', 'payment_success', 'payment_failed', 'workshop_cancelled', 'reminder', 'checkin_success')),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
    channels JSONB DEFAULT '["app"]'::jsonb,
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
);

COMMENT ON TABLE notifications IS 'Lưu các thông báo cần gửi cho users';
COMMENT ON COLUMN notifications.channels IS 'JSON array: ["app", "email", "sms"] - chỉ những channel đã chọn';
COMMENT ON COLUMN notifications.retry_count IS 'Số lần đã retry (max 3 lần trước give up)';
```

**Tại sao cần channels field?**
- Không phải user nào cũng muốn nhận email/SMS
- channels config: ['app'] = chỉ push app, hoặc ['app', 'email', 'sms'] = gửi tất cả

#### 7. Workshop Summaries Table

```sql
CREATE TABLE workshop_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL UNIQUE REFERENCES workshops(id) ON DELETE CASCADE,
    pdf_file_path VARCHAR(500),
    summary TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'done', 'failed')),
    ai_model_used VARCHAR(100),
    processing_started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_workshop_id (workshop_id)
);

COMMENT ON TABLE workshop_summaries IS 'Lưu AI-generated summaries của workshop PDFs';
COMMENT ON COLUMN workshop_summaries.status IS 'pending: chưa process; processing: đang xử lý; done: hoàn thành; failed: lỗi';
```

**Flow:**
- Admin upload PDF file → tạo record với status='pending'
- Background worker consume từ queue → gọi AI API
- AI API return summary → UPDATE status='done', summary text
- Nếu fail → UPDATE status='failed', error_message
- Frontend có thể poll status tới khi done

#### 8. Student Import Logs Table

```sql
CREATE TABLE student_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(500) NOT NULL,
    file_hash VARCHAR(255),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('success', 'failed', 'partial')),
    rows_processed INT DEFAULT 0,
    rows_inserted INT DEFAULT 0,
    rows_updated INT DEFAULT 0,
    rows_skipped INT DEFAULT 0,
    error_log TEXT,
    error_details JSONB,
    imported_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_imported_at (imported_at)
);

COMMENT ON TABLE student_import_logs IS 'Audit log cho CSV import jobs từ hệ thống cũ';
COMMENT ON COLUMN student_import_logs.file_hash IS 'SHA256 hash của file, để detect duplicate imports';
COMMENT ON COLUMN student_import_logs.status IS 'success: all rows imported; failed: had errors; partial: some rows imported';
```

**Flow:**
- Nightly cron job (2 AM) download CSV từ hệ thống cũ
- Parse + validate → tính file_hash
- Check: có bao giờ import file này chưa? (select where file_hash = X)
- Nếu đã import → skip
- Nếu chưa → BEGIN TRANSACTION
  - Dedup rows (keep latest)
  - INSERT/UPDATE users
  - COMMIT TRANSACTION
- Record log kết quả

#### 9. Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    changes JSONB,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_actor_id (actor_id),
    INDEX idx_resource_type (resource_type),
    INDEX idx_created_at (created_at)
);

COMMENT ON TABLE audit_logs IS 'Theo dõi mọi thay đổi quan trọng: admin tạo workshop, xóa workshop, thay đổi capacity, v.v.';
COMMENT ON COLUMN audit_logs.action IS 'CREATE_WORKSHOP, UPDATE_WORKSHOP, DELETE_WORKSHOP, CANCEL_REGISTRATION, v.v.';
COMMENT ON COLUMN audit_logs.old_values IS 'JSON giá trị cũ trước khi update (null nếu create)';
COMMENT ON COLUMN audit_logs.new_values IS 'JSON giá trị mới sau khi update (null nếu delete)';
```

### Data Relationships

```
users (1) ─────────────────── (N) registrations
         │
         ├─────────────────── (N) notifications
         │
         ├─────────────────── (N) audit_logs
         │
         └─────────────────── (1) workshops (created_by)

workshops (1) ───────────────── (N) registrations
           │
           └─────────────────── (1) workshop_summaries

registrations (1) ───────────── (1) payments
             │
             └─────────────────── (1) checkins
```

### Chiến lược Indexing

```sql
-- Primary keys: tự động có index (PostgreSQL)

-- Foreign keys: tự động có index (for JOIN performance)

-- Unique constraints: tự động có index
-- - users.student_id, users.email
-- - registrations.qr_code
-- - registrations(user_id, workshop_id)
-- - payments.idempotency_key
-- - workshop_summaries.workshop_id

-- Thêm indexes cho hot path queries:

-- Workshop queries: find upcoming workshops
CREATE INDEX CONCURRENTLY idx_workshops_upcoming 
ON workshops(start_time) 
WHERE status = 'active' AND start_time > NOW();

-- Registration queries: find user's registrations
CREATE INDEX CONCURRENTLY idx_registrations_user 
ON registrations(user_id, status) 
WHERE status != 'cancelled';

-- Payment queries: find pending payments
CREATE INDEX CONCURRENTLY idx_payments_pending 
ON payments(user_id, status) 
WHERE status IN ('pending', 'processing');

-- Check-in queries: find workshop check-ins
CREATE INDEX CONCURRENTLY idx_checkins_workshop 
ON checkins(workshop_id, checkin_time);

-- Notification queries: find unsent notifications
CREATE INDEX CONCURRENTLY idx_notifications_undelivered 
ON notifications(user_id, created_at) 
WHERE status != 'sent';

-- CSV import queries
CREATE INDEX CONCURRENTLY idx_import_logs_recent
ON student_import_logs(imported_at DESC);

-- Audit logs for tracking admin actions
CREATE INDEX CONCURRENTLY idx_audit_logs_admin
ON audit_logs(actor_id, created_at DESC)
WHERE action LIKE 'DELETE_%' OR action LIKE 'UPDATE_%';
```

### Redis Key Schema

```
COUNTERS (Atomic Operations):
├─ workshop:{workshopId}:seats_available : INT
│  │ Purpose: số chỗ còn lại
│  │ Operation: DECR (atomic), SET (reset)
│  │ TTL: None (clear khi workshop end)
│  │ Usage: xử lý race condition khi nhiều user register
│  │
│  └─ Example: workshop:550e8400-e29b-41d4-a716-446655440000:seats_available = 50
│
└─ workshop:{workshopId}:registered_count : INT
   │ Purpose: số user đã register thành công
   │ Operation: INCR
   │ TTL: None
   │ Usage: track số lượng registration

DISTRIBUTED LOCKS:
├─ lock:workshop:{workshopId}:register : STRING
│  │ Purpose: prevent race condition khi giảm seats counter
│  │ Value: "locked" (placeholder)
│  │ Operation: SET key value EX 10 NX (set if not exist)
│  │ TTL: 10s (deadlock prevention)
│  │ Usage: atomic {DECR seats, INSERT registration}
│  │
│  └─ Example: SET lock:550e8400:register locked EX 10 NX
│
└─ lock:csv_import : STRING
   │ Purpose: prevent multiple CSV import jobs
   │ Value: timestamp (lock acquired at)
   │ Operation: SET key value EX 300 NX
   │ TTL: 300s (5 min - CSV import timeout)
   │ Usage: nightly CSV sync

RATE LIMITING (Token Bucket):
├─ ratelimit:ip:{ipAddress}:tokens : FLOAT
│  │ Purpose: limit requests per IP
│  │ Value: current token count
│  │ Operation: DECR, INCR, SETEX
│  │ TTL: 60s
│  │ Max tokens: 100 per minute per IP
│  │ Usage: prevent DDoS-like surge
│  │
│  └─ Example: ratelimit:ip:192.168.1.1:tokens = 85.5
│
└─ ratelimit:user:{userId}:tokens : FLOAT
   │ Purpose: limit requests per user (stricter)
   │ Value: current token count
   │ Operation: DECR, INCR, SETEX
   │ TTL: 60s
   │ Max tokens: 50 per minute per user
   │ Usage: authenticated user rate limit

IDEMPOTENCY CACHE:
└─ idempotent:payment:{userId}:{workshopId}:{uuid} : HASH
   │ Purpose: cache payment result to prevent double-charge
   │ Value: {status, transaction_id, result}
   │ Operation: GET, SET, EXPIRE
   │ TTL: 86400s (24 hours - match payment retention)
   │ Usage: if user retry request → return cached result
   │
   └─ Example:
      idempotent:payment:user-123:ws-456:abc-def-789 = 
      {
        "status": "success",
        "transaction_id": "txn-12345",
        "timestamp": 1620000000
      }

SESSION & CACHE:
├─ session:{sessionId} : HASH
│  │ Purpose: store session data
│  │ Fields: user_id, login_time, last_activity, ip, user_agent
│  │ TTL: 3600s (1 hour - sliding window)
│  │ Usage: track active sessions
│  │
│  └─ Example: session:abc123 = {user_id: user-456, login_time: 1620000000}
│
└─ workshop:{workshopId}:cached : JSON
   │ Purpose: cache workshop details
   │ Value: cached workshop object
   │ TTL: 300s (5 minutes)
   │ Usage: reduce DB hits on workshop list/detail
   │
   └─ Example: workshop:550e8400:cached = {title, description, capacity, ...}
```

---
