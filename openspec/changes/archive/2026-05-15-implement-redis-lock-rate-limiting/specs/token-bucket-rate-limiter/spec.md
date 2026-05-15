## ADDED Requirements

### Requirement: Token Bucket Rate Limiting logic
Hệ thống SHALL triển khai thuật toán Token Bucket sử dụng Redis Lua Script để đảm bảo tính atomic khi kiểm tra và trừ token.

#### Scenario: User exceeds login rate limit
- **WHEN** Một user thực hiện hơn 5 lần login trong vòng 1 phút (từ cùng một IP).
- **THEN** Hệ thống trả về mã lỗi 429 (Too Many Requests) kèm theo thời gian chờ (Retry-After).

### Requirement: Fail-Open availability
Cơ chế Rate Limiting SHALL không trở thành điểm nghẽn khiến toàn bộ hệ thống bị sập nếu Redis không khả dụng.

#### Scenario: Redis connection failure during rate limit check
- **WHEN** Backend không thể kết nối tới Redis khi thực hiện check rate limit.
- **THEN** Backend log lỗi cảnh báo và cho phép request đi qua (bypass rate limit) để đảm bảo người dùng vẫn có thể đăng nhập.
