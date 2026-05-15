## 1. Hạ tầng và Thư viện

- [x] 1.1 Cập nhật `docker-compose.yml` để bao gồm service Redis (nếu chưa có hoặc chưa config port).
- [x] 1.2 Cài đặt thư viện `ioredis` vào project backend.
- [x] 1.3 Cấu hình biến môi trường `REDIS_URL` trong `.env` và cập nhật config module.

## 2. Redis Distributed Lock

- [x] 2.1 Tạo `RedisProvider` hoặc helper class để khởi tạo và quản lý kết nối ioredis.
- [x] 2.2 Triển khai logic `acquireLock` và `releaseLock` sử dụng atomic commands (`SET NX PX`).
- [x] 2.3 Tích hợp Redis Lock vào `BookingService` để bảo vệ tài nguyên workshop seats.

## 3. Token Bucket Rate Limiting

- [x] 3.1 Viết Lua script cho thuật toán Token Bucket (trả về {allowed, retryAfter}).
- [x] 3.2 Triển khai middleware xác thực tốc độ truy cập dựa trên Lua script đã viết.
- [x] 3.3 Áp dụng middleware cho các endpoint nhạy cảm: `auth.login`, `auth.register`.

## 4. Kiểm thử và Xác nhận

- [x] 4.1 Viết Unit Test cho Lua script và Lock logic.
- [x] 4.2 Chạy Integration Test giả lập 10 concurrent requests đăng ký workshop.
- [x] 4.3 Kiểm tra hành vi "Fail-open" cho rate limit khi ngắt kết nối Redis.
