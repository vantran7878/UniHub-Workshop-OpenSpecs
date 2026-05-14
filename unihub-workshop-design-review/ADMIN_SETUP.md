# Admin Setup Guide - UniHub Workshop System

## Hiện Tại Có 3 Users

```
1. trancaovan0701backup@gmail.com - Full name: TCVTCV
2. trancaovan0701@gmail.com - Full name: TCVVCT
3. tcvan23@clc.fitus.edu.vn - Full name: TCV
```

Tất cả đều là `student` role. Để trở thành admin, bạn cần change role từ `student` → `admin`.

## Cách 1: Dùng Supabase Dashboard (UI)

1. Truy cập: https://app.supabase.com
2. Chọn project: **ogltevujqghnlgepbpgd**
3. Vào **SQL Editor** → Chọn **New Query**
4. Paste SQL dưới đây để change role:

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'your_email@gmail.com';
```

Replace `your_email@gmail.com` với email của bạn (chọn từ danh sách trên).

5. Click **Run** để execute

## Cách 2: Dùng Terminal (Command Line)

Nếu bạn có quyền truy cập database, chạy:

```bash
# Thay email của bạn vào
UPDATE public.users SET role = 'admin' WHERE email = 'trancaovan0701@gmail.com';
```

## Sau khi cập nhật role

1. **Logout** khỏi app hiện tại
2. **Login lại** với tài khoản đã được upgrade
3. Truy cập Admin Dashboard tại: `http://localhost:3000/admin`

## Tính Năng Admin

Sau khi đăng nhập là admin, bạn sẽ thấy:

### 1. **Dashboard** (`/admin`)
- Thống kê: Tổng workshops, users, registrations
- Doanh thu từ payments
- Số lượng check-in

### 2. **Quản lý Workshops** (`/admin/workshops`)
- Xem tất cả workshops (published + unpublished)
- **Tạo workshop mới**: Click "Tạo workshop" → Điền form
- **Sửa workshop**: Click vào workshop → Chỉnh sửa
- **Xóa workshop**: Xoá qua interface

### 3. **Xem Registrations** (`/admin/workshops/[id]/registrations`)
- Xem danh sách sinh viên đăng ký
- **Xác nhận registration** (status: pending → confirmed)
- Tự động gửi email xác nhận
- Tạo/sửa QR code

### 4. **Check-in Management** (`/admin/checkin`)
- Scan QR code để check-in sinh viên
- Xem danh sách đã check-in
- Thống kê check-in theo workshop

### 5. **User Management** (`/admin/users`)
- Xem tất cả users
- Change role: student → staff → admin
- Xem thông tin profile

## Vai Trò (Roles)

- **student**: Sinh viên - đăng ký workshop
- **staff**: Nhân viên - quản lý workshop, check-in
- **admin**: Quản trị viên - toàn quyền quản lý hệ thống

## URLs Admin

```
/admin              - Dashboard
/admin/workshops    - Danh sách workshops
/admin/workshops/new - Tạo workshop mới
/admin/checkin      - Check-in management
/admin/users        - Quản lý users
```

## Troubleshooting

**Q: Sau khi change role, vẫn không thấy admin dashboard?**
- A: Logout → Login lại. Session cũ vẫn cache role cũ.

**Q: Chỉ thấy `/admin` trắng hoặc redirect về `/dashboard`?**
- A: Đảm bảo role là `admin` hoặc `staff` trong database

**Q: Quên email của mình?**
- A: Chạy query: `SELECT email, role FROM public.users;` để xem tất cả
