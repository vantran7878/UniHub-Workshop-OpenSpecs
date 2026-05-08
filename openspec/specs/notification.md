# Đặc tả: Notification Module

## Mô tả

Module xử lý việc gửi thông báo đến sinh viên sau các sự kiện nghiệp vụ
quan trọng: đăng ký thành công, thanh toán, hủy workshop, check-in.

Notification Module hoạt động hoàn toàn **bất đồng bộ** — các module nghiệp
vụ (Registration, Workshop, Check-in) publish event vào **RabbitMQ**, một
Notification Worker độc lập consume và dispatch qua từng kênh.

Thiết kế theo **Adapter pattern**: thêm kênh thông báo mới (Telegram, SMS)
chỉ cần thêm một Adapter class, không sửa bất kỳ module nghiệp vụ nào.

Hai kênh hiện tại:
- **App (Push Notification)** — Firebase FCM, dành cho cả Web và Mobile App.
- **Email** — SMTP server hoặc provider (SendGrid, AWS SES).

Kênh Telegram được thiết kế sẵn sàng nhưng chưa triển khai ở phiên bản này.

---

## Kiến trúc tổng quan

```
Business Modules                RabbitMQ               Notification Worker
────────────────               ──────────              ───────────────────
Registration Module ─ publish ─►                       ◄─ consume ─┐
Workshop Module     ─ publish ─► notification.queue               │
Check-in Module     ─ publish ─►                                   │
                                                                   ├─► EmailAdapter
                                                                   │     └─► SMTP / SendGrid
                                                                   │
                                                                   ├─► PushAdapter
                                                                   │     └─► Firebase FCM
                                                                   │
                                                                   └─► [TelegramAdapter]
                                                                         (chưa triển khai)
                                                    ↓
                                          notification_logs (PostgreSQL)
```

**Nguyên tắc cốt lõi:**
- Publish event xảy ra **sau khi COMMIT transaction DB**, không bên trong transaction — tránh event fire nhưng transaction rollback.
- Nếu publish RabbitMQ thất bại, module nghiệp vụ vẫn trả response thành công cho client. Notification là best-effort, không block luồng chính.
- Worker xử lý **at-least-once** — có thể gửi trùng khi Worker restart, không chấp nhận mất notification.

---

## Event Types được hỗ trợ

| Event Type                    | Trigger                                        | Kênh             |
|-------------------------------|------------------------------------------------|------------------|
| `REGISTRATION_CONFIRMED_FREE` | Đăng ký workshop miễn phí thành công          | Email + Push     |
| `REGISTRATION_CONFIRMED_PAID` | Thanh toán workshop có phí thành công         | Email + Push     |
| `REGISTRATION_CANCELLED`      | Sinh viên tự hủy hoặc admin hủy registration  | Email + Push     |
| `WORKSHOP_UPDATED`            | Admin đổi giờ hoặc đổi phòng                  | Email + Push     |
| `WORKSHOP_CANCELLED`          | Admin hủy toàn bộ workshop                    | Email + Push     |
| `CHECKIN_CONFIRMED`           | Check-in tại sự kiện thành công               | Push only        |
| `PAYMENT_FAILED`              | Thanh toán thất bại (gateway lỗi / timeout)   | Push only        |

---

## Cấu trúc Event Message (RabbitMQ payload)

Mọi message publish vào `notification.queue` đều tuân theo cấu trúc:

```json
{
  "eventId":        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "eventType":      "REGISTRATION_CONFIRMED_FREE",
  "userId":         "550e8400-e29b-41d4-a716-446655440000",
  "workshopId":     "b3a1c2d4-e5f6-7890-abcd-ef1234567890",
  "registrationId": "a1b2c3d4-e5f6-7890-1234-abcdef567890",
  "payload": {
    "workshopTitle":  "Workshop: Clean Architecture",
    "workshopDate":   "2024-11-16T09:00:00+07:00",
    "workshopRoom":   "A.101",
    "speakerName":    "Nguyen Van B",
    "qrCode":         "f47ac10b-...",
    "price":          null
  },
  "publishedAt": "2024-11-15T08:00:00.000Z"
}cấu trúc mô tả
```

**Quy tắc publish từ business module:**

