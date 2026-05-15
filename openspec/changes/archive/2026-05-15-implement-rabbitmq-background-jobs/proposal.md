## Why

Hiện tại, các tác vụ nặng như gửi email xác nhận (với mã QR) và tóm tắt nội dung workshop bằng AI đang được xử lý đồng bộ hoặc xử lý ngay trong luồng request của Next.js. Điều này dẫn đến:
- Tăng latency cho người dùng.
- Rủi ro mất mát dữ liệu nếu process bị crash giữa chừng.
- Khó khăn trong việc mở rộng (scaling) các worker xử lý riêng biệt.
Việc tích hợp RabbitMQ sẽ giúp tách rời (decouple) luồng nghiệp vụ chính và các tác vụ hậu cần, tăng tính ổn định và hiệu năng cho hệ thống UniHub.

## What Changes

- Triển khai **RabbitMQ** làm message broker (đã có container trong docker-compose).
- Xây dựng hệ thống **Background Workers** để tiêu thụ (consume) các message từ hàng đợi.
- Tích hợp producer logic vào các luồng:
    - Gửi email xác nhận đăng ký workshop.
    - Gửi email thông báo hủy workshop.
    - Xử lý tóm tắt tài liệu PDF workshop bằng AI (LLM).

## Capabilities

### New Capabilities
- `async-worker-infrastructure`: Hạ tầng kết nối và quản lý vòng đời của các background worker.
- `email-background-processing`: Xử lý gửi email bất đồng bộ qua hàng đợi.
- `ai-workshop-summarization`: Tác vụ xử lý AI tóm tắt tài liệu workshop chạy ngầm.

### Modified Capabilities
- `booking`: Cập nhật luồng đăng ký để đẩy sự kiện gửi email vào hàng đợi thay vì gửi trực tiếp.
- `workshop-management`: Cập nhật luồng upload tài liệu để kích hoạt tác vụ tóm tắt AI bất đồng bộ.

## Impact

- **Infrastructure**: RabbitMQ service (AMQP 0-9-1).
- **Backend/Workers**: Thêm các process worker chạy độc lập.
- **Dependencies**: Thêm thư viện `amqplib` cho Node.js.
