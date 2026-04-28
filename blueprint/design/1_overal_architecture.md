# Unihub Workshop - Technical Design 

## 1. Kiến trúc tổng thể

### 1.1 Architectural Style: Modular Monolith hướng tới Microservice trong tương lai
Unihub Workshop được thiết kế theo kiến trúc **Modular Monolith" trong giai đoạn đầu, với ranh giới module được phân tách rõ ràng để dễ dàng tách thành microservices độc lập khi cần mở rộng quy mô. Đồng thời, hệ thống tích hợp Event-Driven Architecture cho các luồng bất đồng bộ như thông báo, xử lý AI summary qua file PDF và đồng bộ file CSV.
 
| Tiêu chí             | Microservices thuần           | Modular Monolith (chọn) |
| ---------------------| -------------------           | ---------------- |
| Độ phức tạp vận hành | Cao (nhiều service, nhiều DB) | Thấp hơn, dễ deploy từ đầu |
| Ranh giới nghiệp     | Buộc phải rõ từ đầu           | Có thể điều chỉnh dần |
| Khả năng mở rộng     | Tốt ngay từ đầu               | Tốt sau khi tách module |
|Phù hợp nhóm nhỏ      | Khó                           | Phù hợp |


Các module có ranh giới nghiệp vụ rõ ràng (Workshop, Registration, Payment, Check-in, Notification, AI, CSV Import) giao tiếp với nhau qua **internal interface** trong cùng process, hoặc qua **message broker** khi cần tách biệt hoàn toàn (đặc biệt là Notification và AI Summary).

### 1.2 Các thành phần chính
┌─────────────────────────────────────────────────────────────┐
│                         Clients                             │
│  [Web App - React/Next.js]  [Mobile App - Flutter]          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS / REST
┌────────────────────▼────────────────────────────────────────┐
│                    API Gateway (Nginx)                      │
│         Rate Limiting · Auth Token Validation · Routing     │
└────┬──────────────────────────────────────────────┬─────────┘
     │ REST / gRPC                                  │
┌────▼──────────────────────────────────┐    ┌──────▼──────────┐
│         Backend Application           │    │  Batch Worker   │
│  ┌─────────────────────────────────┐  │    │  (CSV Import)   │
│  │  Auth Module                    │  │    └─────────────────┘
│  │  Workshop Manager Module        │  │
│  │  Booking Module                 │  │
│  │  Notification Module            │  │   
│  │  Payment Module                 │  │   
│  │  CSV Database synchronize       │  │   
│  │  Report Module                  │  │   ┌─────────────────┐
│  │  Check-in Module                │  │   │ AI Worker       │
│  │  AI PDF Summary Module          │  │---> (PDF → Summary) │
│  └─────────────────────────────────┘  │   └─────────────────┘
└────┬───────────────────────┬──────────┘
     │                       │ Publish Events
┌────▼──────┐        ┌───────▼────────────────────┐
│ Database  │        │   Message Broker           │
│(PostgreSQL│        │   (RabbitMQ)               │
│+ Redis)   │        │  • notification.queue      │
└───────────┘        │  • ai-summary.queue        │
                     │  • checkin-sync.queue      │
                     └──────────┬─────────────────┘
                                │ Consume
                     ┌──────────▼─────────────────┐
                     │   Notification Service     │
                     │  (Email · Push · Telegram) │
                     └────────────────────────────┘


1. Web App (Next.js)
Giao diện cho sinh viên (xem lịch, đăng ký, tra cứu QR, thông báo xác nhận khi đã đăng ký thành công workshop) và ban tổ chức (trang admin quản lý workshop, thống kê). Render server-side để tối ưu SEO và tốc độ load. Giao tiếp với backend qua REST API.
2. Mobile App (Flutter)
- Dành cho nhân sự check-in. Hỗ trợ chế độ offline: ghi nhận check-in vào local storage khi mất mạng tự đồng bộ lên server khi kết nối phục hồi. Giao tiếp với backend qua REST API; khi offline, hàng đợi đồng bộ được lưu bằng SQLite trên thiết bị.

- Dành cho sinh viên (xem lịch, đăng ký, tra cứu QR, thông báo xác nhận khi đã đăng ký thành công workshop). Render server-side để tối ưu SEO và tốc độ load. Giao tiếp với backend qua REST API.

3. API Gateway (Nginx + custom middleware hoặc Kong)
Tầng trung gian giữa client và backend, đảm nhiệm:

Rate Limiting (Token Bucket): giới hạn số request mỗi client trong khoảng thời gian, bảo vệ backend khỏi tải đột biến khi mở đăng ký.
Auth Token Validation: xác thực JWT trước khi forward request vào backend.
Routing: điều phối traffic đến đúng service.

