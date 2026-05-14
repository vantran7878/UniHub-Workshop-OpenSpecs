# UniHub Workshop — Project Proposal

## Vấn đề

Trường Đại học A hiện tổ chức "Tuần lễ kỹ năng và nghề nghiệp" với quy mô ngày càng mở rộng — 5 ngày liên tiếp, mỗi ngày 8–12 workshop diễn ra song song. Toàn bộ quy trình đăng ký và thông báo vẫn đang dựa vào Google Form và email thủ công.

Cách làm này dẫn đến một loạt hậu quả cụ thể:

- **Không kiểm soát được số chỗ theo thời gian thực.** Google Form không có cơ chế giới hạn số lượng đăng ký tự động, dẫn đến tình trạng một workshop 60 chỗ có thể nhận hàng trăm phản hồi, và ban tổ chức phải lọc tay.
- **Không có xác thực sinh viên.** Bất kỳ ai cũng có thể điền form, không có cách nào đảm bảo người đăng ký là sinh viên hợp lệ của trường.
- **Thông báo chậm và dễ bỏ sót.** Email thủ công sau mỗi đợt đăng ký không đảm bảo sinh viên nhận được xác nhận kịp thời hoặc thông báo khi workshop thay đổi lịch, đổi phòng, hoặc bị hủy.
- **Check-in tại sự kiện không có hệ thống.** Nhân sự tại cửa phòng không có công cụ kiểm tra nhanh, dẫn đến tắc nghẽn và tranh chấp chỗ ngồi.
- **Không có dữ liệu thống kê.** Ban tổ chức không thể theo dõi tỉ lệ tham dự thực tế, không có dữ liệu để cải thiện các kỳ sau.

Khi số lượng sinh viên tham gia vượt ngưỡng vài nghìn người, quy trình thủ công này không còn khả thi.

---

## Mục tiêu

UniHub Workshop được xây dựng để số hóa toàn bộ vòng đời của một workshop — từ khi ban tổ chức tạo sự kiện đến khi sinh viên check-in tại cửa phòng. Cụ thể, hệ thống cần đạt được:

| Mục tiêu | Chỉ tiêu định lượng |
|---|---|
| Hỗ trợ đăng ký đồng thời quy mô lớn | Xử lý ~12.000 sinh viên trong 10 phút đầu mở đăng ký, với 60% dồn vào 3 phút đầu |
| Đảm bảo tính toàn vẹn số chỗ | Không có hai sinh viên nào cùng nhận được chỗ cuối cùng của cùng một workshop |
| Xác nhận tức thì | Sinh viên nhận thông báo và mã QR trong vòng vài giây sau khi đăng ký thành công |
| Check-in không phụ thuộc mạng | Nhân sự vẫn ghi nhận check-in được khi mất kết nối; dữ liệu tự đồng bộ khi mạng phục hồi |
| Độc lập với cổng thanh toán | Khi cổng thanh toán gặp sự cố, các tính năng xem lịch và đăng ký miễn phí vẫn hoạt động bình thường |
| Tích hợp dữ liệu sinh viên | Nhập và xác thực dữ liệu sinh viên tự động từ file CSV hàng đêm, không làm gián đoạn hệ thống đang chạy |

---

## Người dùng và nhu cầu

### Sinh viên
Nhóm người dùng đông nhất và cũng là điểm tạo tải lớn nhất cho hệ thống. Nhu cầu cốt lõi:
- Xem toàn bộ lịch workshop trong tuần, bao gồm thông tin diễn giả, phòng tổ chức, sơ đồ phòng và số chỗ còn lại theo thời gian thực.
- Đăng ký tham dự — cả workshop miễn phí lẫn có phí — và nhận mã QR để check-in.
- Nhận thông báo xác nhận qua trình duyệt (Web Push) và email ngay sau khi đăng ký thành công.

Điều quan trọng nhất với sinh viên: **tốc độ và sự công bằng** — ai đăng ký trước thì được chỗ, và kết quả phải rõ ràng ngay lập tức.

### Ban tổ chức
Nhóm quản trị nội bộ, sử dụng trang web admin. Nhu cầu cốt lõi:
- Tạo workshop mới, cập nhật thông tin, đổi phòng, đổi giờ hoặc hủy workshop.
- Theo dõi số lượng đăng ký và tỉ lệ tham dự theo thời gian thực.
- Tải lên file PDF giới thiệu workshop để hệ thống tự tạo bản tóm tắt AI.

Điều quan trọng nhất với ban tổ chức: **kiểm soát và khả năng quan sát** — họ cần biết chuyện gì đang xảy ra ở mọi thời điểm.

### Nhân sự check-in
Người đứng tại cửa phòng trong suốt thời gian diễn ra sự kiện. Nhu cầu cốt lõi:
- Quét mã QR của sinh viên bằng mobile app để xác nhận tham dự.
- Tiếp tục làm việc được khi khu vực tổ chức mất kết nối mạng.

