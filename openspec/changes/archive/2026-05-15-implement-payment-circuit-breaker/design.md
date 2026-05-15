## Context

Hiện tại, module thanh toán của UniHub được gọi trực tiếp trong quá trình đăng ký workshop. Nếu cổng thanh toán phản hồi chậm hoặc bị lỗi, toàn bộ luồng đăng ký sẽ bị treo hoặc báo lỗi 500, khiến người dùng không thể thực hiện các thao tác khác như xem thông tin workshop.

## Goals / Non-Goals

**Goals:**
- Triển khai Circuit Breaker bao quanh các lệnh gọi API thanh toán ngoại vi.
- Tự động chuyển đổi sang trạng thái "Open" khi tỷ lệ lỗi vượt quá 50% trong vòng 10 giây.
- Cung cấp luồng fallback: Trả về trạng thái "Payment System Maintenance" thay vì lỗi timeout.

**Non-Goals:**
- Tự động hoàn tiền (Refund logic) không nằm trong phạm vi này.
- Thay đổi logic tính phí của workshop.

## Decisions

### 1. Thư viện triển khai: Opossum
- **Quyết định**: Sử dụng thư viện `opossum` cho Node.js.
- **Lý do**: Đây là thư viện Circuit Breaker phổ biến nhất cho Node.js, hỗ trợ đầy đủ các trạng thái (Closed, Open, Half-Open), có khả năng tích hợp event emitter để giám sát và hỗ trợ fallback mặc định.
- **Alternative**: Tự viết logic bằng Redis. Tuy nhiên, `opossum` đơn giản hơn cho việc triển khai in-memory worker/API process.

### 2. Chiến lược Fallback: Đăng ký tạm thời
- **Quyết định**: Khi mạch hở, vẫn cho phép người dùng click "Đăng ký", nhưng thay vì chuyển hướng sang cổng thanh toán, hệ thống sẽ lưu trạng thái là `pending_deferred` và gửi thông báo "Hệ thống thanh toán đang bảo trì, chúng tôi sẽ gửi link thanh toán lại cho bạn sau".
- **Lý do**: Giữ chân người dùng ở lại hệ thống thay vì đuổi họ đi bằng một trang lỗi.

## Risks / Trade-offs

- **[Risk]** Người dùng đăng ký nhưng không bao giờ quay lại thanh toán sau khi hệ thống hồi phục. → **Mitigation**: Thiết lập worker tự động gửi email nhắc nhở thanh toán khi mạch đóng lại.
- **[Risk]** Trạng thái mạch chỉ nằm trong bộ nhớ của 1 instance (nếu chạy nhiều instance API). → **Mitigation**: Trong giai đoạn đầu chấp nhận in-memory, giai đoạn sau có thể dùng Redis để đồng bộ trạng thái mạch nếu cần.
