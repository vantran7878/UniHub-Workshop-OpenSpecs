## 1. Hạ tầng và Thư viện

- [x] 1.1 Cài đặt thư viện `opossum` vào dự án.
- [x] 1.2 Tạo lớp `PaymentCircuitBreaker` để cấu hình các tham số (threshold, timeout, resetTimeout).

## 2. Triển khai Logic Circuit Breaker

- [x] 2.1 Bọc các hàm gọi cổng thanh toán (ví dụ: `createStripeSession`) vào Circuit Breaker.
- [x] 2.2 Triển khai hàm `fallback` để xử lý khi mạch mở (trả về trạng thái thanh toán tạm hoãn).
- [x] 2.3 Thêm logging để theo dõi sự kiện thay đổi trạng thái mạch (on open, on close).

## 3. Cập nhật UI và Luồng Fallback

- [x] 3.1 Cập nhật `RegistrationsService` để hỗ trợ trạng thái `deferred_payment`.
- [x] 3.2 Cập nhật giao diện người dùng để hiển thị thông báo "Hệ thống thanh toán đang bảo trì" khi mạch hở.
- [x] 3.3 Thiết lập cơ chế nhắc nhở thanh toán (email notification) cho các đơn hàng deferred.

## 4. Kiểm thử

- [x] 4.1 Unit Test giả lập lỗi cổng thanh toán để kiểm tra mạch có mở đúng threshold không.
- [x] 4.2 Integration Test kiểm tra luồng đăng ký vẫn thành công (với trạng thái deferred) khi cổng thanh toán lỗi.
- [x] 4.3 Kiểm tra khả năng tự động đóng mạch (reset) sau thời gian resetTimeout.
