# Email Setup Guide - Nodemailer

Da thay the Resend bang **Nodemailer** - miễn phí, không cần mua domain, dùng email ca nhan.

## 3 Cách Setup Email

### Cach 1: Gmail (Toi khuyến nghị - Dễ nhất)

**Buoc 1: Enable 2FA tren Gmail**
- Truy cap: https://myaccount.google.com/security
- Click "2-Step Verification" 
- Enable 2FA

**Buoc 2: Tao App Password**
- Truy cap: https://myaccount.google.com/apppasswords
- Chon "Mail" va "Windows Computer"
- Google se tao password 16 ky tu - copy no

**Buoc 3: Them vao .env.local**
```env
EMAIL_PROVIDER=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

Xong! Emails se duoc gui tu email Gmail cua ban.

---

### Cach 2: Yahoo, Outlook, hoac Email khac (SMTP tuy chinh)

**Buoc 1: Get SMTP info**
```
Yahoo Mail:
- SMTP_HOST=smtp.mail.yahoo.com
- SMTP_PORT=587
- EMAIL_USER=your_email@yahoo.com

Outlook:
- SMTP_HOST=smtp.office365.com  
- SMTP_PORT=587
- EMAIL_USER=your_email@outlook.com
```

**Buoc 2: Them vao .env.local**
```env
EMAIL_PROVIDER=smtp
EMAIL_USER=your_email@yahoo.com
EMAIL_PASSWORD=your_app_password_here
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

---

### Cach 3: Ethereal (TEST ONLY - khong gui email that)

Dung de test, emails se hien thi trong console.

```env
EMAIL_PROVIDER=ethereal
EMAIL_USER=
EMAIL_PASSWORD=
```

Sau khi test, copy email credentials tu Ethereal.

---

## Test Email

1. `pnpm dev`
2. Register account moi
3. Register workshop
4. Kiem tra email inbox

Neu may van de, xem logs: `[Email Sent]` hoac `[Email Error]`

---

## Troubleshooting

**"Invalid login" error?**
- Gmail: Kiem tra da dung App Password (khong phai regular password)
- Yahoo/Outlook: May be need to generate app password trong settings

**Email khong nhan?**
- Check spam folder
- Kiem tra EMAIL_USER chinh xac

**"smtp.mail.yahoo.com" connection timeout?**
- Thay SMTP_PORT thanh 465 va SMTP_SECURE=true
