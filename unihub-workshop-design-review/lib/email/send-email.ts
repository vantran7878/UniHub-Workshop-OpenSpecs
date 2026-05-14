import { Resend } from 'resend';
import * as React from 'react';

// Initialize Resend only if API key exists
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

export interface SendRegistrationEmailProps {
  studentEmail: string;
  studentName: string;
  workshopTitle: string;
  workshopDate: string;
  workshopTime: string;
  roomName: string;
  qrCodeDataUrl: string;
}

export async function sendRegistrationConfirmationEmail(
  props: SendRegistrationEmailProps
) {
  // Skip if Resend is not configured
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log('[Email Skipped] RESEND_API_KEY not configured');
    return { success: true, skipped: true };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: props.studentEmail,
      subject: `Xac nhan dang ky: ${props.workshopTitle}`,
      html: `
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
                <img src="${props.qrCodeDataUrl}" alt="QR Code" style="width: 200px; height: 200px; display: block;" />
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
      `,
    });

    if (result.error) {
      console.error('[Email Error]', result.error);
      return { success: false, error: result.error };
    }

    console.log('[Email Sent]', result.data?.id);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('[Email Exception]', error);
    return { success: false, error: String(error) };
  }
}
