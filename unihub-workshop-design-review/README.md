# 🎓 UniHub Workshop Management System

Hệ thống quản lý workshop tiếng Việt dành cho các trường đại học, cho phép sinh viên đăng ký, thanh toán, và check-in tham dự các workshop, tích hợp background workers, AI summaries và hạ tầng đầy đủ.

## ✨ Tính năng
- **Cho Sinh viên:** Xem workshop, đăng ký, thanh toán online, nhận thông báo qua email.
- **Cho Admin:** Quản lý workshop, import danh sách sinh viên hàng loạt (CSV), tóm tắt nội dung workshop tự động bằng AI từ file PDF, thống kê dashboard.
- **Cho Staff:** Check-in sinh viên bằng QR code.
- **Background Workers:** Đồng bộ dữ liệu và tự động hóa gửi email hiệu năng cao với RabbitMQ và Redis.
- **Cross-platform:** Ứng dụng Web (Next.js) và Mobile (Flutter).

---

## 🛠 Stack Công nghệ

- **Web:** Next.js
- **Mobile:** Flutter
- **Database:** PostgreSQL - Supabase
- **Background Workers:** RabbitMQ, Redis, Mailhog

---

## 🚀 Hướng Dẫn Cài Đặt và Chạy Hệ Thống

### 1. Yêu Cầu Hệ Thống
- **Node.js**: v18.x hoặc 20.x trở lên.
- **pnpm**: (Cài đặt qua lệnh `npm install -g pnpm`).
- **Flutter**: v3.10+ (Chỉ yêu cầu nếu muốn build/chạy Mobile App).
- **Docker** & **Docker Compose**: Chạy cơ sở dữ liệu (PostgreSQL), Redis, RabbitMQ và Mailhog.
- **Supabase**: Một project trên Supabase để lấy thông tin Database và Auth.

### 2. Clone Repository

```bash
git clone https://github.com/vantran7878/UniHub-Workshop-OpenSpecs.git
cd unihub-workshop-design-review
```

### 3. Khởi Động Hạ Tầng (Infrastructure)
Dự án dùng Docker để cung cấp Postgres, Redis, RabbitMQ, Mailhog.
Từ thư mục gốc của toàn dự án (ngoài thư mục `unihub-workshop-design-review`), chạy:

```bash
cd ..
npm run dev:infra
```
*(`npm run dev:infra` tương đương với `docker compose up -d`. Để tắt hệ thống hạ tầng: `npm run dev:infra:down`)*

### 4. Cấu Hình Biến Môi Trường (.env.local)
Quay lại thư mục `unihub-workshop-design-review` tạo file môi trường `.env.local`:

```bash
cp .env.example .env.local
```

Mở file `.env.local` thêm các biến môi trường cần thiết hoặc sử dụng `.env.example` như ví dụ để chạy.

### 5. Khởi Động Background Workers
Mở một terminal mới tại thư mục `unihub-workshop-design-review`, chạy:
```bash
pnpm workers
```

### 6. Khởi Động Web App
Chạy các lệnh sau tại thư mục `unihub-workshop-design-review`:
```bash
pnpm install
pnpm dev
```
Web app chạy tại: **http://localhost:3000**

### 7. Khởi động Mobile App

Nếu bạn muốn chạy phiên bản ứng dụng trên điện thoại:
1. Vào thư mục `unihub-workshop-design-review/mobile`.

2. Cấu hình Supabase Constants của bạn tại `mobile/lib/core/constants/app_constants.dart` hoặc sử dụng như ví dụ để chạy:

   ```dart
   class AppConstants {
     static const String supabaseUrl = 'YOUR_SUPABASE_URL';
     static const String supabaseAnonKey = 'YOUR_ANON_KEY';
     static const String supabaseProjectId = 'YOUR_PROJECT_ID';
   }
   ```

3. Chạy ứng dụng:

   ```bash
   flutter pub get
   flutter run
   ```

---

## 📊 Kiến trúc dự án

```
unihub-workshop-system/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   ├── auth/                     # Auth pages (login, signup)
│   ├── dashboard/                # Student dashboard
│   ├── admin/                    # Admin dashboard
│   ├── workshops/                # Public workshops
│   └── about/                    # About page
├── components/                   # React components
│   ├── layout/                   # Header, Footer
│   ├── workshops/                # Workshop components
│   └── admin/                    # Admin components
├── lib/
│   ├── supabase/                 # Supabase clients
│   ├── actions/                  # Server actions
│   ├── types/                    # TypeScript types
│   └── utils.ts                  # Utilities
├── mobile/                       # Flutter app
│   ├── lib/
│   │   ├── core/                 # App theme, router, widgets
│   │   ├── features/             # Feature modules
│   │   │   ├── auth/
│   │   │   ├── home/
│   │   │   ├── workshops/
│   │   │   ├── registrations/
│   │   │   ├── checkin/
│   │   │   └── profile/
│   │   └── main.dart
│   └── pubspec.yaml
└── README.md                # File này
```

---

## 🧪 Dữ liệu thử nghiệm Test)

Các thông tin tài khoản mẫu và dữ liệu thử nghiệm (seed data) đã được cung cấp đầy đủ.
Các dữ liệu thử nghiệm đã có sẵn trên database supabase mẫu trong `.env.example`. 
Vui lòng kiểm tra bên trong thư mục `unihub-workshop-design-review/test` của dự án để lấy tài khoản đăng nhập và các thông tin khác.

---

## 🛠️ Xử Lý Sự Cố (Troubleshooting)

- **Lỗi Email không gửi được:** Đảm bảo sử dụng *App Password* (không phải mật khẩu thông thường) của Gmail. Nếu dùng SMTP khác, hãy cấu hình Port và TLS phù hợp.
- **Import Sinh viên thất bại:** Cần đảm bảo file CSV có format chuẩn (có 2 cột: `email`, `full_name`) và `.env.local` đã điền chính xác `SUPABASE_SERVICE_KEY`.
- **AI Summary hiển thị lỗi:** Cần đảm bảo đã cung cấp `OPENAI_API_KEY` trong `.env.local` và restart lại Next.js server.
- **Port 3000 đã bị sử dụng:** Tắt các ứng dụng chạy cổng 3000 (`kill -9 $(lsof -t -i:3000)`) hoặc chạy với cổng khác (`pnpm dev -- -p 3001`).