```javascript
// Trong Registration Module — publish SAU COMMIT transaction
async function confirmRegistration(registrationId) {
  // BEGIN TRANSACTION
  //   INSERT registrations ...
  //   UPDATE workshops SET ...
  // COMMIT  <-- publish sau dòng này

  await rabbitMQ.publish('notification.queue', {
    eventId:        uuidv4(),
    eventType:      'REGISTRATION_CONFIRMED_FREE',
    userId:         registration.user_id,
    workshopId:     registration.workshop_id,
    registrationId: registration.id,
    payload: {
      workshopTitle: workshop.title,
      workshopDate:  workshop.starts_at,
      workshopRoom:  workshop.room,
      qrCode:        registration.qr_code
    },
    publishedAt: new Date().toISOString()
  });
  // Nếu publish thất bại: log error, KHÔNG throw, trả response thành công
}
```

---

## Luồng chính

### Luồng 1 — Notification Worker xử lý message

Worker chạy như một **process riêng biệt** trong cùng backend application,
consume từ `notification.queue` của RabbitMQ.

```
RabbitMQ                  Notification Worker              PostgreSQL        External APIs
    │                            │                              │                  │
    │  Deliver message           │                              │                  │
    ├───────────────────────────►│                              │                  │
    │                            │                              │                  │
    │                            │ [1] Parse JSON payload       │                  │
    │                            │     Validate eventType       │                  │
    │                            │                              │                  │
    │                            │ [2] SELECT                   │                  │
    │                            │   email, full_name,          │                  │
    │                            │   fcm_token                  │                  │
    │                            │ FROM users                   │                  │
    │                            │ WHERE id = event.userId      │                  │
    │                            ├─────────────────────────────►│                  │
    │                            │◄─────────────────────────────┤                  │
    │                            │                              │                  │
    │                            │ [3] Resolve channels         │                  │
    │                            │     cho eventType            │                  │
    │                            │     via EVENT_CHANNEL_MAP    │                  │
    │                            │                              │                  │
    │                            │ [4] Promise.allSettled([     │                  │
    │                            │   EmailAdapter.send(...),    │                  │
    │                            │   PushAdapter.send(...)      │                  │
    │                            │ ])                           │                  │
    │                            ├──────────────────────────────┼─────────────────►│
    │                            │◄─────────────────────────────┼──────────────────┤
    │                            │                              │                  │
    │                            │ [5] INSERT notification_logs │                  │
    │                            │     cho từng channel         │                  │
    │                            │     (status: sent / failed)  │                  │
    │                            ├─────────────────────────────►│                  │
    │                            │◄─────────────────────────────┤                  │
    │                            │                              │                  │
    │                            │ [6] channel.ack(msg)         │                  │
    │◄───────────────────────────┤                              │                  │
```

> `Promise.allSettled` đảm bảo: nếu EmailAdapter thất bại, PushAdapter
> vẫn chạy và ngược lại. Mỗi channel được log độc lập. Worker không bị
> block bởi sự thất bại của một kênh đơn lẻ.

**ACK policy:**
- ACK message **sau khi đã ghi notification_logs** — dù thành công hay thất bại.
- Nếu Worker crash trước khi ACK: RabbitMQ redeliver message, Worker xử lý lại — gửi trùng là acceptable (at-least-once), không mất notification.

---

### Luồng 2 — EmailAdapter

```javascript
// Template engine: Handlebars (.hbs files)
// Email provider: Nodemailer + SMTP (dev) / SendGrid (prod)

class EmailAdapter {
  async send(user, eventType, payload) {
    if (!user.email) {
      return { status: 'skipped', reason: 'NO_EMAIL' };
    }

    const template = await this.loadTemplate(eventType);
    // Path: src/notifications/templates/email/{eventType}.hbs

    const html    = template({ userName: user.full_name, ...payload });
    const subject = this.resolveSubject(eventType, payload);

    await this.transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      user.email,
      subject: subject,
      html:    html
    });

    return { status: 'sent' };
  }
}
```

**Danh sách template files cần có:**

