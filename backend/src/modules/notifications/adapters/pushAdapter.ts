import { NotificationAdapter, NotificationResult } from "../notificationService.js";
import { NotificationEventType, NotificationPayload } from "../eventTypes.js";

export class PushAdapter implements NotificationAdapter {
  async send(
    user: { fcm_token: string | null },
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    if (!user.fcm_token) {
      return { status: "skipped", reason: "NO_FCM_TOKEN" };
    }

    // FCM Placeholder logic
    console.log(`[PushAdapter] (STUB) Sending PUSH to token: ${user.fcm_token.substring(0, 10)}...`);
    console.log(`[PushAdapter] Title: ${this.resolveTitle(eventType, payload)}`);
    console.log(`[PushAdapter] Body: ${this.resolveBody(eventType, payload)}`);

    // Simulate occasional failure for testing retries if needed, 
    // but for now let's just succeed.
    return { status: "sent" };
  }

  private resolveTitle(eventType: NotificationEventType, payload: NotificationPayload): string {
    switch (eventType) {
      case NotificationEventType.REGISTRATION_CONFIRMED_FREE:
        return "Đăng ký thành công";
      case NotificationEventType.REGISTRATION_CONFIRMED_PAID:
        return "Thanh toán thành công";
      case NotificationEventType.REGISTRATION_CANCELLED:
        return "Đăng ký đã bị hủy";
      case NotificationEventType.WORKSHOP_UPDATED:
        return "Workshop có thay đổi";
      case NotificationEventType.WORKSHOP_CANCELLED:
        return "Workshop bị hủy";
      case NotificationEventType.CHECKIN_CONFIRMED:
        return "Check-in thành công";
      case NotificationEventType.PAYMENT_FAILED:
        return "Thanh toán thất bại";
      default:
        return "Thông báo mới từ UniHub";
    }
  }

  private resolveBody(eventType: NotificationEventType, payload: NotificationPayload): string {
    switch (eventType) {
      case NotificationEventType.REGISTRATION_CONFIRMED_FREE:
        return `Bạn đã đăng ký ${payload.workshopTitle}. Xem mã QR.`;
      case NotificationEventType.REGISTRATION_CONFIRMED_PAID:
        return `Đăng ký ${payload.workshopTitle} đã được xác nhận.`;
      case NotificationEventType.REGISTRATION_CANCELLED:
        return `Đăng ký workshop ${payload.workshopTitle} đã bị hủy.`;
      case NotificationEventType.WORKSHOP_UPDATED:
        return `${payload.workshopTitle} đã đổi giờ/phòng. Kiểm tra ngay.`;
      case NotificationEventType.WORKSHOP_CANCELLED:
        return `Workshop ${payload.workshopTitle} đã bị hủy bởi BTC.`;
      case NotificationEventType.CHECKIN_CONFIRMED:
        return `Chào mừng bạn đến ${payload.workshopTitle}!`;
      case NotificationEventType.PAYMENT_FAILED:
        return `Thanh toán cho ${payload.workshopTitle} chưa thành công.`;
      default:
        return `Bạn có thông báo mới cho workshop ${payload.workshopTitle || ""}`;
    }
  }
}
