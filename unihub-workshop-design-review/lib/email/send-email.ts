import nodemailer from 'nodemailer';

export interface SendRegistrationEmailProps {
  studentEmail: string;
  studentName: string;
  workshopTitle: string;
  workshopDate: string;
  workshopTime: string;
  roomName: string;
  qrCodeDataUrl: string;
  qrBuffer?: Buffer; // inline CID attachment
}

// Create transporter - supports multiple email providers
const createTransporter = () => {
  const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';
  console.log('[Email Transporter] Provider:', emailProvider);
  console.log('[Email Transporter] User:', process.env.EMAIL_USER);

  if (emailProvider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } else if (emailProvider === 'smtp') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } else if (emailProvider === 'ethereal') {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  return null;
};

export async function sendRegistrationConfirmationEmail(
  props: SendRegistrationEmailProps
) {
  console.log('[Email Debug] Starting email send...');
  console.log('[Email Debug] EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
  console.log('[Email Debug] EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
  console.log('[Email Debug] EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET');
  console.log('[Email Debug] To:', props.studentEmail);
  console.log('[Email Debug] QR Buffer:', props.qrBuffer ? `${props.qrBuffer.length} bytes` : 'NOT PROVIDED');

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('[Email Skipped] EMAIL_USER or EMAIL_PASSWORD not configured');
    return { success: true, skipped: true };
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.log('[Email Skipped] EMAIL_PROVIDER not supported');
    return { success: true, skipped: true };
  }

  try {
    console.log('[Email Debug] Verifying transporter...');
    await transporter.verify();
    console.log('[Email Debug] Transporter verified successfully');

    const senderEmail = process.env.EMAIL_USER || 'noreply@unihub.edu.vn';

    // Dùng CID nếu có buffer, fallback sang URL nếu không
    const qrImgSrc = props.qrBuffer
      ? `data:image/png;base64,${props.qrBuffer.toString('base64')}`
      : props.qrCodeDataUrl;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xac nhan dang ky workshop</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">UniHub Workshop</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Xac nhan dang ky thanh cong</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px;">Xin chao <strong>${props.studentName}</strong>,</p>

          <p>Ban da dang ky thanh cong workshop:</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #0ea5e9; margin: 0 0 15px 0; font-size: 20px;">${props.workshopTitle}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 100px;">Ngay:</td>
                <td style="padding: 8px 0; font-weight: 500;">${props.workshopDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Gio:</td>
                <td style="padding: 8px 0; font-weight: 500;">${props.workshopTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Phong:</td>
                <td style="padding: 8px 0; font-weight: 500;">${props.roomName}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #64748b; margin-bottom: 15px;">Ma QR check-in cua ban:</p>
            <div style="background: white; display: inline-block; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <img src="${qrImgSrc}" alt="QR Code" style="width: 200px; height: 200px; display: block;" />
            </div>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 15px;">Vui long xuat trinh ma QR nay khi check-in</p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            Neu ban co bat ky cau hoi nao, vui long lien he voi chung toi.<br/>
            <strong>UniHub Workshop System</strong>
          </p>
        </div>
      </body>
      </html>
    `;

    const result = await transporter.sendMail({
      from: senderEmail,
      to: props.studentEmail,
      subject: `Xac nhan dang ky: ${props.workshopTitle}`,
      html: emailHtml,
    });

    console.log('[Email Sent]', result.messageId);
    transporter.close();
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Error]', error);
    if (transporter) transporter.close();
    return { success: false, error: String(error) };
  }
}

export interface SendPaymentReminderEmailProps {
  studentEmail: string;
  workshopTitle: string;
  amount: number;
  paymentUrl: string;
}

export async function sendPaymentReminderEmail(props: SendPaymentReminderEmailProps) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return { success: true, skipped: true };
  const transporter = createTransporter();
  if (!transporter) return { success: true, skipped: true };

  try {
    const senderEmail = process.env.EMAIL_USER || 'noreply@unihub.edu.vn';
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Nhắc nhở thanh toán Workshop</h2>
        <p>Chào bạn,</p>
        <p>Hệ thống ghi nhận bạn đã đăng ký workshop <strong>${props.workshopTitle}</strong> thành công.</p>
        <p>Do hệ thống thanh toán gặp sự cố tạm thời, yêu cầu của bạn đã được ghi nhận ở trạng thái chờ.</p>
        <p>Vui lòng hoàn tất thanh toán số tiền <strong>${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(props.amount)}</strong> để xác nhận chỗ ngồi.</p>
        <div style="margin: 30px 0;">
          <a href="${props.paymentUrl}" style="background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Thanh toán ngay</a>
        </div>
        <p>Cảm ơn bạn!</p>
      </div>
    `;

    await transporter.sendMail({
      from: senderEmail,
      to: props.studentEmail,
      subject: `Nhắc nhở thanh toán: ${props.workshopTitle}`,
      html: emailHtml,
    });

    transporter.close();
    return { success: true };
  } catch (error) {
    console.error('[Email Reminder Error]', error);
    if (transporter) transporter.close();
    return { success: false, error: String(error) };
  }
}