| File                              | Event Type                      | Subject                                     |
|-----------------------------------|---------------------------------|---------------------------------------------|
| `REGISTRATION_CONFIRMED_FREE.hbs` | `REGISTRATION_CONFIRMED_FREE`   | Dang ky thanh cong: {workshopTitle}         |
| `REGISTRATION_CONFIRMED_PAID.hbs` | `REGISTRATION_CONFIRMED_PAID`   | Dang ky & thanh toan thanh cong: {title}    |
| `REGISTRATION_CANCELLED.hbs`      | `REGISTRATION_CANCELLED`        | Thong bao huy dang ky: {workshopTitle}      |
| `WORKSHOP_UPDATED.hbs`            | `WORKSHOP_UPDATED`              | Thong tin workshop da thay doi: {title}     |
| `WORKSHOP_CANCELLED.hbs`          | `WORKSHOP_CANCELLED`            | Workshop da bi huy: {workshopTitle}         |

Nội dung email `REGISTRATION_CONFIRMED_FREE` tối thiểu phải có:
- Tên sinh viên (`user.full_name`)
- Tên workshop, ngày giờ, phòng, tên diễn giả
- Mã QR code (UUID) để sinh viên tra cứu thủ công
- Link xem chi tiết: `{BASE_URL}/workshops/{workshopId}`
- Footer với thông tin liên hệ ban tổ chức

---

### Luồng 3 — PushAdapter (Firebase FCM)

```javascript
class PushAdapter {
  async send(user, eventType, payload) {
    if (!user.fcm_token) {
      return { status: 'skipped', reason: 'NO_FCM_TOKEN' };
    }

    const message = {
      token: user.fcm_token,
      notification: {
        title: this.resolveTitle(eventType, payload),
        body:  this.resolveBody(eventType, payload)
      },
      data: {
        eventType:      eventType,
        workshopId:     payload.workshopId     ?? '',
        registrationId: payload.registrationId ?? ''
      },
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default' } } }
    };

    await admin.messaging().send(message);
    return { status: 'sent' };
  }
}
```

**Push message content theo event type:**

| Event Type                    | Title                       | Body                                         |
|-------------------------------|-----------------------------|----------------------------------------------|
| `REGISTRATION_CONFIRMED_FREE` | "Dang ky thanh cong"        | "Ban da dang ky {title}. Xem ma QR."        |
| `REGISTRATION_CONFIRMED_PAID` | "Thanh toan thanh cong"     | "Dang ky {title} da duoc xac nhan."         |
| `REGISTRATION_CANCELLED`      | "Dang ky da bi huy"         | "Dang ky workshop {title} da bi huy."       |
| `WORKSHOP_UPDATED`            | "Workshop co thay doi"      | "{title} da doi gio/phong. Kiem tra ngay."  |
| `WORKSHOP_CANCELLED`          | "Workshop bi huy"           | "Workshop {title} da bi huy boi BTC."       |
| `CHECKIN_CONFIRMED`           | "Check-in thanh cong"       | "Chao mung ban den {title}!"                |
| `PAYMENT_FAILED`              | "Thanh toan that bai"       | "Thanh toan cho {title} chua thanh cong."   |

---

### Luồng 4 — FCM Token Lifecycle

FCM token phải được cập nhật thường xuyên — Firebase có thể rotate token
bất kỳ lúc nào.

```
[Khi đăng nhập thành công - Mobile App]
  Firebase.getToken() → fcmToken string
  POST /api/users/me/fcm-token { token: "..." }
    └─ UPDATE users SET fcm_token = $1 WHERE id = $2

[Khi đăng xuất - Mobile App]
  DELETE /api/users/me/fcm-token
    └─ UPDATE users SET fcm_token = NULL WHERE id = $1

[Khi Firebase rotate token - onTokenRefresh callback]
  POST /api/users/me/fcm-token { token: newToken }
    └─ UPDATE users SET fcm_token = $1 (ghi đè token cũ)

[Khi PushAdapter nhận lỗi messaging/registration-token-not-registered]
  UPDATE users SET fcm_token = NULL WHERE id = user.id
  (tự dọn stale token, không cần user action)
  KHÔNG đưa vào retry queue.
```

---

### Luồng 5 — Retry khi gửi thất bại

Worker không retry ngay tại chỗ để tránh block queue. Dùng **Dead Letter Exchange (DLX)** của RabbitMQ:

