## ADDED Requirements

### Requirement: Circuit State Management
Hệ thống SHALL duy trì 3 trạng thái của mạch:
- **CLOSED**: Dịch vụ hoạt động bình thường.
- **OPEN**: Dịch vụ lỗi vượt ngưỡng, mọi yêu cầu bị ngắt ngay lập tức và gọi fallback.
- **HALF_OPEN**: Sau một khoảng thời gian chờ (ví dụ: 30s), hệ thống SHALL cho phép một số lượng giới hạn yêu cầu đi qua để kiểm tra dịch vụ đã phục hồi chưa.

#### Scenario: Service Failure Threshold
- **WHEN** Có hơn 50% yêu cầu thanh toán thất bại (timeout hoặc 5xx) trong vòng 10 giây.
- **THEN** Mạch MUST chuyển sang trạng thái OPEN.

### Requirement: Fallback Processing
Khi mạch ở trạng thái OPEN, hệ thống SHALL không gọi đến cổng thanh toán mà MUST thực hiện luồng xử lý thay thế.

#### Scenario: Registration during payment outage
- **WHEN** Người dùng đăng ký workshop trong khi mạch thanh toán đang OPEN.
- **THEN** Hệ thống SHALL tạo bản ghi đăng ký với trạng thái `deferred_payment`.
- **AND** MUST thông báo cho người dùng rằng "Thanh toán tạm thời không khả dụng, vui lòng hoàn tất sau".
