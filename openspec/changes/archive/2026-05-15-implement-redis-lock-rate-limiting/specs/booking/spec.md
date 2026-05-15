## ADDED Requirements

### Requirement: High-Conflict Seat Reservation Protection
Luồng đăng ký workshop (miễn phí và có phí) SHALL sử dụng Redis Distributed Lock để bảo vệ resource `workshop:{id}:capacity`.

#### Scenario: Simultaneous registration for a popular workshop
- **WHEN** 10,000 sinh viên cùng đăng ký một workshop ngay khi vừa mở cổng.
- **THEN** Hệ thống sử dụng Redis Lock để xếp hàng các request, đảm bảo tổng số bản ghi `confirmed` không bao giờ vượt quá `capacity`.
