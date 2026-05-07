import { v4 as uuidv4 } from 'uuid';

// Email fixture
export const emailFixture: any = {
  id: 'email_' + uuidv4(),
  notificationId: uuidv4(),
  channelType: 'EMAIL',
  to: ['john.doe@example.com'],
  subject: 'Test Event Notification',
  body: 'This is a test notification email.',
  attachments: [],
  status: 'SENT' as const,
};

// SMS fixture
export const smsFixture: any = {
  id: 'sms_' + uuidv4(),
  notificationId: uuidv4(),
  channelType: 'SMS',
  to: '+1234567890',
  message: 'Your verification code is 123456.',
};

// Webhook fixture
export const webhookFixture: any = {
  id: 'webhook_' + uuidv4(),
  notificationId: uuidv4(),
  channelType: 'WEBHOOK',
  url: 'https://api.example.com/webhooks',
  payload: { event: 'test-event' },
  status: 'SENT' as const,
};
