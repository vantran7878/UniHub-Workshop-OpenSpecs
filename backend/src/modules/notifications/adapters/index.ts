import { NotificationEventType, NotificationQueuePayload } from "../../eventTypes";

export interface NotificationAdapterResponse {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

export interface NotificationAdapter {
  name: string;
  send(
    user: { id: string; email: string; fullName: string; fcmToken?: string },
    eventType: NotificationEventType,
    payload: NotificationQueuePayload["payload"]
  ): Promise<NotificationAdapterResponse>;
}
