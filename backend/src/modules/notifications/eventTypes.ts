/** RabbitMQ notification.queue payload shapes — aligned with notification spec. */

export type EventType = 
  | 'REGISTRATION_CONFIRMED_FREE'
  | 'REGISTRATION_CONFIRMED_PAID'
  | 'REGISTRATION_CANCELLED'
  | 'WORKSHOP_UPDATED'
  | 'WORKSHOP_CANCELLED'
  | 'CHECKIN_CONFIRMED'
  | 'PAYMENT_FAILED';

export type NotificationQueuePayload = {
  eventId: string;
  eventType: EventType;
  userId: string;
  workshopId?: string;
  registrationId?: string;
  payload: Record<string, any>;
  publishedAt: string;
  retryCount?: number;
  failedAt?: string;
  failReason?: string;
};

export const QUEUE_NOTIFICATION = "notification.queue";
export const QUEUE_NOTIFICATION_RETRY = "notification.retry";

export const EVENT_CHANNEL_MAP: Record<EventType, string[]> = {
  REGISTRATION_CONFIRMED_FREE: ['email', 'push'],
  REGISTRATION_CONFIRMED_PAID: ['email', 'push'],
  REGISTRATION_CANCELLED:      ['email', 'push'],
  WORKSHOP_UPDATED:            ['email', 'push'],
  WORKSHOP_CANCELLED:          ['email', 'push'],
  CHECKIN_CONFIRMED:           ['push'],
  PAYMENT_FAILED:              ['push'],
};
