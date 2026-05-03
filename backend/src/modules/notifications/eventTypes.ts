/** RabbitMQ notification.queue payload shapes — aligned with notification spec. */

export type NotificationQueuePayload = {
  eventId: string;
  eventType: string;
  userId: string;
  workshopId: string;
  registrationId: string | null;
  payload: Record<string, unknown>;
  publishedAt: string;
};

export const QUEUE_NOTIFICATION = "notification.queue";
