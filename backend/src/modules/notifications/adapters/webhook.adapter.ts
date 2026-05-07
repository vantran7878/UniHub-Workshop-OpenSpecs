import { NotificationAdapter, WebhookPayload } from '../config/notification.types';
import { v4 as uuid } from 'uuid';

export const webhookAdapter: NotificationAdapter = {
  async send(
    { to, subject, html },
    eventEmitter,
  ): Promise<boolean> {
    const webhooks = (to as string).split(',').map((url) => url.trim());

    for (const url of webhooks) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use a simple HMAC-style signature if we have a webhook secret
            ...(process.env.WEBHOOK_SECRET && {
              Authorization: `Bearer ${process.env.WEBHOOK_SECRET}`,
            }),
          },
          body: JSON.stringify({
            id: uuid(),
            event: subject,
            payload: html ?? {},
            timestamp: new Date().toISOString(),
          } as WebhookPayload),
        });

        if (!response.ok) {
          console.error(
            `[WebhookAdapter] Failed to send to ${url}:`,
            response.status,
          );
          eventEmitter.emit('webhook.failed', { to: url, error: 'HTTP error' });
          continue;
        }

        const json = await response.json();
        console.log(`[WebhookAdapter] Sent to ${url}`);
        eventEmitter.emit('webhook.sent', { to: url });
      } catch (err) {
        console.error(
          `[WebhookAdapter] Failed to send to ${url}:`,
          (err as Error).message,
        );
        eventEmitter.emit('webhook.failed', { to: url, error: err });
      }
    }

    return true;
  },
};