Điều quan trọng nhất với nhân sự check-in: **tin cậy và đơn giản** — app phải hoạt động ổn định, thao tác tối thiểu, và không bao giờ làm mất dữ liệu đã ghi nhận.

---

## Phạm vi

### Thuộc phạm vi đồ án này

- Hệ thống xem và đăng ký workshop (bao gồm cả miễn phí và có phí).
- Luồng thanh toán tích hợp với cổng thanh toán bên ngoài (mô phỏng, không dùng cổng thật trong môi trường phát triển).
- Hệ thống thông báo đa kênh (app, email) với kiến trúc hỗ trợ bổ sung kênh mới (ví dụ: Telegram) mà không cần thay đổi lớn.
- Trang web admin với phân quyền theo vai trò (sinh viên / ban tổ chức / nhân sự check-in).
- Mobile app check-in với khả năng hoạt động offline và tự đồng bộ.
- Pipeline nhập dữ liệu sinh viên từ file CSV xuất định kỳ.
- Tính năng AI Summary: xử lý PDF, tách nội dung và tạo tóm tắt hiển thị trên trang chi tiết workshop.
- Các cơ chế bảo vệ hệ thống: rate limiting, circuit breaker cho cổng thanh toán, idempotency key chống trừ tiền hai lần.

### Không thuộc phạm vi

- Tích hợp với cổng thanh toán thật (Momo, VNPay, v.v.) trong môi trường production.
- Tích hợp trực tiếp với hệ thống quản lý sinh viên hiện tại của trường (chỉ đọc CSV export).
- Hạ tầng production (CI/CD, monitoring, auto-scaling trên cloud).
- Ứng dụng di động cho sinh viên (sinh viên truy cập qua web; chỉ nhân sự check-in dùng mobile app).
- Quản lý tài chính, hoàn tiền tự động khi workshop bị hủy.

---

## Rủi ro và ràng buộc

### Tranh chấp chỗ ngồi (Race Condition)
Khi một workshop chỉ còn một chỗ trống và hàng chục sinh viên cùng bấm đăng ký trong cùng một giây, hệ thống phải đảm bảo chỉ đúng một người nhận được chỗ đó. Nếu không xử lý đúng, nhiều sinh viên có thể cùng nhận mã QR hợp lệ cho cùng một chỗ ngồi, gây tranh chấp tại sự kiện.

**Mức độ rủi ro: Cao.** Cần giải pháp đồng bộ ở tầng database (pessimistic/optimistic locking hoặc atomic decrement).

### Tải trọng đột biến (Traffic Spike)
Dự kiến khoảng 12.000 sinh viên truy cập trong 10 phút đầu khi mở đăng ký, với 60% dồn vào 3 phút đầu tiên. Nếu không có cơ chế bảo vệ, backend API có thể bị quá tải và sập hoàn toàn, ảnh hưởng đến tất cả sinh viên — kể cả những người chỉ muốn xem lịch.

**Mức độ rủi ro: Cao.** Cần rate limiting (Token Bucket hoặc Sliding Window) tại API Gateway và cơ chế hàng đợi để phân phối tải.

### Cổng thanh toán không ổn định (Payment Gateway Instability)
Cổng thanh toán là dịch vụ bên thứ ba, có thể chậm hoặc không phản hồi bất kỳ lúc nào. Nếu hệ thống không xử lý tốt, một sự cố thanh toán có thể kéo theo toàn bộ trang đăng ký bị treo, ảnh hưởng đến cả các workshop miễn phí. Ngoài ra, nếu client retry một request thanh toán đã thành công nhưng phản hồi bị mất, sinh viên có thể bị trừ tiền hai lần.

**Mức độ rủi ro: Cao.** Cần Circuit Breaker để cô lập lỗi và Idempotency Key để chống thanh toán trùng lặp.

### Check-in Offline
Một số khu vực trong trường có kết nối mạng không ổn định hoặc hoàn toàn mất mạng trong giờ cao điểm. Nhân sự check-in vẫn phải tiếp tục làm việc được; dữ liệu ghi nhận tại chỗ không được mất khi kết nối phục hồi.

**Mức độ rủi ro: Trung bình.** Cần local storage trên mobile app với cơ chế đồng bộ tự động (sync queue) và xử lý xung đột dữ liệu khi có nhiều thiết bị cùng check-in cho một sinh viên.

### Tích hợp một chiều với hệ thống cũ (Legacy Integration)
Hệ thống quản lý sinh viên hiện tại của trường không có API. Dữ liệu sinh viên chỉ có thể lấy qua file CSV được export tự động vào ban đêm. Pipeline nhập dữ liệu phải xử lý được các tình huống: file bị lỗi định dạng, dữ liệu trùng lặp, hoặc file không được tạo ra trong đêm đó — mà không làm gián đoạn hệ thống đang phục vụ sinh viên.

**Mức độ rủi ro: Trung bình.** Cần pipeline có validation, idempotent upsert, và cơ chế alert khi file không đến đúng giờ.