```
Gửi thất bại (EmailAdapter hoặc PushAdapter throw exception):
  │
  ├─ Ghi notification_logs: status = 'failed', retry_count hiện tại
  ├─ ACK message gốc
  └─ Publish vào notification.retry queue:
     {
       ...originalEvent,
       retryCount: (event.retryCount ?? 0) + 1,
       failedAt:   new Date().toISOString(),
       failReason: error.message
     }

notification.retry queue cấu hình RabbitMQ:
  x-message-ttl:              60000  (delay 60s trước khi deliver lại)
  x-dead-letter-exchange:     ""
  x-dead-letter-routing-key:  "notification.queue"
  (Sau 60s, message chuyển về notification.queue để xử lý lại)

Worker kiểm tra retryCount khi nhận message:
  retryCount >= 3:
    → UPDATE notification_logs: status='failed', retry_count=3
    → KHÔNG publish retry nữa
    → Log error level để monitoring alert
  retryCount < 3:
    → Xử lý bình thường như Luồng 1
    → Nếu fail tiếp → publish retry lần nữa
```

Delay cố định 60 giây cho tất cả các lần retry — đủ đơn giản cho
quy mô đồ án, không cần exponential backoff phức tạp.

---

### Luồng 6 — Hủy workshop, notify toàn bộ người đăng ký

Khi admin hủy workshop, Workshop Module publish event riêng cho từng
sinh viên đã đăng ký confirmed:

```javascript
// Trong Workshop Module, sau COMMIT transaction cancel
async function cancelWorkshop(workshopId) {
  // BEGIN TRANSACTION
  //   UPDATE workshops SET status = 'cancelled' ...
  //   UPDATE registrations SET status = 'cancelled'
  //   WHERE workshop_id = $1 AND status = 'confirmed'
  // COMMIT

  const affected = await db.query(`
    SELECT user_id FROM registrations
    WHERE workshop_id = $1 AND status = 'cancelled'
  `, [workshopId]);

  // Publish một event riêng cho từng sinh viên
  // Worker chỉ xử lý per-user, không xử lý broadcast event
  for (const row of affected.rows) {
    await rabbitMQ.publish('notification.queue', {
      eventId:    uuidv4(),
      eventType:  'WORKSHOP_CANCELLED',
      userId:     row.user_id,
      workshopId: workshopId,
      payload: {
        workshopTitle: workshop.title,
        workshopDate:  workshop.starts_at,
        workshopRoom:  workshop.room
      },
      publishedAt: new Date().toISOString()
    });
  }
}
```

> Workshop 200 người confirmed → 200 messages vào queue. Worker prefetch=10,
> ước tính 200 notifications mất khoảng 2-5 phút tùy tốc độ SMTP.

---

### Luồng 7 — Mở rộng thêm Telegram Adapter

Thiết kế cho phép thêm Telegram mà không sửa bất kỳ business module nào:

```javascript
// Bước 1: Tạo file src/notifications/adapters/TelegramAdapter.js
class TelegramAdapter {
  async send(user, eventType, payload) {
    if (!user.telegram_chat_id) return { status: 'skipped', reason: 'NO_TELEGRAM' };
    const text = this.resolveMessage(eventType, payload);
    await telegramBot.sendMessage(user.telegram_chat_id, text);
    return { status: 'sent' };
  }
}

// Bước 2: Thêm vào array adapters trong Worker
const adapters = [
  new EmailAdapter(),
  new PushAdapter(),
  new TelegramAdapter()   // them dong nay
];

// Bước 3: DB migration
// ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(50);

// Bước 4: Thêm endpoint liên kết Telegram
// POST /api/users/me/telegram { chat_id: "123456789" }
// Không cần sửa gì thêm.
```

**Interface Adapter bắt buộc:**

```typescript
interface NotificationAdapter {
  send(
    user:      Pick<User, 'id' | 'email' | 'full_name' | 'fcm_token'>,
    eventType: EventType,
    payload:   EventPayload
  ): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string }>;
}
```

Worker không biết implementation cụ thể của Adapter — chỉ gọi `adapter.send(...)`.

**Config kênh tập trung (không scattered trong code):**

