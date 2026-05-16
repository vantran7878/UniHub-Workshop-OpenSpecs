# UniHub Mobile App

Ứng dụng mobile cho hệ thống quản lý workshop đại học, hỗ trợ check-in QR code cho nhân viên và quản lý đơn đăng ký cho sinh viên.

## Tính năng

### Cho Sinh viên
- ✅ Xem danh sách workshop
- ✅ Đăng ký tham gia workshop
- ✅ Xem mã QR check-in
- ✅ Quản lý đơn đăng ký
- ✅ Xem lịch sử check-in

### Cho Nhân viên
- ✅ Quét mã QR check-in
- ✅ Làm việc hoàn toàn offline (SQLite)
- ✅ Tự động sync dữ liệu khi có Internet
- ✅ Xem thống kê check-in theo workshop
- ✅ Xem tên + MSSV sinh viên khi quét QR

## Yêu cầu hệ thống

- Flutter SDK >= 3.2.0
- Dart >= 3.2.0
- iOS 12+ (nếu build cho iOS)
- Android 7+ / API level 24+ (nếu build cho Android)

## Cài đặt

### 1. Cài đặt Flutter

```bash
# macOS (Homebrew)
brew install flutter

# Hoặc tải từ: https://flutter.dev/docs/get-started/install
```

### 2. Kiểm tra cài đặt

```bash
flutter doctor
```

Đảm bảo tất cả checkmarks xanh (ít nhất là Flutter và một platform).

### 3. Cấu hình Supabase

Mở file `lib/core/constants/app_constants.dart` và cập nhật:

```dart
class AppConstants {
  static const String supabaseUrl = 'YOUR_SUPABASE_URL';
  static const String supabaseAnonKey = 'YOUR_ANON_KEY';
}
```

Lấy thông tin từ [Supabase Dashboard](https://supabase.com) → Settings → API

### 4. Cài dependencies

```bash
cd mobile
flutter pub get
```

### 5. Chạy ứng dụng

```bash
# Android Emulator
flutter run

# iOS Simulator (chỉ macOS)
flutter run -d iphone

# Thiết bị cụ thể
flutter devices      # Liệt kê devices
flutter run -d <device_id>
```

## Build Production

### Android APK

```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### Android App Bundle (cho Play Store)

```bash
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

### iOS (chỉ macOS)

```bash
flutter build ios --release
# Sau đó mở Xcode để archive và upload lên App Store
```

## Kiến trúc

```
mobile/lib/
├── main.dart
├── models/
│   └── models.dart                # Data models
├── services/
│   ├── auth_service.dart          # Authentication
│   ├── api_service.dart           # API calls
│   └── offline_service.dart       # SQLite + Offline
├── core/
│   ├── constants/                 # App constants
│   ├── router/                    # Navigation (GoRouter)
│   ├── theme/                     # Theme Material 3
│   └── widgets/                   # Common widgets
└── features/
    ├── auth/
    │   └── presentation/pages/
    │       ├── login_page.dart    # Login (Sinh viên/Nhân viên)
    │       └── signup_page.dart
    ├── home/
    │   └── presentation/pages/
    │       └── home_page.dart
    ├── workshops/
    │   └── presentation/pages/
    │       ├── workshops_page.dart
    │       └── workshop_detail_page.dart
    ├── registrations/
    │   └── presentation/pages/
    │       ├── registrations_page.dart
    │       └── registration_detail_page.dart
    ├── checkin/
    │   └── presentation/pages/
    │       └── checkin_page.dart   # QR scanning (Staff)
    └── profile/
        └── presentation/pages/
            └── profile_page.dart
```

## Công nghệ sử dụng

- **Flutter** - UI Framework
- **Supabase** - Backend + Auth
- **SQLite** - Cơ sở dữ liệu cục bộ
- **Riverpod** - State Management
- **GoRouter** - Navigation
- **mobile_scanner** - Quét QR
- **connectivity_plus** - Kiểm tra kết nối mạng

## Xử lý lỗi thường gặp

### 1. "Could not resolve dependencies"

```bash
flutter clean
flutter pub get
```

### 2. "Gradle build failed" (Android)

```bash
cd android
./gradlew clean
cd ..
flutter run
```

### 3. "CocoaPods not installed" (iOS)

```bash
sudo gem install cocoapods
cd ios
pod install
cd ..
flutter run
```

### 4. Kết nối Supabase thất bại

- Kiểm tra `supabaseUrl` và `supabaseAnonKey` trong `app_constants.dart`
- Đảm bảo thiết bị có kết nối Internet
- Kiểm tra RLS policies trên Supabase Dashboard

### 5. Quét QR không hoạt động

- Kiểm tra quyền camera trong Settings
- Đảm bảo QR code rõ ràng, không bị cấn cụt
- Tăng độ sáng hoặc di chuyển đến nơi sáng hơn

### 6. Check-in offline không sync

- Kiểm tra kết nối Internet
- Tap "Đồng bộ ngay" trong phần "Chờ đồng bộ"
- Restart ứng dụng

## Cấu hình Supabase cho Mobile

### 1. Enable Realtime (tùy chọn)

Supabase Dashboard → Realtime → Thêm tables

### 2. Cấu hình RLS (Row Level Security)

```sql
-- Cho bảng workshops (public read)
CREATE POLICY "allow_public_read" ON public.workshops
  FOR SELECT TO public USING (true);

-- Cho bảng registrations (user read own data)
CREATE POLICY "allow_user_read_own" ON public.registrations
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- Cho bảng checkins (staff create)
CREATE POLICY "allow_staff_create" ON public.checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('staff', 'admin')
    )
  );
```

### 3. Storage cho QR Code

```sql
-- Tạo bucket 'public' cho QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true);

-- Policy cho public read
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'public');
```

## Offline Mode Chi tiết

Ứng dụng hỗ trợ làm việc hoàn toàn offline:

1. **Auto Detection**: Tự động phát hiện mất kết nối
2. **Local Storage**: SQLite lưu check-in cục bộ
3. **Visual Indicator**: Badge "Chế độ offline" khi không có mạng
4. **Auto Sync**: Tự động sync khi kết nối lại
5. **Manual Sync**: Nút "Đồng bộ ngay" để sync lúc muốn
6. **Pending Count**: Hiển thị số check-in chờ đồng bộ

## Documentation

- [MOBILE_SETUP_GUIDE.md](../MOBILE_SETUP_GUIDE.md) - Hướng dẫn chi tiết
- [MOBILE_IMPLEMENTATION_SUMMARY.md](../MOBILE_IMPLEMENTATION_SUMMARY.md) - Tóm tắt implementation

## Support

Nếu gặp vấn đề:
1. Kiểm tra logs: `flutter logs`
2. Xem Supabase logs: Dashboard → Logs
3. Contact: support@unihub.edu.vn

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-16  
**License:** Proprietary
