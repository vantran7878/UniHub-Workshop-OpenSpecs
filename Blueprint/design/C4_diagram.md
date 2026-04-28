## C4 Diagram

### Level 1 — System Context

**Mô tả:**
Diagram mức cao nhất thể hiện **UniHub Workshop** như một hệ thống duy nhất (black box) trong bối cảnh môi trường của nó. Diagram làm rõ ai là người dùng (actors) và hệ thống bên ngoài (external systems) mà UniHub Workshop tương tác.

**Actors (Người dùng):**
- **Sinh viên (Student)**: Xem lịch workshop, đăng ký tham gia (miễn phí/có phí), nhận QR code và thông báo.
- **Ban tổ chức (Organizer)**: Tạo, chỉnh sửa, hủy workshop, quản lý thông tin, xem thống kê đăng ký và tải PDF để AI tóm tắt.
- **Nhân sự check-in (Check-in Staff)**: Quét mã QR để xác nhận sự tham dự tại chỗ (sử dụng mobile app).

**External Systems (Hệ thống bên ngoài):**
- **Email Service** (ví dụ: SendGrid, AWS SES hoặc SMTP server của trường): Gửi email xác nhận đăng ký và thông báo.
- **Payment Gateway** (ví dụ: VNPay, Momo, Stripe — giả lập trong đồ án): Xử lý thanh toán cho workshop có phí.
- **AI Summarization Service** (ví dụ: OpenAI GPT, Grok API, hoặc self-hosted LLM): Nhận text trích xuất từ PDF và trả về bản tóm tắt workshop.
- **Legacy Student Management System**: Cung cấp file CSV export định kỳ vào ban đêm (không có API hai chiều).
- **Future Notification Channels** (Telegram, Push Notification service): Thiết kế để dễ mở rộng.

**Interactions chính:**
- Sinh viên và Ban tổ chức tương tác với UniHub Workshop qua Web Application.
- Nhân sự check-in tương tác qua Mobile Application.
- UniHub Workshop gọi ra các external systems để xử lý thanh toán, gửi thông báo, tạo AI summary và nhập dữ liệu sinh viên từ CSV.

**Lý do thiết kế Level 1:**
Giúp các stakeholder (giảng viên, ban tổ chức trường) hiểu rõ phạm vi hệ thống và các điểm tích hợp bên ngoài mà không đi sâu vào công nghệ.

*(Ở đây bạn sẽ chèn diagram Level 1 – khuyến nghị vẽ bằng PlantUML hoặc C4-PlantUML)*

```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

Person(student, "Sinh viên", "Xem workshop, đăng ký, nhận QR")
Person(organizer, "Ban tổ chức", "Quản lý workshop, thống kê, upload PDF")
Person(checkin_staff, "Nhân sự check-in", "Quét QR bằng mobile app")

System(unihub, "UniHub Workshop", "Hệ thống quản lý workshop, đăng ký và check-in")

System_Ext(email, "Email Service", "Gửi email xác nhận và thông báo")
System_Ext(payment, "Payment Gateway", "Xử lý thanh toán workshop có phí")
System_Ext(ai, "AI Summarization Service", "Tạo tóm tắt từ PDF")
System_Ext(legacy_csv, "Legacy Student System (CSV)", "Export file CSV sinh viên ban đêm")

Rel(student, unihub, "Sử dụng (xem, đăng ký)", "HTTPS/WebSocket")
Rel(organizer, unihub, "Quản trị (CRUD workshop, thống kê)", "HTTPS")
Rel(checkin_staff, unihub, "Check-in qua Mobile App", "HTTPS / Offline sync")

Rel(unihub, email, "Gửi thông báo", "SMTP/API")
Rel(unihub, payment, "Xử lý thanh toán", "HTTPS")
Rel(unihub, ai, "Gửi text PDF để tóm tắt", "HTTPS")
Rel(unihub, legacy_csv, "Đọc và import CSV định kỳ", "Scheduled Job")

@enduml