```javascript
// src/notifications/config/channels.js
const EVENT_CHANNEL_MAP = {
  REGISTRATION_CONFIRMED_FREE: ['email', 'push'],
  REGISTRATION_CONFIRMED_PAID: ['email', 'push'],
  REGISTRATION_CANCELLED:      ['email', 'push'],
  WORKSHOP_UPDATED:            ['email', 'push'],
  WORKSHOP_CANCELLED:          ['email', 'push'],
  CHECKIN_CONFIRMED:           ['push'],
  PAYMENT_FAILED:              ['push'],
};
```

---

## Kịch bản lỗi

### E1 — RabbitMQ không khả dụng khi publish event

- Business module bắt exception từ `rabbitMQ.publish(...)`.
- **Hành vi**: log ERROR, TIẾP TỤC trả response thành công cho client.
- Sinh viên đăng ký thành công nhưng không nhận được thông báo — acceptable tradeoff, không để notification failure làm hỏng luồng nghiệp vụ chính.
- Cần monitoring alert khi RabbitMQ down để ops team biết.

### E2 — Worker crash trước khi ACK

- Message ở trạng thái "unacked" trong RabbitMQ.
- Khi Worker restart, RabbitMQ redeliver tự động.
- Worker xử lý lại → sinh viên có thể nhận 2 email/push.
- Chấp nhận được: gửi trùng 1 lần tốt hơn mất notification.
- `notification_logs` sẽ có 2 records cho cùng eventId — không gây lỗi.

### E3 — SMTP timeout hoặc provider lỗi

- `transporter.sendMail()` throw exception sau timeout 30s.
- EmailAdapter trả `{ status: 'failed', reason: error.message }`.
- Worker ghi log failed, publish vào `notification.retry` queue.
- PushAdapter trong cùng `Promise.allSettled` vẫn chạy bình thường.

### E4 — FCM token không hợp lệ

- Firebase trả error `messaging/registration-token-not-registered`.
- PushAdapter bắt error code này riêng biệt:
  - Ghi log: `status='failed'`, `reason='FCM_TOKEN_INVALID'`.
  - `UPDATE users SET fcm_token = NULL` (tự dọn stale token).
  - **Không** đưa vào retry queue — token đã invalid thì retry vô ích.

### E5 — Template email không tồn tại cho eventType

- EmailAdapter throw `TemplateNotFoundError`.
- Worker ghi log failed, ACK message.
- **Không** retry — lỗi code, không phải lỗi tạm thời.
- Cần unit test coverage cho tất cả eventType trong `EVENT_CHANNEL_MAP`.

### E6 — User không tồn tại trong DB khi Worker xử lý

- Xảy ra khi user bị xóa sau khi event đã publish (edge case hiếm).
- Worker query users → empty → ghi log failed với reason `USER_NOT_FOUND`.
- ACK message, không retry — user không còn thì không cần gửi.

### E7 — Notification queue bị đầy

- Xảy ra khi Worker down lâu rồi nhiều workshop bị cancel đồng thời.
- Cấu hình RabbitMQ: `x-max-length: 100000` — khi đầy, message cũ nhất bị drop vào `notification.overflow` queue để audit.
- Monitor queue depth, alert khi > 10.000 messages.

### E8 — SMTP rate limit khi gửi 300 email liên tiếp (WORKSHOP_CANCELLED)

- Provider trả HTTP 429.
- Xử lý như E3: retry sau 60 giây — phần lớn thành công sau 1-2 lần retry.
- Worker tự nhiên rate-limit vì xử lý tuần tự với prefetch=10.
- Không cần explicit rate limiter trong Worker ở phiên bản này.

### E9 — eventType không có trong EVENT_CHANNEL_MAP

- Xảy ra khi code publish sai hoặc có typo.
- Worker log WARNING: "Unknown eventType: {type}", ACK message, không crash.
- Không gửi gì — silent skip với log.

---

## Ràng buộc

### Hiệu năng

- Worker xử lý tối thiểu **60 notifications/phút** trong điều kiện bình thường.
- `Promise.allSettled([email, push])` phải hoàn thành < 35s (SMTP timeout 30s + buffer 5s).
- Publish RabbitMQ phải **non-blocking** — không `await` blocking trong request handler của business module. Fire-and-forget với error callback.
- Prefetch count của RabbitMQ consumer: **10** messages — tránh một Worker nhận quá nhiều message nhưng xử lý chậm, không fair với consumer khác.

