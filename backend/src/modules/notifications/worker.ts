import { Transport, SendMailOptions } from 'nodemailer';
import * as ejs from 'ejs';

export interface NotificationWorkerConfig {
  email: Transport;
}

export class NotificationWorker {
  private config: NotificationWorkerConfig;
  private templatesDir: string;
  private logQueue: Array<{ event: string; payload: any }> = [];

  constructor(config: NotificationWorkerConfig, templatesDir: string) {
    this.config = config;
    this.templatesDir = templatesDir;
  }

  async sendEmail(
    to: string,
    subject: string,
    body: string,
    from?: string,
    cc?: string | string[],
    bcc?: string | string[]
  ): Promise<void> {
    const templatePath = `${this.templatesDir}/email-template.hbs`;

    if (from) {
      const transport = await this.getTransport(this.config.email);
      await this.renderAndSendEmail(transport, to, subject, body, from);
    } else {
      const transport = await this.getTransport(this.config.email);
      const renderedBody = await this.renderTemplate(templatePath, body);
      const sendOptions: SendMailOptions = {
        from: this.config.email.from,
        to,
        subject,
        html: renderedBody,
      };
      await transport.sendMail(sendOptions);
    }
  }

  private async renderAndSendEmail(
    transport: Transport,
    to: string,
    subject: string,
    body: string
  ): Promise<void> {
    const templatePath = `${this.templatesDir}/email-template.hbs`;
    const renderedBody = await this.renderTemplate(templatePath, body);

    const sendOptions: SendMailOptions = {
      from,
      to,
      subject,
      html: renderedBody,
    };

    if (bcc) {
      sendOptions.bcc = bcc;
    }

    await transport.sendMail(sendOptions);
  }

  private async renderTemplate(
    templatePath: string,
    data: any
  ): Promise<string> {
    try {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const html = ejs.render(templateContent, data);
      return html;
    } catch (error) {
      console.error(`Template render failed for ${templatePath}`, error);
      return '';
    }
  }

  private async getTransport(transport: any): Promise<Transport> {
    if ('sendMail' in transport && typeof (transport as any).sendMail === 'function') {
      return transport;
    }
    throw new Error('Invalid transporter');
  }

  sendWebhook(payload: any, url: string, headers?: Record<string, string>): Promise<void> {
    return fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async queueNotification(event: string, payload: any): Promise<void> {
    this.logQueue.push({ event, payload });
  }

  async flushQueue(): Promise<void> {
    while (this.logQueue.length > 0) {
      const item = this.logQueue.shift();
      if (!item) continue;

      try {
        await this.sendWebhook(item.payload);
      } catch (error) {
        console.error('Notification flush failed:', error);
      }
    }
  }

  async retryFailedNotifications(maxRetries: number = 3): Promise<void> {
    const now = Date.now();
    while (this.logQueue.length > 0 && now < this.config.retryUntil) {
      const item = this.logQueue.shift();
      if (!item) continue;

      try {
        await this.sendWebhook(item.payload);
      } catch (error) {
        console.error('Notification retry failed:', error);
      }
    }
  }
}
