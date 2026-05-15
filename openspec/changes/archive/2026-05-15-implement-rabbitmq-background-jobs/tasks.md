## 1. Hạ tầng RabbitMQ

- [x] 1.1 Kiểm tra trạng thái RabbitMQ trong `docker-compose.yml` (đảm bảo port 5672 và 15672 đã mở).
- [x] 1.2 Cài đặt thư viện `amqplib` vào dự án.
- [x] 1.3 Triển khai `RabbitMQProvider` Singleton để quản lý connection và channel.

## 2. Background Workers

- [x] 2.1 Tạo khung (base) cho Worker process với khả năng auto-reconnect và graceful shutdown.
- [x] 2.2 Triển khai `EmailWorker` tiêu thụ message từ queue `email_queue`.
- [x] 2.3 Triển khai `AIWorker` tiêu thụ message từ queue `ai_summary_queue` (tích hợp Gemini API hoặc OpenAI API).
- [x] 2.4 Triển khai `batchWorker` tiêu thụ message từ queue `batch_queue` (csv import).

## 3. Tích hợp Producer

- [x] 3.1 Cập nhật `registerForWorkshop` để đẩy job gửi email vào RabbitMQ.
- [x] 3.2 Cập nhật luồng upload file PDF để đẩy job tóm tắt AI vào RabbitMQ.
- [x] 3.3 Cấu hình Dead Letter Queue (DLQ) cho các job thất bại.

## 4. Kiểm thử và Xác nhận

- [ ] 4.1 Unit Test kiểm tra khả năng push/pop message từ RabbitMQ.
- [ ] 4.2 Integration Test kiểm tra toàn bộ luồng từ khi đăng ký đến khi nhận được email (giả lập SMTP bằng MailHog).
- [ ] 4.3 Kiểm tra khả năng chịu tải: Đẩy 1000 email job cùng lúc và theo dõi tốc độ xử lý của worker.
