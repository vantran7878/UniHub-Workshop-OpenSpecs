const admin = require('firebase-admin');
const db = require('../../config/db');

// Initialize only once
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 && !admin.apps.length) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString());
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

class PushAdapter {
  resolveTitle(eventType, payload) {
    const titles = {
      REGISTRATION_CONFIRMED_FREE: 'Đăng ký thành công',
      REGISTRATION_CONFIRMED_PAID: 'Thanh toán thành công',
      REGISTRATION_CANCELLED: 'Đăng ký đã bị hủy',
      WORKSHOP_UPDATED: 'Workshop có thay đổi',
      WORKSHOP_CANCELLED: 'Workshop bị hủy',
      CHECKIN_CONFIRMED: 'Check-in thành công',
      PAYMENT_FAILED: 'Thanh toán thất bại'
    };
    return titles[eventType] || 'UniHub Workshop';
  }

  resolveBody(eventType, payload) {
    const bodies = {
      REGISTRATION_CONFIRMED_FREE: `Bạn đã đăng ký thành công workshop ${payload.workshopTitle}.`,
      REGISTRATION_CONFIRMED_PAID: `Thanh toán cho workshop ${payload.workshopTitle} đã được xác nhận.`,
      REGISTRATION_CANCELLED: `Đăng ký workshop ${payload.workshopTitle} đã bị hủy.`,
      WORKSHOP_UPDATED: `Workshop ${payload.workshopTitle} đã thay đổi giờ hoặc phòng.`,
      WORKSHOP_CANCELLED: `Workshop ${payload.workshopTitle} đã bị hủy bởi ban tổ chức.`,
      CHECKIN_CONFIRMED: `Chào mừng bạn đến với ${payload.workshopTitle}!`,
      PAYMENT_FAILED: `Thanh toán cho workshop ${payload.workshopTitle} không thành công.`
    };
    return bodies[eventType] || 'Bạn có thông báo mới.';
  }

  async send(user, eventType, payload) {
    if (!user.fcm_token) return { status: 'skipped', reason: 'NO_FCM_TOKEN' };

    const message = {
      token: user.fcm_token,
      notification: {
        title: this.resolveTitle(eventType, payload),
        body: this.resolveBody(eventType, payload)
      },
      data: {
        eventType: eventType,
        workshopId: payload.workshopId || '',
        registrationId: payload.registrationId || ''
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } }
    };

    try {
      if (admin.apps.length === 0) {
        console.warn('Firebase Admin not initialized. Skipping push.');
        return { status: 'skipped', reason: 'FCM_NOT_CONFIGURED' };
      }

      await admin.messaging().send(message);
      return { status: 'sent' };
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
        // Clear stale token
        await db.query('UPDATE users SET fcm_token = NULL WHERE id = $1', [user.id]);
        return { status: 'failed', reason: 'FCM_TOKEN_INVALID' };
      }
      throw err;
    }
  }
}

module.exports = PushAdapter;
