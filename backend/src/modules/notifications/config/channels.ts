import { NotificationEventType } from "../../eventTypes";

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
