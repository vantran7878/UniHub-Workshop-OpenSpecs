## Why

Hệ thống thanh toán thường là dịch vụ bên thứ ba (ví dụ: Stripe, MoMo, VNPay) hoặc một module có độ trễ cao. Nếu module này gặp sự cố hoặc timeout kéo dài, nó có thể làm nghẽn toàn bộ luồng xử lý chính, dẫn đến việc người dùng không thể xem danh sách workshop hoặc chi tiết workshop mặc dù các tính năng này không trực tiếp phụ thuộc vào việc thanh toán thành công ngay lập tức.

Việc áp dụng Circuit Breaker giúp hệ thống "ngắt mạch" nhanh chóng khi dịch vụ thanh toán lỗi, cho phép hệ thống fallback về chế độ "chỉ xem" hoặc "đăng ký trước - thanh toán sau", đảm bảo tính sẵn sàng (High Availability).

## What Changes

- Triển khai pattern Circuit Breaker cho các API/Service liên quan đến thanh toán.
- Thiết kế luồng fallback: Khi mạch hở (Open state), người dùng vẫn có thể xem lịch trình và đăng ký workshop dưới dạng "Chờ thanh toán" (Pending Payment) thay vì báo lỗi hệ thống.
- Tích hợp giám sát trạng thái mạch (Closed, Open, Half-Open).

## Capabilities

### New Capabilities
- `payment-circuit-breaker`: Quản lý trạng thái kết nối với cổng thanh toán, tự động ngắt khi tỷ lệ lỗi vượt ngưỡng và kích hoạt luồng fallback.

### Modified Capabilities
- `payments`: Cập nhật yêu cầu về xử lý lỗi và tính sẵn sàng khi cổng thanh toán ngoại vi không phản hồi.
- `workshop-management`: Đảm bảo thông tin workshop vẫn hiển thị được ngay cả khi module tính phí gặp sự cố.

## Impact

- **API**: Các endpoint thanh toán sẽ có phản hồi nhanh hơn khi hệ thống đang lỗi (fail-fast).
- **Frontend**: Hiển thị thông báo bảo trì thanh toán nhưng vẫn cho phép duyệt workshop.
- **Dependencies**: Thêm thư viện `opossum` hoặc tự triển khai logic circuit breaker.
