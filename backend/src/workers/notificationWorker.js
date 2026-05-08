const db = require('../config/db');
const { connectRabbitMQ } = require('../config/rabbitmq');
const { EVENT_CHANNEL_MAP } = require('../notifications/config/channels');
const EmailAdapter = require('../notifications/adapters/EmailAdapter');
const PushAdapter = require('../notifications/adapters/PushAdapter');

const adapters = {
  email: new EmailAdapter(),
  push: new PushAdapter()
};

async function startWorker() {
  const { channel } = await connectRabbitMQ();
  
  channel.prefetch(10);
  console.log('Notification Worker waiting for messages...');

  channel.consume('notification.queue', async (msg) => {
    if (!msg) return;

    const event = JSON.parse(msg.content.toString());
    const { eventId, eventType, userId, payload, retryCount = 0 } = event;

    console.log(`Processing ${eventType} for user ${userId} (Retry: ${retryCount})`);

    try {
      // 1. Fetch user info
      const userRes = await db.query('SELECT id, email, full_name, fcm_token FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        console.warn(`User ${userId} not found. Skipping.`);
        channel.ack(msg);
        return;
      }
      const user = userRes.rows[0];

      // 2. Resolve channels
      const targetChannels = EVENT_CHANNEL_MAP[eventType] || [];
      
      // 3. Dispatch concurrently
      const results = await Promise.allSettled(
        targetChannels.map(async (channelName) => {
          const adapter = adapters[channelName];
          if (!adapter) return { channel: channelName, status: 'skipped', reason: 'ADAPTER_NOT_FOUND' };

          try {
            const result = await adapter.send(user, eventType, payload);
            
            // 4. Log result
            await db.query(
              `INSERT INTO notification_logs (event_id, user_id, channel, status, retry_count, error_details)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [eventId, userId, channelName, result.status, retryCount, JSON.stringify(result.reason || null)]
            );

            return { channel: channelName, ...result };
          } catch (err) {
            // Log failure
            await db.query(
              `INSERT INTO notification_logs (event_id, user_id, channel, status, retry_count, error_details)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [eventId, userId, channelName, 'failed', retryCount, JSON.stringify(err.message)]
            );
            throw err;
          }
        })
      );

      // 5. Handle retries for failed dispatches
      const anyFailed = results.some(r => r.status === 'rejected');
      if (anyFailed && retryCount < 3) {
        console.log(`Requeuing event ${eventId} for retry...`);
        channel.sendToQueue('notification.retry', Buffer.from(JSON.stringify({
          ...event,
          retryCount: retryCount + 1
        })));
      }

      channel.ack(msg);
    } catch (err) {
      console.error(`Worker error for event ${eventId}:`, err);
      // In case of global error, NACK with requeue if retry count allows
      channel.nack(msg, false, false); 
    }
  });
}

if (require.main === module) {
  startWorker().catch(err => {
    console.error('Worker failed to start:', err);
    process.exit(1);
  });
}

module.exports = { startWorker };
