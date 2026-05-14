# UniHub Workshop Mobile App

Ung dung Flutter cho he thong dang ky workshop.

## Yeu cau

- Flutter SDK >= 3.2.0
- Dart >= 3.2.0
- Android Studio (cho Android) hoac Xcode (cho iOS)

## Cai dat

### 1. Cai Flutter

```bash
# macOS (Homebrew)
brew install flutter

# Hoac tai tu: https://flutter.dev/docs/get-started/install
```

### 2. Kiem tra cai dat

```bash
flutter doctor
```

Dam bao tat ca checkmarks xanh (it nhat la Flutter va mot platform).

### 3. Cau hinh Supabase

Mo file `lib/core/constants/app_constants.dart` va cap nhat:

```dart
class AppConstants {
  static const String supabaseUrl = 'https://ogltevujqghnlgepbpgd.supabase.co';
  static const String supabaseAnonKey = 'YOUR_ANON_KEY_HERE';  // <-- Thay bang key that
  // ...
}
```

### 4. Cai dependencies

```bash
cd mobile
flutter pub get
```

### 5. Chay ung dung

```bash
# Android Emulator
flutter run

# iOS Simulator (chi macOS)
flutter run -d iphone

# Thiet bi cu the
flutter devices  # Liet ke devices
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

### iOS (chi macOS)

```bash
flutter build ios --release
# Sau do mo Xcode de archive va upload len App Store
```

## Cau truc thu muc

```
mobile/
├── lib/
│   ├── core/
│   │   ├── constants/     # Cau hinh ung dung
│   │   ├── router/        # Dinh tuyen (go_router)
│   │   ├── theme/         # Theme Material 3
│   │   └── widgets/       # Widget dung chung
│   ├── features/
│   │   ├── auth/          # Dang nhap/Dang ky
│   │   ├── home/          # Trang chu
│   │   ├── workshops/     # Danh sach & chi tiet workshop
│   │   ├── registrations/ # Quan ly dang ky
│   │   ├── checkin/       # Quet QR (Staff)
│   │   └── profile/       # Ho so ca nhan
│   └── main.dart
├── pubspec.yaml
└── README.md
```

## Tinh nang

### Sinh vien
- Xem danh sach workshop
- Dang ky workshop
- Xem ma QR de check-in
- Quan ly dang ky cua minh

### Staff
- Tat ca tinh nang cua sinh vien
- Quet QR de check-in sinh vien
- Ho tro check-in offline (sync sau)

## Xu ly loi thuong gap

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

### 4. Supabase connection failed

- Kiem tra `supabaseUrl` va `supabaseAnonKey` trong `app_constants.dart`
- Dam bao thiet bi co ket noi internet
- Kiem tra RLS policies tren Supabase

## Them custom font (tuy chon)

1. Tao folder `assets/fonts/`
2. Them file font `.ttf`
3. Uncomment phan fonts trong `pubspec.yaml`
4. Uncomment `fontFamily` trong `app_theme.dart`
5. Chay `flutter pub get`
