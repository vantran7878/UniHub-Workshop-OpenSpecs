import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import handlebars from "handlebars";
import { NotificationAdapter, UserForNotification, AdapterResult } from "./NotificationAdapter.js";
import { EventType } from "../eventTypes.js";

const subjects: Record<string, (payload: any) => string> = {
  REGISTRATION_CONFIRMED_FREE: (p) => `Dang ky thanh cong: ${p.workshopTitle || p.title}`,
  REGISTRATION_CONFIRMED_PAID: (p) => `Dang ky & thanh toan thanh cong: ${p.workshopTitle || p.title}`,
  REGISTRATION_CANCELLED:      (p) => `Thong bao huy dang ky: ${p.workshopTitle || p.title}`,
  WORKSHOP_UPDATED:            (p) => `Thong tin workshop da thay doi: ${p.workshopTitle || p.title}`,
  WORKSHOP_CANCELLED:          (p) => `Workshop da bi huy: ${p.workshopTitle || p.title}`,
};

export class EmailAdapter implements NotificationAdapter {
  private transporter: nodemailer.Transporter;
  private templateCache: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port: Number(process.env.SMTP_PORT) || 1025,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  }

  private async loadTemplate(eventType: string): Promise<handlebars.TemplateDelegate> {
    if (this.templateCache.has(eventType)) {
      return this.templateCache.get(eventType)!;
    }

    const templatePath = path.join(process.cwd(), "src", "modules", "notifications", "templates", "email", `${eventType}.hbs`);
    let source: string;
    try {
      source = await fs.readFile(templatePath, "utf-8");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(`TemplateNotFoundError: ${eventType}.hbs`);
      }
      throw err;
    }

    const template = handlebars.compile(source);
    this.templateCache.set(eventType, template);
    return template;
  }

  async send(user: UserForNotification, eventType: EventType, payload: Record<string, any>): Promise<AdapterResult> {
    if (!user.email) {
      return { status: 'skipped', reason: 'NO_EMAIL' };
    }

    const templateFn = await this.loadTemplate(eventType);
    const html = templateFn({ userName: user.full_name, ...payload });
    
    const resolveSubject = subjects[eventType];
    const subject = resolveSubject ? resolveSubject(payload) : "Notification";

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || '"UniHub" <no-reply@unihub.local>',
      to: user.email,
      subject,
      html
    });

    return { status: 'sent' };
  }
}

