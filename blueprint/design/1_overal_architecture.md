## 1. Kiến trúc Tổng thể

### 1.1 Tổng quan kiến trúc

UniHub Workshop được thiết kế theo kiến trúc **Microservices kết hợp Event-Driven**, phân tách thành các dịch vụ độc lập giao tiếp qua REST API (đồng bộ) và Message Broker (bất đồng bộ). Lựa chọn này xuất phát từ ba yêu cầu cốt lõi của đề bài:

- **Tải trọng đột biến**: Cần scale riêng từng service (Registration Service scale mạnh lúc mở đăng ký, Check-in Service scale lúc sự kiện diễn ra).
- **Fault isolation**: Cổng thanh toán sự cố không được kéo sập trang xem lịch workshop.
- **Tích hợp dị sản**: Hệ thống cũ xuất CSV đêm — cần một pipeline nhập dữ liệu độc lập, không ảnh hưởng luồng chính.

### 1.2 Các thành phần chính

| Thành phần | Vai trò | Công nghệ đề xuất |
|---|---|---|
| **API Gateway** | Điểm vào duy nhất, xác thực JWT, rate limiting, routing | Kong / AWS API Gateway |
| **Student Web App** | SPA cho sinh viên: xem lịch, đăng ký, quản lý vé | React + Next.js |
| **Admin Web App** | Trang quản trị nội bộ: tạo/sửa/hủy workshop, thống kê | React + Next.js |
| **Mobile App (Check-in)** | App quét QR cho nhân sự tại cửa phòng, hoạt động offline | React Native |
| **Workshop Service** | CRUD workshop, quản lý slot, thông tin phòng | Node.js / Spring Boot |
| **Registration Service** | Xử lý đăng ký, chống race condition, phát sinh QR | Node.js |
| **Payment Service** | Tích hợp cổng thanh toán, idempotency, Circuit Breaker | Node.js |
| **Notification Service** | Gửi email, push notification; dễ mở rộng thêm kênh | Node.js |
| **Check-in Service** | Xác nhận QR, lưu lượt tham dự, nhận sync offline | Node.js |
| **AI Summary Service** | Nhận PDF, trích xuất, gọi LLM tạo tóm tắt | Python (FastAPI) |
| **Student Sync Worker** | Đọc CSV từ hệ thống cũ, validate, import | Python |
| **Message Broker** | Giao tiếp bất đồng bộ giữa các service | RabbitMQ / Kafka |
| **Primary Database** | Dữ liệu nghiệp vụ chính | PostgreSQL |
| **Cache** | Slot còn lại, session, idempotency key | Redis |
| **Object Storage** | PDF tải lên, file CSV, QR code | AWS S3 / MinIO |

### 1.3 Nguyên tắc thiết kế

**Tách biệt theo khả năng chịu lỗi (Fault Domain Isolation)**

Mỗi service có database riêng (Database-per-Service pattern). Registration Service lỗi không ảnh hưởng trang danh sách workshop. Payment Service timeout không chặn việc xem lịch sự kiện.

**Bất đồng bộ cho side effects**

Sau khi đăng ký thành công, Registration Service publish event `registration.confirmed` lên broker. Notification Service subscribe event này và gửi email/push — hoàn toàn tách rời. Thêm kênh Telegram chỉ cần thêm một consumer mới, không sửa Registration Service.

**Cache-first cho dữ liệu hot**

Số slot còn lại của mỗi workshop được lưu trong Redis (atomic DECR). Chỉ persist xuống PostgreSQL theo batch. Điều này giảm tải DB trong đợt đăng ký đồng thời.

---