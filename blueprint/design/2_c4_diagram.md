## 2. C4 Diagram

### 2.1 Level 1 — System Context

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

```mermaid
C4Context
  title System Context — UniHub Workshop

  Person(student, "Sinh viên", "Xem workshop, đăng ký, nhận QR check-in")
  Person(organizer, "Ban tổ chức", "Tạo workshop, theo dõi đăng ký, upload PDF")
  Person(checkin_staff, "Nhân sự check-in", "Quét QR tại cửa phòng")

  System(unihub, "UniHub Workshop", "Quản lý toàn bộ quy trình workshop: đăng ký, thanh toán, check-in, thông báo")

  System_Ext(email_svc, "Email Service", "Gửi email xác nhận và thông báo sự kiện")
  System_Ext(payment_gw, "Payment Gateway", "Xử lý thanh toán workshop có phí")
  System_Ext(ai_svc, "AI Summarization Service", "Tạo tóm tắt nội dung từ PDF")
  System_Ext(csv_sys, "CSV Synchronize System", "Export CSV sinh viên theo lịch cố định hàng đêm")

  Rel(student, unihub, "Xem lịch, đăng ký, nhận QR", "HTTPS")
  Rel(organizer, unihub, "Quản trị workshop, xem thống kê", "HTTPS")
  Rel(checkin_staff, unihub, "Quét QR, đồng bộ offline", "HTTPS / Offline sync")

  Rel(unihub, email_svc, "Gửi thông báo xác nhận", "SMTP / API")
  Rel(unihub, payment_gw, "Xử lý giao dịch có phí", "HTTPS")
  Rel(unihub, ai_svc, "Gửi nội dung PDF để tóm tắt", "HTTPS")
  Rel(csv_sys, unihub, "Export CSV sinh viên hàng đêm", "Scheduled file read")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

```mermaid
C4Container
  title Container Diagram — UniHub Workshop

  Person(student, "Sinh viên", "")
  Person(organizer, "Ban tổ chức", "")
  Person(checkin_staff, "Nhân sự check-in", "")

  System_Boundary(unihub, "UniHub Workshop") {
    Container(web_app, "Web App", "Next.js", "Giao diện cho sinh viên đăng ký và ban tổ chức quản trị")
    Container(mobile_app, "Mobile App", "React Native", "Quét QR, hỗ trợ check-in offline với local SQLite")
    Container(api, "Backend API", "Node.js / NestJS", "Xử lý toàn bộ nghiệp vụ: đăng ký, thanh toán, check-in, phân quyền")
    Container(api_gateway, "API Gateway", "Nginx", "Rate limiting, xác thực JWT, routing")
    Container(broker, "Message Broker", "RabbitMQ", "Hàng đợi bất đồng bộ cho notification, AI summary, checkin-sync")
    Container(batch_worker, "Batch Worker", "Node.js Cron", "Import CSV sinh viên định kỳ hàng đêm")
    Container(ai_worker, "AI Worker", "Node.js", "Nhận PDF, xử lý và gọi AI model để tóm tắt")
    ContainerDb(postgres, "Primary Database", "PostgreSQL", "Lưu sinh viên, workshop, đăng ký, thanh toán")
    ContainerDb(redis, "Cache & Lock Store", "Redis", "Distributed lock, rate limit counter, session cache, idempotency key")
  }

  System_Ext(email_svc, "Email Service", "SMTP / API")
  System_Ext(payment_gw, "Payment Gateway", "HTTPS")
  System_Ext(ai_svc, "AI Summarization Service", "HTTPS")
  System_Ext(legacy_sys, "Legacy Student System (CSV)", "File export")

  Rel(student, web_app, "Dùng trình duyệt", "HTTPS")
  Rel(organizer, web_app, "Quản trị qua admin portal", "HTTPS")
  Rel(checkin_staff, mobile_app, "Quét QR tại cửa phòng", "HTTPS / Offline")

  Rel(web_app, api_gateway, "Gọi API", "HTTPS / WebSocket")
  Rel(mobile_app, api_gateway, "Gọi API, đồng bộ offline", "HTTPS")
  Rel(api_gateway, api, "Forward request (sau khi rate limit & auth)", "HTTP")

  Rel(api, postgres, "Đọc/ghi dữ liệu", "TCP")
  Rel(api, redis, "Cache, lock, rate counter", "TCP")
  Rel(api, broker, "Publish events (notification, AI, checkin-sync)", "AMQP")

  Rel(broker, ai_worker, "Consume PDF event", "AMQP")
  Rel(broker, batch_worker, "Consume checkin-sync event", "AMQP")

  Rel(ai_worker, ai_svc, "Gửi text để tóm tắt", "HTTPS")
  Rel(ai_worker, postgres, "Lưu kết quả tóm tắt", "TCP")

  Rel(batch_worker, postgres, "Upsert dữ liệu sinh viên", "TCP")
  Rel(legacy_sys, batch_worker, "Đọc file CSV hàng đêm", "File I/O")

  Rel(api, payment_gw, "Xử lý thanh toán (Circuit Breaker)", "HTTPS")
  Rel(api, email_svc, "Trigger gửi email (qua broker)", "AMQP → SMTP")

  UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```