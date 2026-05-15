## ADDED Requirements

### Requirement: Brute-force protection via Token Bucket
Endpoint Login và Register SHALL được bảo vệ bởi middleware Token Bucket rate limiter.

#### Scenario: Aggressive brute-force attempt
- **WHEN** Một IP thực hiện 100 request login liên tiếp trong 10 giây.
- **THEN** Sau request thứ 5, các request còn lại phải bị chặn ngay từ lớp middleware với mã lỗi 429.
