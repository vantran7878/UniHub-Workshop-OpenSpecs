## 3. High-Level Architecture Diagram
### 3.1 Tổng quan kiến trúc 4-layer
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
│  │                              │   │ - Login/Register         │ │
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

### 3.2 Mô tả từng layer
#### 3.2.1 Client Layer

**Web App (React/Next.js)**
- Sinh viên: xem danh sách workshop, đăng ký, xem QR code
- Ban tổ chức: tạo workshop, sửa room/time, xem thống kê, xem danh sách đăng ký

**Mobile App (Flutter)**
- Nhân sự: quét QR code để check-in
- Hỗ trợ offline mode: SQLite local database lưu registration list
- Khi mất mạng: check-in được ghi nhận local
- Khi có mạng: tự động sync với server

#### 3.2.2 API Gateway

Chịu trách nhiệm:
- **JWT Authentication**: Verify token, extract user info
- **Rate Limiting**: Dùng Token Bucket để chống burst (120,000 user)
- **Request/Response Logging**: Audit trail, debugging
- **Load Balancing**: Phân phối traffic tới backend instances

#### 3.2.3 Backend API (Service-based)

**Auth Service**
- Login/Register với JWT token
- Token refresh
- Đồng bộ user từ CSV hàng đêm

**Workshop Service**
- GET /workshops (danh sách workshop)
- GET /workshops/{id} (chi tiết workshop)
- GET /workshops/{id}/participants (lấy số lượng sinh viên đăng ký - admin)
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

#### 3.2.4 Message Broker Layer

**RabbitMQ** - xử lý asynchronous tasks

**Queues:**
- `payment.process` - registration service publish → payment service consume
- `payment.callback` - payment gateway webhook → payment service consume
- `notification.queue` - event sources → notification service consume
- `checkin.sync` - mobile app → check-in service consume
- `csv.import` - scheduled task → auth service consume
- `ai_summary.generate` - workshop service → AI service consume

#### 3.2.5 Data Persistence Layer

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