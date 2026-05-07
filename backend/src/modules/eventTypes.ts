/** RabbitMQ notification.queue payload shapes — aligned with notification spec. */

export enum NotificationEventType {
  REGISTRATION_CONFIRMED_FREE = "REGISTRATION_CONFIRMED_FREE",
  REGISTRATION_CONFIRMED_PAID = "REGISTRATION_CONFIRMED_PAID",
  REGISTRATION_CANCELLED = "REGISTRATION_CANCELLED",
  WORKSHOP_UPDATED = "WORKSHOP_UPDATED",
  WORKSHOP_CANCELLED = "WORKSHOP_CANCELLED",
  CHECKIN_CONFIRMED = "CHECKIN_CONFIRMED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
}

export type NotificationQueuePayload = {
  eventId: string;
  eventType: NotificationEventType;
  userId: string;
  workshopId: string;
  registrationId: string | null;
  payload: {
    workshopTitle?: string;
    workshopDate?: string;
    workshopRoom?: string;
    speakerName?: string;
    qrCode?: string;
    price?: number | null;
    [key: string]: unknown;
  };
  publishedAt: string;
  retryCount?: number;
};

export const QUEUE_NOTIFICATION = "notification.queue";
export const QUEUE_NOTIFICATION_RETRY = "notification.retry";