### Bảo mật

- SMTP credentials và SendGrid API key lưu trong environment variables, không commit vào repository.
- Firebase service account JSON lưu trong env dạng base64-encoded (`FIREBASE_SERVICE_ACCOUNT_BASE64`), không phải file plain text.
- FCM token không được log ra stdout hay lưu vào `notification_logs.payload`.
- Email template không render thông tin nhạy cảm: `password_hash`, `student_id` đầy đủ, hay thông tin tài chính chi tiết.

### Tính nhất quán

- **At-least-once delivery**: chấp nhận gửi trùng, không chấp nhận mất.
- Mọi lần gửi (thành công hay thất bại) đều ghi vào `notification_logs`.
- Retry tối đa **3 lần** trước khi mark `status='failed'` vĩnh viễn.
- Worker phải ACK **sau khi** ghi log — không ACK trước khi biết kết quả.

### Khả năng mở rộng

- Mọi Adapter phải implement `NotificationAdapter` interface.
- Worker không hardcode danh sách adapter — đọc từ array `adapters[]` được khởi tạo lúc startup.
- `EVENT_CHANNEL_MAP` là config tập trung duy nhất — không lặp lại logic "kênh nào gửi event nào" ở nhiều nơi trong code.

---

## Tiêu chí chấp nhận

| ID    | Kịch bản                                                                     | Kết quả mong đợi                                                          |
|-------|------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| AC-01 | Đăng ký workshop miễn phí thành công                                        | Sinh viên nhận email + push trong vòng 60 giây                            |
| AC-02 | Thanh toán workshop có phí thành công                                        | Sinh viên nhận email + push kèm thông tin QR code                         |
| AC-03 | Admin hủy workshop có 50 sinh viên confirmed                                | 50 sinh viên nhận email + push trong vòng 10 phút                         |
| AC-04 | Admin đổi phòng workshop                                                     | Tất cả sinh viên đã đăng ký nhận email + push thông báo thay đổi          |
| AC-05 | Check-in thành công tại sự kiện                                              | Sinh viên nhận push (không có email), không lỗi                           |
| AC-06 | SMTP timeout lần 1, thành công lần 2                                         | Email được gửi sau retry; log ghi 1 failed + 1 sent cho cùng eventId      |
| AC-07 | Email thất bại 3 lần liên tiếp                                               | notification_logs: status='failed', retry_count=3, không retry thêm       |
| AC-08 | FCM token hết hạn khi gửi push                                               | fcm_token trong DB set NULL; log ghi FCM_TOKEN_INVALID; không retry        |
| AC-09 | RabbitMQ down, sinh viên đăng ký workshop                                    | Đăng ký vẫn trả 201 thành công; log cảnh báo publish failed               |
| AC-10 | Worker crash giữa chừng, restart lại                                         | Message được redeliver, notification gửi lại (có thể trùng 1 lần)         |
| AC-11 | User không có email (field null)                                              | Email skip với reason NO_EMAIL; push vẫn gửi nếu có fcm_token             |
| AC-12 | User không có fcm_token (chưa đăng nhập app)                                | Push skip với reason NO_FCM_TOKEN; email vẫn gửi bình thường              |
| AC-13 | Thêm TelegramAdapter mà không sửa Registration Module                       | Telegram notification hoạt động; Registration Module không thay đổi       |
| AC-14 | Promise.allSettled: email fail, push success                                 | Push được gửi; email fail được log; Worker ACK message bình thường         |
| AC-15 | Worker nhận message với eventType không có trong EVENT_CHANNEL_MAP          | Log warning, ACK message, không gửi gì, Worker không crash                |
| AC-16 | Cùng message được deliver 2 lần (RabbitMQ redelivery)                       | 2 notification_logs records; sinh viên nhận 2 email — documented behavior |
| AC-17 | Worker xử lý batch 200 WORKSHOP_CANCELLED events                            | Tất cả 200 records xử lý xong, không có message bị drop hay stuck         |
| AC-18 | Kiểm tra notification_logs sau khi gửi thành công                           | Mỗi channel có 1 record với status='sent', sent_at được ghi               |