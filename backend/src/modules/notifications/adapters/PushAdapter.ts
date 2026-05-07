import { NotificationAdapter, NotificationAdapterResponse } from "./index";
import { NotificationEventType, NotificationQueuePayload } from "../../eventTypes";

export class PushAdapter implements NotificationAdapter {
  name = "push";

  async send(
    user: { id: string; fullName: string; fcmToken?: string },
    eventType: NotificationEventType,
    payload: NotificationQueuePayload["payload"]
  ): Promise<NotificationAdapterResponse> {
    if (!user.fcmToken) {
      return { status: "skipped", reason: "NO_FCM_TOKEN" };
    }

    console.log(`[Push Stub] Sending push to user ${user.id} (${user.fcmToken}) for event ${eventType}`);
    
    // In a real implementation, we would use firebase-admin:
    // await admin.messaging().send({
    //   token: user.fcmToken,
    //   notification: {
    //     title: this.resolveTitle(eventType),
    //     body: this.resolveBody(eventType, payload),
    //   },
    //   data: { eventType, workshopId: String(event.workshopId || "") }
    // });

    return { status: "sent" };
  }

  private resolveTitle(eventType: NotificationEventType): string {
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
        return "Thông báo mới";
    }
  }

  private resolveBody(eventType: NotificationEventType, payload: any): string {
    const title = payload.workshopTitle || "Workshop";
    switch (eventType) {
      case NotificationEventType.REGISTRATION_CONFIRMED_FREE:
        return `Bạn đã đăng ký ${title}. Xem mã QR.`;
      case NotificationEventType.REGISTRATION_CONFIRMED_PAID:
        return `Đăng ký ${title} đã được xác nhận.`;
      case NotificationEventType.REGISTRATION_CANCELLED:
        return `Đăng ký workshop ${title} đã bị hủy.`;
      case NotificationEventType.WORKSHOP_UPDATED:
        return `${title} đã đổi giờ/phòng. Kiểm tra ngay.`;
      case NotificationEventType.WORKSHOP_CANCELLED:
        return `Workshop ${title} đã bị hủy bởi BTC.`;
      case NotificationEventType.CHECKIN_CONFIRMED:
        return `Chào mừng bạn đến ${title}!`;
      case NotificationEventType.PAYMENT_FAILED:
        return `Thanh toán cho ${title} chưa thành công.`;
      default:
        return "Bạn có một thông báo mới.";
    }
  }
}
