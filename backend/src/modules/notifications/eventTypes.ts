export enum NotificationEventType {
  REGISTRATION_CONFIRMED_FREE = "REGISTRATION_CONFIRMED_FREE",
  REGISTRATION_CONFIRMED_PAID = "REGISTRATION_CONFIRMED_PAID",
  REGISTRATION_CANCELLED = "REGISTRATION_CANCELLED",
  WORKSHOP_UPDATED = "WORKSHOP_UPDATED",
  WORKSHOP_CANCELLED = "WORKSHOP_CANCELLED",
  CHECKIN_CONFIRMED = "CHECKIN_CONFIRMED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
}

export type NotificationChannel = "email" | "push";

export const EVENT_CHANNEL_MAP: Record<NotificationEventType, NotificationChannel[]> = {
  [NotificationEventType.REGISTRATION_CONFIRMED_FREE]: ["email", "push"],
  [NotificationEventType.REGISTRATION_CONFIRMED_PAID]: ["email", "push"],
  [NotificationEventType.REGISTRATION_CANCELLED]: ["email", "push"],
  [NotificationEventType.WORKSHOP_UPDATED]: ["email", "push"],
  [NotificationEventType.WORKSHOP_CANCELLED]: ["email", "push"],
  [NotificationEventType.CHECKIN_CONFIRMED]: ["push"],
  [NotificationEventType.PAYMENT_FAILED]: ["push"],
};

export interface NotificationPayload {
  workshopTitle: string;
  workshopDate: string;
  workshopRoom?: string;
  speakerName?: string;
  qrCode?: string;
  price?: number | null;
  [key: string]: any;
}

export interface NotificationQueuePayload {
  eventId: string;
  eventType: NotificationEventType;
  userId: string;
  workshopId: string;
  registrationId: string | null;
  payload: NotificationPayload;
  publishedAt: string;
  retryCount?: number;
}

export const QUEUE_NOTIFICATION = "notification.queue";
export const QUEUE_NOTIFICATION_RETRY = "notification.retry";
