import nodemailer from "nodemailer";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { NotificationAdapter, NotificationAdapterResponse } from "./index";
import { NotificationEventType, NotificationQueuePayload } from "../../eventTypes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class EmailAdapter implements NotificationAdapter {
  name = "email";
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "localhost",
      port: parseInt(process.env.EMAIL_PORT || "1025"),
      secure: process.env.EMAIL_SECURE === "true",
      auth: process.env.EMAIL_USER ? {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      } : undefined,
    });
  }

  async send(
    user: { id: string; email: string; fullName: string },
    eventType: NotificationEventType,
    payload: NotificationQueuePayload["payload"]
  ): Promise<NotificationAdapterResponse> {
    if (!user.email) {
      return { status: "skipped", reason: "NO_EMAIL" };
    }

    try {
      const templatePath = path.join(__dirname, "..", "templates", "email", `${eventType}.hbs`);
      const templateSource = await fs.readFile(templatePath, "utf-8");
      const template = handlebars.compile(templateSource);

      const html = template({
        userName: user.fullName,
        ...payload,
        baseUrl: process.env.BASE_URL || "http://localhost:3000",
      });

      const subject = this.resolveSubject(eventType, payload);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || "no-reply@unihub.edu.vn",
        to: user.email,
        subject: subject,
        html: html,
      });

      return { status: "sent" };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        console.error(`Template not found for event type: ${eventType}`);
        return { status: "failed", reason: "TEMPLATE_NOT_FOUND" };
      }
      throw err;
    }
  }

  private resolveSubject(eventType: NotificationEventType, payload: any): string {
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
        return "Thông báo từ UniHub Workshop";
    }
  }
}
