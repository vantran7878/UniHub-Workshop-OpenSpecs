import "dotenv/config";
import { getAmqpChannel, consumeJson } from "../../rabbitmq/client.js";
import { NotificationService } from "./notificationService.js";
import { EmailAdapter } from "./adapters/emailAdapter.js";
import { PushAdapter } from "./adapters/pushAdapter.js";
import { 
  QUEUE_NOTIFICATION, 
  QUEUE_NOTIFICATION_RETRY,
  NotificationQueuePayload, 
  NotificationEventType, 
  NotificationPayload 
} from "./eventTypes.js";

// Initialize service with real adapters
const service = new NotificationService({
  email: new EmailAdapter(),
  push: new PushAdapter(),
});

console.log("Notification Worker starting...");

async function init() {
  const ch = await getAmqpChannel();
  
  // Assert main queue
  await ch.assertQueue(QUEUE_NOTIFICATION, { durable: true });

  // Assert retry queue with TTL and DLX (Dead Letter Exchange)
  // After 60s, messages from this queue go back to the main queue
  await ch.assertQueue(QUEUE_NOTIFICATION_RETRY, {
    durable: true,
    arguments: {
      "x-message-ttl": 60000,
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": QUEUE_NOTIFICATION,
    },
  });

  await consumeJson(QUEUE_NOTIFICATION, async ({ body }) => {
    const event = body as NotificationQueuePayload;
    console.log(`Processing event ${event.eventId} (${event.eventType}) for user ${event.userId}`);
    await service.processNotification(event);
  });
}

init().catch((err) => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