4. Backend Application (Node.js)
Lõi xử lý nghiệp vụ, được tổ chức thành các module độc lập với ranh giới rõ ràng. Mỗi module chỉ expose interface công khai ra ngoài; các module khác không truy cập trực tiếp vào database của nhau.

| Module          | Trách nhiệm                              |
| ------------    | ------------------------------------------------ |
| Auth            | Login, Register, JWT Verify|
| Booking         | Xem và đăng ký workshop, xử lý tranh chấp chỗ ngồi, tải trọng tăng đột biến |
| Payment         |Xử lý thanh toán, Idempotency, 3DS Secure, Sandbox payment, thanh toán không ổn định  |
| Notification    | Thông báo xác nhận cho sinh viên qua web, app và email sau khi đặt chỗ ngồi workshop thành công, dễ dàng thêm kênh thông báo mới (telegram) |
| Workshop manager| Chỉ dành cho admin, có thể tạo workshop mới, cập nhật thông tin, đổi phòng, đổi giờ hoặc hủy workshop |
| Report          | Chỉ dành cho admin nhằm thống kê các thông tin về workshop |
| Check-in        | Chỉ dành cho nhân sự sử dụng mobile app để quét mã QR từ app của sinh viên. Đảm bảo check-in tạm thời cho dù không có mạng và tự đồng bộ lại khi kết nối đã phục hồi |
| AI PDF Summary  |  Lấy file PDF từ workshop bất kì và dùng AI để tạo bản tóm tắt trên trang chi tiết workshop|
| CSV Database synchronize | Lấy dữ liệu từ file CSV được export từ hệ thống cũ để xác thực sinh viên khi đăng ký |

5. Message Broker (RabbitMQ)
Tách biệt các luồng xử lý bất đồng bộ khỏi luồng request chính, đảm bảo:

- Gửi thông báo sau đăng ký không làm chậm response trả về cho sinh viên.
- AI Summary xử lý nền sau khi ban tổ chức upload PDF.
- Đồng bộ check-in từ mobile app được xử lý có thứ tự, không bị mất khi server tạm thời quá tải.

6. Cơ sở dữ liệu
- PostgreSQL (primary store): lưu toàn bộ dữ liệu quan hệ — sinh viên, workshop, đăng ký, lịch sử thanh toán. Đảm bảo ACID, phù hợp với yêu cầu nhất quán cao (đăng ký chỗ, thanh toán).
- Redis: phục vụ nhiều mục đích: distributed lock để chống race condition khi tranh chấp chỗ ngồi; cache danh sách workshop và số chỗ còn lại (giảm tải DB khi 12.000 sinh viên đọc đồng thời); lưu idempotency key cho thanh toán; lưu sliding window counter cho rate limiting.

7. Batch Worker (Node.js cron job)
Chạy theo lịch định kỳ (hàng đêm), đọc file CSV từ hệ thống cũ, xử lý dữ liệu sinh viên (validate, deduplicate, upsert vào PostgreSQL). Chạy độc lập, không ảnh hưởng đến luồng chính khi xảy ra lỗi.

8. AI Worker
Nhận event từ RabbitMQ khi có PDF mới được upload, gọi pipeline xử lý (tách nội dung, làm sạch văn bản, gọi AI model API) và lưu bản tóm tắt vào DB. Hoàn toàn bất đồng bộ.

### Cách các thành phần giao tiếp 
| Luồng | Giao thức |
| ----- | --------- |
|Client <-> API Gateway | HTTPS REST | 
|Mobile App <-> Check-in | HTTPS RÉT + offline queue |
|Backend -> Message Broker | AMQP (RabbitMQ)
|Backend <-> Redis | Redis Protocol | 
|Backend <-> PostgreSQL | TCP |
|Batch Worker -> PostgreSQL | TCP |

### 1.3 Ảnh hưởng khi một thành phần gặp sự cố 
|Thành phần lõi | Ảnh hưởng | Cơ chế giảm thiểu |
| ------------- | --------- | ----------------- |
| Cổng thanh toán | Luồng đăng ký có phí bị gián đoạn | Circuit Breaker, workshop miễn phí và xem lịch vẫn hoạt động bình thường |
| RabbitMQ | Thông báo và AI summary bị trì hoãn | Request đăng ký vẫn thành công, notification retry khi broker được phục hồi |
| Redis | Rate limiting và distributed lock không hoạt động | Fallback về DB-level lock (chậm nhưng vẫn đúng) tăng nguy cơ tranh chấp chỗ ngồi nhưng không mất dữ liệu
| CSV Import | Dữ liệu sinh viên không được cập nhật đêm đó | Sinh viên đã có trong DB vẫn đăng ký bình thường, có sự cố thì log lỗi, alert, chạy thủ công |
| Mobile app mất mạng | Check-in không lên server ngay | Lưu dữ liệu local bằng SQLite, đồng bộ tự động khi có mạng trở lại |
