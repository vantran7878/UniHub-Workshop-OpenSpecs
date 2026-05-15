## ADDED Requirements

### Requirement: Durable Message Queuing
Mọi queue quan trọng (email, ai_summary) SHALL được cấu hình `durable: true` để dữ liệu không bị mất khi RabbitMQ khởi động lại.

#### Scenario: RabbitMQ Service Restart
- **WHEN** RabbitMQ bị restart trong khi có 100 message đang chờ xử lý.
- **THEN** Sau khi khởi động lại, các message này MUST vẫn tồn tại trong hàng đợi.

### Requirement: Graceful Worker Shutdown
Các worker process SHALL hỗ trợ tín hiệu shutdown để hoàn thành công việc đang dang dở trước khi dừng hẳn.

#### Scenario: Worker process termination
- **WHEN** Worker nhận tín hiệu SIGTERM.
- **THEN** Nó SHALL dừng nhận message mới nhưng MUST hoàn thành xử lý message hiện tại trước khi thoát.
