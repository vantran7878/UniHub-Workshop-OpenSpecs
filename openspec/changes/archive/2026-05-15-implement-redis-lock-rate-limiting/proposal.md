## Why

Hệ thống hiện tại đang gặp thách thức lớn về tính nhất quán dữ liệu khi xảy ra tranh chấp chỗ ngồi cao (high conflict) và rủi ro quá tải hệ thống khi mở đăng ký workshop. Việc sử dụng database row locking đơn thuần có thể dẫn đến nghẽn connection pool. Cần một giải pháp hiệu năng cao dựa trên Redis để xử lý khóa phân tán và giới hạn tốc độ truy cập (rate limiting) nhằm đảm bảo hệ thống vận hành ổn định dưới tải trọng 120,000 sinh viên.

## What Changes

- Triển khai **Redis Distributed Lock** (sử dụng Redlock pattern hoặc ioredis) để quản lý việc giữ chỗ ngồi workshop một cách atomic.
- Xây dựng middleware **Token Bucket Rate Limiter** sử dụng Lua Script chạy trên Redis để đảm bảo tính chính xác và hiệu năng cao cho các endpoint Auth và Booking.
- Cấu hình hạ tầng Redis trong `docker-compose.yml` và các biến môi trường cần thiết.

## Capabilities

### New Capabilities
- `redis-distributed-lock`: Cơ chế khóa phân tán để xử lý tranh chấp chỗ ngồi cao, đảm bảo không bị oversell.
- `token-bucket-rate-limiter`: Giới hạn tốc độ theo thuật toán Token Bucket (Lua script) để chống burst traffic.

### Modified Capabilities
- `booking`: Tích hợp Redis Lock vào luồng đăng ký workshop.
- `auth`: Áp dụng rate limiting cho các endpoint Login/Register.

## Impact

- **Infrastructure**: Yêu cầu Redis Server (đã có trong thiết kế nhưng cần cấu hình thực tế).
- **Backend**: Thêm thư viện `ioredis` và các helper class xử lý Redis.
- **Performance**: Giảm tải cho PostgreSQL bằng cách đẩy việc quản lý lock và counter sang Redis.
