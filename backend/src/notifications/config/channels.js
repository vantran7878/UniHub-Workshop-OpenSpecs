const EVENT_CHANNEL_MAP = {
  REGISTRATION_CONFIRMED_FREE: ['email', 'push'],
  REGISTRATION_CONFIRMED_PAID: ['email', 'push'],
  REGISTRATION_CANCELLED:      ['email', 'push'],
  WORKSHOP_UPDATED:            ['email', 'push'],
  WORKSHOP_CANCELLED:          ['email', 'push'],
  CHECKIN_CONFIRMED:           ['push'],
  PAYMENT_FAILED:              ['push'],
};

module.exports = { EVENT_CHANNEL_MAP };
