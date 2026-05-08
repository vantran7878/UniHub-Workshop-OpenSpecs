## 1. Database and Infrastructure

- [x] 1.1 Create migration for `notification_logs` table (columns: `id`, `event_id`, `user_id`, `channel`, `status`, `retry_count`, `error_details`, `sent_at`)
- [x] 1.2 Add `fcm_token` column to the `users` table
- [x] 1.3 Configure RabbitMQ exchange and queues for `notification.queue` and `notification.retry` (DLX setup)

## 2. Notification Worker Core

- [x] 2.1 Implement the `NotificationWorker` class to consume from RabbitMQ and orchestrate channel dispatching
- [x] 2.2 Implement the centralized `EVENT_CHANNEL_MAP` and channel resolution logic
- [x] 2.3 Implement the RabbitMQ-based retry logic with DLX and TTL (60s delay)

## 3. Channel Adapters

- [x] 3.1 Implement `EmailAdapter` using `nodemailer` and `handlebars` templating
- [x] 3.2 Create Handlebars templates for core events (Registration Confirmed, Workshop Updated/Cancelled)
- [x] 3.3 Implement `PushAdapter` using `firebase-admin` for FCM dispatching

## 4. API and Token Management

- [x] 4.1 Implement `POST /api/users/me/fcm-token` and `DELETE /api/users/me/fcm-token` endpoints
- [x] 4.2 Implement automated `fcm_token` cleanup in `PushAdapter` upon receiving 'not registered' error
- [x] 4.3 Verify end-to-end flow: publish event from business module and confirm log entry creation
