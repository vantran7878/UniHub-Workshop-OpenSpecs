## Context

Hệ thống UniHub Workshop hiện đang sử dụng cơ chế lưu trữ chính là PostgreSQL. Để xử lý các vấn đề về hiệu năng và tính nhất quán khi có lượng truy cập đột biến (burst traffic) lên tới 120,000 sinh viên, hệ thống cần bổ sung một lớp middleware sử dụng Redis để quản lý các trạng thái tạm thời và khóa phân tán.

## Goals / Non-Goals

**Goals:**
- Đảm bảo tính nhất quán tuyệt đối trong luồng đăng ký workshop bằng cơ chế **Distributed Lock**.
- Bảo vệ hệ thống khỏi các cuộc tấn công brute-force và burst traffic bằng **Token Bucket Rate Limiting**.
- Sử dụng **Lua Scripts** để thực hiện các thao tác atomic trên Redis, giảm thiểu race conditions và tối ưu hiệu năng.

**Non-Goals:**
- Chuyển đổi toàn bộ logic nghiệp vụ từ PostgreSQL sang Redis.
- Triển khai cơ chế cache phức tạp cho toàn bộ ứng dụng (chỉ tập trung vào lock và rate limit).

## Decisions

1.  **Sử dụng `ioredis`**: Đây là thư viện Redis cho Node.js phổ biến nhất, hỗ trợ tốt các tính năng nâng cao như Lua scripting, cluster và pipeline.
2.  **Lua Script cho Token Bucket**: Logic tính toán token (refill, consume) sẽ được thực hiện hoàn toàn trong Redis thông qua Lua script để đảm bảo tính atomic và giảm thiểu network overhead.
3.  **Distributed Lock Pattern**: Sử dụng `SET NX PX` pattern đơn giản cho single instance Redis. Lock key sẽ có dạng `lock:workshop:{id}`.
4.  **Fail-over Strategy**: 
    - Đối với Rate Limiting: "Fail-open" - Nếu Redis down, hệ thống vẫn cho phép request đi qua để đảm bảo tính khả dụng (Availability).
    - Đối với Distributed Lock: "Fail-close" - Nếu Redis down, không cho phép đăng ký workshop để đảm bảo tính đúng đắn của dữ liệu (Consistency).

## Risks / Trade-offs

- **Sự phụ thuộc vào Redis**: Hệ thống trở nên phụ thuộc vào Redis cho các luồng quan trọng. Cần có cơ chế monitoring và alerting tốt.
- **Complexity**: Việc duy trì logic trong Lua scripts có thể khó debug hơn code ứng dụng thông thường. Cần viết Unit Test kỹ lưỡng cho các script này.
- **Memory Usage**: Cần cấu hình chính xác TTL (Time-To-Live) cho tất cả các key trong Redis để tránh tình trạng tràn bộ nhớ.
