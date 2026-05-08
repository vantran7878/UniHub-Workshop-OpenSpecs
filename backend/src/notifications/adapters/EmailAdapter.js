const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

class EmailAdapter {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'localhost',
      port: process.env.EMAIL_PORT || 1025, // MailHog default
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    this.templateCache = new Map();
  }

  async loadTemplate(eventType) {
    if (this.templateCache.has(eventType)) return this.templateCache.get(eventType);

    const templatePath = path.join(__dirname, '../templates/email', `${eventType}.hbs`);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found for event type: ${eventType}`);
    }

    const source = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(source);
    this.templateCache.set(eventType, template);
    return template;
  }

  resolveSubject(eventType, payload) {
    const subjects = {
      REGISTRATION_CONFIRMED_FREE: `Đăng ký thành công: ${payload.workshopTitle}`,
      REGISTRATION_CONFIRMED_PAID: `Đăng ký & Thanh toán thành công: ${payload.workshopTitle}`,
      REGISTRATION_CANCELLED: `Thông báo hủy đăng ký: ${payload.workshopTitle}`,
      WORKSHOP_UPDATED: `Thông tin workshop thay đổi: ${payload.workshopTitle}`,
      WORKSHOP_CANCELLED: `Workshop đã bị hủy: ${payload.workshopTitle}`
    };
    return subjects[eventType] || 'Thông báo từ UniHub Workshop';
  }

  async send(user, eventType, payload) {
    if (!user.email) return { status: 'skipped', reason: 'NO_EMAIL' };

    const template = await this.loadTemplate(eventType);
    const html = template({ userName: user.full_name, ...payload });
    const subject = this.resolveSubject(eventType, payload);

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || '"UniHub Workshop" <no-reply@unihub.edu.vn>',
      to: user.email,
      subject: subject,
      html: html
    });

    return { status: 'sent' };
  }
}

module.exports = EmailAdapter;
