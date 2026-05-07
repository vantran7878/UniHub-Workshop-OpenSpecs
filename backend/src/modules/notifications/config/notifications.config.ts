export interface EmailConfig {
  from: string;
  host: string;
  port: number;
  secure: boolean;
}

export interface SmtpConfig extends EmailConfig {
  auth: {
    user: string;
    pass: string;
  };
}

export interface WebhookConfig {
  provider: 'custom' | 'zendesk' | 'intercom';
  url: string;
  headers?: Record<string, string>;
}

export const emailConfig: EmailConfig = {
  from: process.env.EMAIL_FROM || 'notifications@unihub.dev',
  host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
};

export const smtpConfig: SmtpConfig = {
  ...emailConfig,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
};

export const webhookConfig: WebhookConfig = {
  provider: process.env.WEBHOOK_PROVIDER || 'custom',
  url: process.env.WEBHOOK_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
};
