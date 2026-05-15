## Context

Hệ thống hiện tại sử dụng Next.js làm frontend và serverless backend (Supabase). Để hỗ trợ các tác vụ nền, chúng ta cần một cơ chế tin cậy để truyền tin giữa ứng dụng web và các background workers chuyên biệt. RabbitMQ sẽ đóng vai trò trung tâm để điều phối các message này.

## Goals / Non-Goals

**Goals:**
- Đảm bảo các message gửi email và tóm tắt AI không bị mất mát (Durability).
- Cho phép xử lý song song các tác vụ nặng mà không ảnh hưởng đến UI.
- Triển khai cơ chế Retry cho các task thất bại (ví dụ: SMTP server bị lỗi tạm thời).

**Non-Goals:**
- Không triển khai hệ thống thông báo thời gian thực (WebSockets) trong phạm vi task này (chỉ tập trung vào background jobs).
- Không triển khai phức tạp như Event Sourcing.

## Decisions

- **Protocol**: Sử dụng **AMQP 0-9-1** với thư viện `amqplib`.
- **Exchange Type**: Sử dụng **Direct Exchange** để định tuyến chính xác các loại job (email, ai_summary).
- **Durability**: Cả Queues và Messages đều được thiết lập `durable: true` và `persistent: true` để đảm bảo an toàn dữ liệu khi RabbitMQ bị restart.
- **Worker Pattern**: Triển khai các worker dưới dạng các Node.js process độc lập (có thể chạy trong Docker container riêng).
- **Error Handling**: Sử dụng **Dead Letter Exchange (DLX)** để lưu trữ các message bị lỗi sau tối đa 3 lần retry thất bại để admin có thể kiểm tra thủ công.

## Risks / Trade-offs

- **Phức tạp hạ tầng**: RabbitMQ thêm một điểm cần quản lý trong hệ thống.
- **Tính nhất quán**: Hệ thống trở nên "Eventually Consistent" (ví dụ: đăng ký xong nhưng 2-3 giây sau mới nhận được email).
- **Tài nguyên**: Các AI worker có thể tiêu tốn nhiều CPU/RAM khi xử lý PDF lớn.
