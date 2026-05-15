# redis-distributed-lock Specification

## Purpose
TBD - created by archiving change implement-redis-lock-rate-limiting. Update Purpose after archive.
## Requirements
### Requirement: Atomic Workshop Seat Reservation Lock
Hệ thống SHALL đảm bảo rằng tại một thời điểm chỉ có duy nhất một request có thể thực hiện thay đổi số lượng chỗ ngồi cho một workshop cụ thể.

#### Scenario: Simultaneous Registration for the last seat
- **WHEN** 100 sinh viên cùng nhấn nút đăng ký cho workshop chỉ còn 1 chỗ trống.
- **THEN** Chỉ có 1 sinh viên chiếm được Redis Lock và được thực hiện logic trừ slot trong DB; 99 sinh viên còn lại nhận thông báo hệ thống đang bận hoặc hết chỗ.

### Requirement: Lock Expiration and Safety
Mọi lock được tạo ra MUST có thời gian sống (TTL) giới hạn để tránh tình trạng deadlock nếu process backend bị crash.

#### Scenario: Worker crash after acquiring lock
- **WHEN** Một worker chiếm được lock cho workshop A nhưng bị crash trước khi giải phóng lock.
- **THEN** Lock phải tự động hết hạn sau tối đa 3 giây, cho phép các request khác tiếp tục xử lý.

