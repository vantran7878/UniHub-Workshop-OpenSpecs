import { EventType } from "../eventTypes.js";

export type UserForNotification = {
  id: string;
  email: string | null;
  full_name: string;
  fcm_token: string | null;
};

export type AdapterResult = {
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
  noRetry?: boolean;
};

export interface NotificationAdapter {
  send(
    user: UserForNotification,
    eventType: EventType,
    payload: Record<string, any>
  ): Promise<AdapterResult>;
}
