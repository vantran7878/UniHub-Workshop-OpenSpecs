## ADDED Requirements

### Requirement: Email Task Offloading
Khi một hành động yêu cầu gửi email (đăng ký, hủy), hệ thống SHALL đẩy một message vào queue `email_queue` thay vì gửi SMTP trực tiếp.

#### Scenario: Workshop Registration Email
- **WHEN** Sinh viên đăng ký workshop thành công.
- **THEN** Hệ thống SHALL đẩy message chứa `{email, name, workshop_id, type: 'registration'}` vào RabbitMQ.

### Requirement: Reliable Email Delivery with Retries
Nếu việc gửi email thất bại do lỗi mạng hoặc SMTP server, worker SHALL thực hiện retry tối đa 3 lần trước khi đưa vào Dead Letter Queue.

#### Scenario: SMTP server timeout
- **WHEN** Worker không thể kết nối tới SMTP server.
- **THEN** Nó SHALL giữ message trong queue và thực hiện retry sau một khoảng thời gian (Exponential Backoff).
