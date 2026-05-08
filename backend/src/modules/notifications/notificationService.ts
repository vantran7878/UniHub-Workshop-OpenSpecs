import { getPool } from "../../db/pool.js";
import { 
  NotificationEventType, 
  NotificationChannel, 
  EVENT_CHANNEL_MAP, 
  NotificationPayload,
  NotificationQueuePayload,
  QUEUE_NOTIFICATION_RETRY
} from "./eventTypes.js";
import { publishJson } from "../../rabbitmq/client.js";

export interface NotificationResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

export interface NotificationAdapter {
  send(
    user: { id: string; email: string; full_name: string; fcm_token: string | null },
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): Promise<NotificationResult>;
}

export class NotificationService {
  private adapters: Record<NotificationChannel, NotificationAdapter>;

  constructor(adapters: Record<NotificationChannel, NotificationAdapter>) {
    this.adapters = adapters;
  }

  async processNotification(event: NotificationQueuePayload) {
    const pool = getPool();
    
    // 1. Fetch user details
    const userRes = await pool.query(
      "SELECT id, email, full_name, fcm_token FROM users WHERE id = $1",
      [event.userId]
    );

    if (userRes.rowCount === 0) {
      console.warn(`User not found: ${event.userId} for event ${event.eventId}`);
      await this.logNotification(event, "unknown", "failed", "USER_NOT_FOUND");
      return;
    }

    const user = userRes.rows[0];
    const channels = EVENT_CHANNEL_MAP[event.eventType];

    if (!channels) {
      console.warn(`Unknown event type: ${event.eventType}`);
      return;
    }

    // 2. Send via each channel
    const results = await Promise.allSettled(
      channels.map(async (channel) => {
        const adapter = this.adapters[channel];
        if (!adapter) {
          return { channel, result: { status: "skipped", reason: "ADAPTER_NOT_FOUND" } as NotificationResult };
        }

        try {
          const result = await adapter.send(user, event.eventType, event.payload);
          await this.logNotification(event, channel, result.status, result.reason);
          return { channel, result };
        } catch (error: any) {
          console.error(`Error sending ${channel} notification for ${event.eventId}:`, error);
          await this.logNotification(event, channel, "failed", error.message);
          return { channel, result: { status: "failed", reason: error.message } as NotificationResult };
        }
      })
    );

    // 3. Handle Retries
    const hasFailed = results.some((r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.result.status === "failed"));
    
    if (hasFailed) {
      const retryCount = (event.retryCount ?? 0) + 1;
      if (retryCount <= 3) {
        await publishJson(QUEUE_NOTIFICATION_RETRY, {
          ...event,
          retryCount
        });
      } else {
        console.error(`Max retries reached for event ${event.eventId}`);
      }
    }
  }

  private async logNotification(
    event: NotificationQueuePayload,
    channel: string,
    status: string,
    reason?: string
  ) {
    const pool = getPool();
    await pool.query(
      `INSERT INTO notification_logs 
       (event_id, event_type, user_id, channel, status, reason, payload, retry_count, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.eventId,
        event.eventType,
        event.userId,
        channel,
        status,
        reason || null,
        event.payload,
        event.retryCount ?? 0,
        status === "sent" ? new Date() : null
      ]
    );
  }
}
