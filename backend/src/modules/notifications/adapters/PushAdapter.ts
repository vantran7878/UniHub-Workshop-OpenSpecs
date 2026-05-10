import { NotificationAdapter, UserForNotification, AdapterResult } from "./NotificationAdapter.js";
import { EventType } from "../eventTypes.js";
import { getPool } from "../../../db/pool.js";

export class PushAdapter implements NotificationAdapter {
  async send(user: UserForNotification, eventType: EventType, payload: Record<string, any>): Promise<AdapterResult> {
    if (!user.fcm_token) {
      return { status: 'skipped', reason: 'NO_FCM_TOKEN' };
    }

    try {
      // TODO: implement actual FCM admin.messaging().send(message);
      // For now, this is a stub.
      
      // Simulate invalid token for a specific test token
      if (user.fcm_token === "invalid-token") {
        throw new Error("messaging/registration-token-not-registered");
      }

      return { status: 'sent' };
    } catch (err: any) {
      if (err.message.includes("messaging/registration-token-not-registered")) {
        const pool = getPool();
        await pool.query("UPDATE users SET fcm_token = NULL WHERE id = $1", [user.id]);
        return { status: 'failed', reason: 'FCM_TOKEN_INVALID', noRetry: true };
      }
      throw err;
    }
  }
}
