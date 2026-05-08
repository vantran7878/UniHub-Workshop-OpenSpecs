# Bảng Ma trận Ánh xạ Use Case - Prototype

| Mã Use Case | Tên Use Case | Prototype / Màn hình tương ứng |
|---|---|---|
| U1 | Sign in (Đăng nhập) | Màn hình Đăng nhập |
| U2 | Sign out (Đăng xuất) | Màn hình Đăng xuất |
| U3 | Activate Account (Kích hoạt tài khoản) | Màn hình Đăng nhập / Màn hình Đổi mật khẩu (Lần đầu) |
| U05 | View class's information (Xem thông tin lớp/khóa học) | Màn hình Thông tin Khóa học |
| U06 | Access class Material (Truy cập tài liệu lớp học) | Màn hình Tài liệu Lớp học |
| U07 | View Assignment (Xem bài tập) | Màn hình Bài tập |
| U08 | View Grade and Feedback (Xem điểm và nhận xét) | Màn hình Điểm & Phản hồi |
| U09 / U10 | Remove / Submit Assignment (Nộp/Xóa bài tập) | Màn hình Nộp Bài tập |
| U11 | Submit absent request (Gửi yêu cầu vắng mặt) | Màn hình Yêu cầu Vắng mặt |
| U12 | View Timetable (Xem thời khóa biểu) | Màn hình Xem Thời khóa biểu |
| U13 | View Student List in Class (Xem danh sách học sinh) | Màn hình Danh sách Học sinh trong Lớp |
| U14 | Manage Material (Quản lý tài liệu) | Màn hình Quản lý Tài liệu |
| U15 | Manage Assignment (Quản lý bài tập) | Màn hình Quản lý Bài tập |
| U16 | Manage Grade & Feedback (Chấm điểm & Phản hồi) | Màn hình Chấm điểm & Phản hồi |
| U17 | Manage Class (Quản lý lớp học) | Màn hình Quản lý Lớp học |
| U21 | Manage Class Participants (Quản lý thành viên lớp) | Màn hình Quản lý Lớp học (Tab Thành viên) |
| U22 | Schedule Class (Xếp lịch học) | Màn hình Lịch học |
| U23 | Facilities Recording (Ghi nhận cơ sở vật chất) | Màn hình Quản lý Phòng học |
| U25 | Send Notification (Gửi thông báo) | Màn hình Gửi Thông báo |
| U26 | Configure permission (Cấu hình quyền) | Màn hình Quản lý Tài khoản (Phần phân quyền) |
| U27 | View dashboard & statistic (Xem Dashboard) | Màn hình Dashboard |
| U28 | Account Management (Quản lý tài khoản) | Màn hình Quản lý Tài khoản |
| U29 | Export Report (Xuất báo cáo) | Màn hình Xuất Báo cáo / Dashboard |
| U30 | Manage Student’s Feedback (Quản lý nhận xét học sinh) | Màn hình Nhận xét Học sinh |

---

# Ghi chú về Prototype

## 1. Module Giáo vụ
Các màn hình chính bao gồm:
- Quản lý Lớp học
- Thời khóa biểu
- Phòng học
- Gửi thông báo

Đây là những giao diện trọng tâm phục vụ cho các Use Case từ **U17 đến U25**.

---

## 2. Tính nhất quán
Các màn hình dùng chung cho tất cả vai trò:
- Đăng nhập / Đăng xuất
- Hộp thư thông báo

Áp dụng cho:
- Học sinh
- Giáo viên
- Giáo vụ
- Chủ trung tâm

---

## 3. Sự phụ thuộc giữa các Prototype
Một số màn hình Prototype sẽ bao gồm nhiều tab chức năng tương ứng với các Use Case khác nhau.

Ví dụ:
- **Chi tiết lớp học**
  - Tab **Tài liệu** → U14
  - Tab **Học sinh** → U13
  - Tab **Bài tập** → U15