import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { NotificationAdapter, NotificationResult } from "../notificationService.js";
import { NotificationEventType, NotificationPayload } from "../eventTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class EmailAdapter implements NotificationAdapter {
  private transporter: nodemailer.Transporter;
  private templatesDir: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port: Number(process.env.SMTP_PORT || 1025),
      secure: false, // true for 465, false for other ports
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });

    this.templatesDir = path.join(__dirname, "../templates/email");
  }

  async send(
    user: { email: string; full_name: string },
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    if (!user.email) {
      return { status: "skipped", reason: "NO_EMAIL" };
    }

    try {
      const templatePath = path.join(this.templatesDir, `${eventType}.hbs`);
      const templateSource = await fs.readFile(templatePath, "utf-8");
      const template = handlebars.compile(templateSource);

      const html = template({ 
        userName: user.full_name, 
        baseUrl: process.env.BASE_URL || "http://localhost:3000",
        ...payload 
      });

      const subject = this.resolveSubject(eventType, payload);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"UniHub" <no-reply@unihub.edu.vn>',
        to: user.email,
        subject: subject,
        html: html,
      });

      return { status: "sent" };
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error(`Template not found for event: ${eventType}`);
      }
      throw error;
    }
  }

  private resolveSubject(eventType: NotificationEventType, payload: NotificationPayload): string {
    switch (eventType) {
      case NotificationEventType.REGISTRATION_CONFIRMED_FREE:
        return `Đăng ký thành công: ${payload.workshopTitle}`;
      case NotificationEventType.REGISTRATION_CONFIRMED_PAID:
        return `Đăng ký & thanh toán thành công: ${payload.workshopTitle}`;
      case NotificationEventType.REGISTRATION_CANCELLED:
        return `Thông báo hủy đăng ký: ${payload.workshopTitle}`;
      case NotificationEventType.WORKSHOP_UPDATED:
        return `Thông tin workshop đã thay đổi: ${payload.workshopTitle}`;
      case NotificationEventType.WORKSHOP_CANCELLED:
        return `Workshop đã bị hủy: ${payload.workshopTitle}`;
      default:
        return `Thông báo từ UniHub: ${payload.workshopTitle || ""}`;
    }
  }
}
