import { NotificationAdapter, EmailMessage } from '../config/notification.types';
import * as nodemailer from 'nodemailer';

export const emailAdapter: NotificationAdapter = {
  send(
    { to, subject, html, text },
    eventEmitter,
  ): Promise<boolean> {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST ?? 'localhost',
      port: parseInt(process.env.EMAIL_PORT ?? '1025'),
      secure: process.env.EMAIL_SECURE ?? 'false' === 'true',
      auth:
        process.env.EMAIL_USER && process.env.EMAIL_PASS
          ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
          : undefined,
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.EMAIL_FROM ?? 'noreply@unihub.local',
      to,
      subject,
      html,
      text,
      headers: {
        ...(process.env.EMAIL_REPLY_TO && { replyTo: process.env.EMAIL_REPLY_TO }),
      },
    };

    return transporter
      .sendMail(mailOptions)
      .then(() => {
        console.log(`[EmailAdapter] Sent to ${to}: ${subject}`);
        eventEmitter.emit('email.sent', { to, subject });
        return true;
      })
      .catch((err) => {
        console.error(`[EmailAdapter] Failed to send to ${to}:`, err.message);
        // Don't fail the event flow unless it's critical
        eventEmitter.emit('email.failed', { to, error: err.message });
        return true;
      });
  },
};
