# 🎓 UniHub Workshop Management System

Hệ thống quản lý workshop tiếng Việt dành cho các trường đại học, cho phép sinh viên đăng ký, thanh toán, và check-in tham dự các workshop.

## ✨ Tính năng chính

### 👨‍🎓 Cho Sinh viên
- ✅ Xem danh sách workshop
- ✅ Đăng ký workshop
- ✅ Thanh toán online
- ✅ Xem QR code xác nhận
- ✅ Quản lý hồ sơ cá nhân
- ✅ Nhận thông báo

### 👨‍💼 Cho Nhân viên/Admin
- ✅ Tạo & quản lý workshop
- ✅ Quản lý đăng ký sinh viên
- ✅ Check-in bằng QR code scanner
- ✅ Xem thống kê tham dự
- ✅ Quản lý người dùng
- ✅ Xuất báo cáo

## 🛠 Stack Công nghệ

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Supabase Client** - Database & Auth

### Backend
- **Next.js API Routes** - Serverless API
- **Supabase** - PostgreSQL + Auth + RLS

### Mobile
- **Flutter 3.10+** - Cross-platform app
- **GetX** - State management
- **QR Scanner** - Quét mã QR
- **SQLite** - Offline storage

### Database
- **PostgreSQL** (via Supabase)
- **Row Level Security (RLS)** - Data protection
- **Real-time subscriptions**

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/unihub-workshop-system.git
cd unihub-workshop-system
```

### 2. Setup Web App
```bash
pnpm install
cp .env.example .env.local
# Edit .env.local với Supabase keys
pnpm dev
```

Truy cập: http://localhost:3000

### 3. Setup Mobile App
```bash
cd mobile
flutter pub get
flutter run
```

### 4. Xem chi tiết tại [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## 📁 Project Structure

```
├── app/                    # Next.js pages & routes
│   ├── api/               # Backend API
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboard
│   ├── admin/             # Admin dashboard
│   └── workshops/         # Public pages
├── components/            # React components
├── lib/                   # Utilities & business logic
│   ├── supabase/         # Database client
│   ├── actions/          # Server actions
│   └── types/            # TypeScript types
├── mobile/               # Flutter app
│   └── lib/
│       ├── features/     # Feature modules
│       └── core/         # Core setup
└── SETUP_GUIDE.md        # Detailed setup guide
```

## 🔐 Security Features

- ✅ Supabase Auth với email/password
- ✅ Row Level Security (RLS) trên tất cả tables
- ✅ JWT token authentication
- ✅ Rate limiting
- ✅ CSRF protection
- ✅ Input validation & sanitization
- ✅ Secure password hashing
- ✅ HTTPS enforced

## 📊 Database Schema

9 bảng chính:
- `users` - Thông tin người dùng
- `workshops` - Các workshop
- `registrations` - Đăng ký workshop
- `payments` - Thanh toán
- `checkins` - Điểm danh
- `notifications` - Thông báo
- `workshop_summaries` - Tóm tắt AI
- `student_import_logs` - Nhập CSV
- `audit_logs` - Nhật ký hệ thống

## 🧪 Testing

### Tài khoản Test
```
Email: student@test.com
Password: Test123!

Email: admin@test.com
Password: Test123!
```

### Seed Data
8 workshop mẫu đã được tạo sẵn để test.

## 📚 API Documentation

Chi tiết API endpoints:

**Workshops**
- `GET /api/workshops` - Danh sách
- `POST /api/workshops` - Tạo (admin)
- `GET /api/workshops/[id]` - Chi tiết
- `PUT /api/workshops/[id]` - Cập nhật (admin)

**Registrations**
- `POST /api/registrations` - Đăng ký
- `GET /api/registrations` - Danh sách của user
- `DELETE /api/registrations/[id]` - Hủy đăng ký

**Checkins**
- `POST /api/checkins` - Check-in
- `GET /api/checkins/[id]` - Chi tiết check-in

## 🌐 Deployment

### Deploy Web (Vercel)
```bash
git push origin main
# Vercel tự động deploy
```

### Deploy Mobile
- **Android**: Google Play Store
- **iOS**: Apple App Store

## 📞 Support & Contact

- 📧 Email: support@unihub.edu.vn
- 💬 Discord: [Discord Server]
- 🐛 Issues: [GitHub Issues]

## 📄 License

MIT License - xem file LICENSE

## 🎯 Roadmap

- [ ] AI-powered workshop recommendations
- [ ] Payment gateway integration (Stripe/MoMo)
- [ ] Email notifications
- [ ] Workshop certificate generation
- [ ] Analytics dashboard
- [ ] Multi-language support

---

**Made with ❤️ for Vietnamese Universities**
