# UniHub Workshop System - Hướng dẫn Setup và Chạy

## 📋 Yêu cầu hệ thống

- **Node.js**: v18+ (khuyến nghị v20)
- **pnpm**: v8+ (hoặc npm/yarn)
- **Flutter**: v3.10+ (cho mobile app)
- **Git**: Để clone repository

## 🚀 Phần 1: Web Application (Next.js Frontend)

### 1.1 Cài đặt Dependencies

```bash
# Chuyển đến thư mục project
cd unihub-workshop-system

# Cài đặt dependencies (dùng pnpm - nhanh hơn npm)
pnpm install

# Hoặc nếu dùng npm
npm install

# Hoặc nếu dùng yarn
yarn install
```

### 1.2 Cấu hình Environment Variables

Tạo file `.env.local` trong thư mục root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ogltevujqghnlgepbpgd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Redirect URL cho OAuth/Email
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

**Lấy keys từ Supabase:**
1. Đăng nhập vào Supabase Dashboard
2. Chọn project "unihub-workshop-system"
3. Vào **Settings > API** 
4. Copy `Project URL` và `anon public key`

### 1.3 Chạy Web App

```bash
# Development mode (với hot reload)
pnpm dev
# hoặc
npm run dev
# hoặc
yarn dev
```

Truy cập: **http://localhost:3000**

**Các trang chính:**
- `/` - Trang chủ
- `/workshops` - Danh sách workshop
- `/about` - Trang giới thiệu
- `/auth/login` - Đăng nhập
- `/auth/sign-up` - Đăng ký
- `/dashboard` - Dashboard sinh viên
- `/admin` - Dashboard admin (cần role admin)

### 1.4 Build cho Production

```bash
# Build
pnpm build

# Start production server
pnpm start
```

---

## 💻 Phần 2: Backend API

**Lưu ý:** Backend trong project này sử dụng Next.js API Routes + Supabase, không phải NestJS riêng biệt.

API endpoints được định nghĩa tại:
- `/app/api/` - Các route handler
- Server actions tại `/lib/actions/`

Khi chạy `pnpm dev`, API sẽ tự động chạy tại `http://localhost:3000/api`

**Không cần setup backend riêng biệt!**

---

## 📱 Phần 3: Mobile App (Flutter)

### 3.1 Cài đặt Flutter

```bash
# Tải Flutter từ: https://flutter.dev/docs/get-started/install

# Sau khi cài xong, kiểm tra installation
flutter doctor
```

Đảm bảo tất cả check mark ✓ đều green (hoặc yellow là được).

### 3.2 Setup Mobile Project

```bash
# Chuyển đến thư mục mobile
cd mobile

# Lấy dependencies
flutter pub get
```

### 3.3 Cấu hình Supabase cho Flutter

Cập nhật file `lib/core/constants/app_constants.dart`:

```dart
class AppConstants {
  static const String supabaseUrl = 'https://ogltevujqghnlgepbpgd.supabase.co';
  static const String supabaseAnonKey = 'your_anon_key_here';
  static const String supabaseProjectId = 'ogltevujqghnlgepbpgd';
}
```

### 3.4 Chạy Mobile App

**Trên Android Emulator:**
```bash
# Mở Android Emulator trước, sau đó:
cd mobile
flutter run
```

**Trên iOS Simulator (Mac only):**
```bash
cd mobile
flutter run -d macos
# hoặc
flutter run -d iphone
```

**Trên Device Thực:**
```bash
# Bật Developer Mode trên device
cd mobile
flutter run
# Flutter sẽ tự động phát hiện device
```

### 3.5 Build Mobile App

**Android APK:**
```bash
cd mobile
flutter build apk --release
# Output: build/app/outputs/flutter-app/release/app-release.apk
```

**iOS App:**
```bash
cd mobile
flutter build ios --release
# Output: build/ios/iphoneos/Runner.app
```

---

## 🔑 Tài khoản Test

Sau khi cài xong, bạn có thể đăng ký tài khoản mới hoặc dùng tài khoản test có sẵn.

### Tạo tài khoản Admin

Để tạo tài khoản admin, vào Supabase Dashboard:

1. Vào **Authentication > Users**
2. Click **Add user**
3. Nhập email + password
4. Confirm email
5. Vào bảng `users` và cập nhật `role = 'admin'`

---

## 🐛 Troubleshooting

### Lỗi 500 khi load workshops

**Nguyên nhân:** RLS policies chưa được cài đặt đúng

**Giải pháp:**
1. Kiểm tra Supabase Console > SQL Editor
2. Chạy lại RLS migration scripts
3. Reload browser

### Flutter app không connect được Supabase

**Nguyên nhân:** Supabase URL hoặc key sai

**Giải pháp:**
1. Kiểm tra lại keys trong `app_constants.dart`
2. Đảm bảo URL không có `/` ở cuối
3. Xóa app cache: `flutter clean`

### Port 3000 đang được dùng

```bash
# Kill process trên port 3000
lsof -i :3000
kill -9 <PID>

# Hoặc dùng port khác
pnpm dev -- -p 3001
```

---

## 📊 Kiến trúc Project

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
└── SETUP_GUIDE.md                # File này
```

---

## ✅ Checklist Deployment

Trước khi deploy lên production:

- [ ] Test login/signup
- [ ] Test workshop registration
- [ ] Test payment flow
- [ ] Test check-in qua QR code
- [ ] Test admin functions
- [ ] Cập nhật environment variables
- [ ] Kiểm tra RLS policies
- [ ] Test trên multiple devices
- [ ] Review security settings

---

## 📞 Liên hệ & Support

Nếu gặp vấn đề:

1. Kiểm tra logs: `pnpm dev` sẽ in ra console logs
2. Xem Supabase Logs: Dashboard > Logs
3. Xem Flutter logs: `flutter logs`

---

## 🎯 Bước tiếp theo

Sau khi chạy thành công:

1. **Seed thêm data**: Tạo thêm workshop, user để test
2. **Integrate Payment Gateway**: Kết nối Stripe hoặc MoMo để thanh toán
3. **Setup Email Notifications**: Cấu hình email sending
4. **Deploy**: Đẩy lên Vercel (web) và App Store/Play Store (mobile)

---

**Chúc bạn thành công! 🚀**
