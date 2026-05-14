# Admin Dashboard - Tính Năng Chi Tiết

## Menu Admin

Admin Dashboard có các mục sau trong sidebar:

### 1. **Tổng quan** (`/admin`)
- Thống kê hệ thống: workshops, users, doanh thu
- Danh sách registrations gần đây
- Quick stats về check-in rates

### 2. **Workshop** (`/admin/workshops`)
- Danh sách tất cả workshops (published/unpublished)
- **Tạo workshop mới**: Click "Tạo Workshop" → Điền thông tin
- **Sửa workshop**: Click trên workshop → Chỉnh sửa thông tin
- **Xóa workshop**: Click delete icon → Xác nhận
- **Xem đăng ký**: Click vào workshop → Tab Registrations

### 3. **Đăng ký** (Registrations - qua Workshop)
- Quản lý đăng ký cho từng workshop
- **Xác nhận đăng ký**: Sinh viên nhận email xác nhận + QR code
- **Hủy đăng ký**: Thay đổi trạng thái
- Email sẽ tự động gửi khi xác nhận

### 4. **Check-in** (`/admin/checkin`)
- **Quét QR code**: Dùng camera để scan QR từ sinh viên
- **Thống kê**: Xem số sinh viên đã check-in/tổng cộng
- **Chọn workshop**: Dropdown để chọn workshop hiện tại

### 5. **Người dùng** (`/admin/users`)
- Danh sách tất cả users (students, staff, admin)
- **Thay đổi vai trò**: Click button "Change Role" → Chọn vai trò mới
- **Filter**: Tìm kiếm user theo email

### 6. **Import Sinh viên** (`/admin/import-students`)
**Để thêm nhiều sinh viên cùng lúc:**

1. **Tải template**:
   - Click button "Tải template CSV"
   - File có cột: `email`, `full_name`

2. **Điền dữ liệu**:
   ```csv
   email,full_name
   student1@example.com,Nguyễn Văn A
   student2@example.com,Trần Thị B
   ```

3. **Upload**:
   - Drag & drop hoặc click để chọn file CSV
   - Hệ thống sẽ:
     - Tạo account cho mỗi sinh viên (password ngẫu nhiên)
     - Gửi email để sinh viên có thể đặt lại password
     - Hiển thị kết quả (success/error)

**Lưu ý**:
- Email phải hợp lệ và chưa tồn tại
- Password ngẫu nhiên sẽ được sinh tự động
- Sinh viên có thể thay đổi password sau lần đầu tiên đăng nhập

### 7. **AI Summary** (`/admin/ai-summary`)
**Tóm tắt thông tin hệ thống bằng AI:**

1. **Chọn kỳ thống kê**:
   - Tuần này (7 ngày gần đây)
   - Tháng này (30 ngày gần đây)
   - Toàn bộ (từ đầu)

2. **Click "Tạo tóm tắt AI"**:
   - Hệ thống sẽ phân tích dữ liệu
   - AI sẽ tạo report chi tiết bằng tiếng Việt

3. **Xem kết quả**:
   - **Statistics**: Thống kê (Workshops, Registrations, Revenue, Check-ins, etc.)
   - **AI Summary**: Phân tích chi tiết, insights, recommendations

**Nội dung AI Summary bao gồm**:
- Đánh giá hiệu suất chung
- Những thành tích chính
- Các lĩnh vực cần cải thiện
- Khuyến nghị cho bước tiếp theo

---

## Cài Đặt Để Sử Dụng Tính Năng

### Import Sinh viên

Cần thêm vào `.env.local`:
```env
SUPABASE_SERVICE_KEY=your_service_key_here
```

**Lấy Service Key**:
1. Vào Supabase Dashboard
2. Settings → API → Service Key (mục "service_role" secret)
3. Copy và paste vào `.env.local`

### AI Summary

**Tuỳ chọn 1: Sử dụng Basic Summary (không cần API key)**
- Hệ thống sẽ hiển thị thống kê cơ bản
- Không cần cấu hình gì thêm

**Tuỳ chọn 2: Sử dụng AI Enhanced Summary**

Cần thêm vào `.env.local`:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

**Lấy OpenAI API Key**:
1. Vào https://platform.openai.com/api-keys
2. Tạo API key mới
3. Copy và paste vào `.env.local`
4. Restart dev server

---

## Workflow Điển Hình

### Quy trình Tổ Chức Workshop:

1. **Tạo Workshop** → `/admin/workshops` → Click "Tạo Workshop"
2. **Import Sinh viên** → `/admin/import-students` → Upload CSV danh sách
3. **Sinh viên Đăng ký** → Website → Đăng ký workshops
4. **Xác nhận Đăng ký** → `/admin/workshops/[id]/registrations` → Confirm
   - Email + QR code tự động gửi
5. **Check-in** → `/admin/checkin` → Quét QR từ sinh viên
6. **Xem Thống kê** → `/admin/ai-summary` → Tạo report

---

## Mẹo & Trích Dẫn

- **Thiết lập nhanh**: Sử dụng Import Students để thêm hàng chục students cùng lúc
- **Gửi Email**: Admin có thể xác nhận registrations → Email tự động gửi
- **QR Code Check-in**: Mỗi registration có QR code riêng
- **AI Analytics**: Sử dụng AI Summary để tạo monthly reports tự động
- **Export Data**: (Tính năng sắp tới) Xuất dữ liệu registrations ra CSV/Excel

---

## Troubleshooting

**Q: Import Students không hoạt động?**
- A: Kiểm tra `SUPABASE_SERVICE_KEY` trong `.env.local`
- A: Kiểm tra định dạng CSV: phải có `email` và `full_name`

**Q: AI Summary chỉ hiển thị basic stats?**
- A: Không có `OPENAI_API_KEY` → sử dụng basic summary
- A: Thêm key vào `.env.local` và restart dev server

**Q: Email không gửi?**
- A: Kiểm tra `EMAIL_PROVIDER`, `EMAIL_USER`, `EMAIL_PASSWORD` trong `.env.local`
- A: Nếu dùng Gmail, cần App Password không phải password thường
