import { consumeJson, publishJson } from "../../rabbitmq/client.js";
import { getPool } from "../../db/pool.js";
import { NotificationQueuePayload, QUEUE_NOTIFICATION, QUEUE_NOTIFICATION_RETRY, EVENT_CHANNEL_MAP, EventType } from "./eventTypes.js";
import { EmailAdapter } from "./adapters/EmailAdapter.js";
import { PushAdapter } from "./adapters/PushAdapter.js";
import { NotificationAdapter, UserForNotification } from "./adapters/NotificationAdapter.js";

const adapters: Record<string, NotificationAdapter> = {
  email: new EmailAdapter(),
  push: new PushAdapter(),
};

export async function runNotificationWorker() {
  console.log("Starting notification worker...");
  
  // Need raw channel to assert the retry queue with DLX
  const ch = await (await import("../../rabbitmq/client.js")).getAmqpChannel();
  
  // Assert main queue
  await ch.assertQueue(QUEUE_NOTIFICATION, { durable: true });
  
  // Assert retry queue with DLX back to main queue
  await ch.assertQueue(QUEUE_NOTIFICATION_RETRY, {
    durable: true,
    deadLetterExchange: "",
    deadLetterRoutingKey: QUEUE_NOTIFICATION,
    messageTtl: 60000
  });

  await consumeJson(QUEUE_NOTIFICATION, async ({ body }) => {
    const payload = body as NotificationQueuePayload;
    const pool = getPool();

    const channels = EVENT_CHANNEL_MAP[payload.eventType];
    if (!channels) {
      console.warn(`Unknown eventType: ${payload.eventType}`);
      return;
    }

    const res = await pool.query(`SELECT id, email, full_name, fcm_token FROM users WHERE id = $1`, [payload.userId]);
    if (res.rows.length === 0) {
      console.warn(`User not found: ${payload.userId} for event ${payload.eventId}`);
      return;
    }
    const user = res.rows[0] as UserForNotification;

    const promises = channels.map(async (channel) => {
      const adapter = adapters[channel];
      if (!adapter) return { channel, status: 'failed' as const, reason: `Adapter not configured for channel ${channel}` };

      try {
        const result = await adapter.send(user, payload.eventType, payload.payload);
        return { channel, ...result };
      } catch (err: any) {
        return { channel, status: 'failed' as const, reason: err.message || String(err) };
      }
    });

    const results = await Promise.allSettled(promises);
    let hasFailure = false;
    let failReason = "";

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const r = result.value;
        const statusToInsert = r.status;
        
        if (statusToInsert === 'failed' && !r.noRetry) {
          hasFailure = true;
          failReason = r.reason || "Unknown error";
        }
        
        await pool.query(
          `INSERT INTO notification_logs (event_id, event_type, user_id, channel, status, reason, payload, retry_count, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            payload.eventId,
            payload.eventType,
            payload.userId,
            r.channel,
            statusToInsert,
            r.reason || null,
            payload.payload,
            payload.retryCount || 0,
            statusToInsert === 'sent' ? new Date() : null
          ]
        );
      } else {
        hasFailure = true;
        failReason = result.reason?.message || String(result.reason);
      }
    }

    if (hasFailure) {
      const retryCount = payload.retryCount || 0;
      if (retryCount < 3) {
        await publishJson(QUEUE_NOTIFICATION_RETRY, {
          ...payload,
          retryCount: retryCount + 1,
          failedAt: new Date().toISOString(),
          failReason
        });
      } else {
        console.error(`Event ${payload.eventId} failed after 3 retries.`);
      }
    }
  });
}
